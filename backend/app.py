"""
Therapeutic Chatbot — Flask Backend
====================================
Run this in Google Colab (or locally with `python backend/app.py`).

Environment variables required
-------------------------------
GEMINI_API_KEY          – Google Generative AI API key
SUPABASE_URL            – https://mykrpktonsjvyzjxdqoc.supabase.co
SUPABASE_SERVICE_KEY    – Service-role key (NOT the anon key). Used server-side only.

Optional
--------
PORT                    – defaults to 5000
FLASK_ENV               – set to "development" for hot-reload

Quick Colab setup
-----------------
  !pip install flask flask-cors google-generativeai supabase requests pyngrok python-dotenv
  import os
  os.environ["GEMINI_API_KEY"]       = "YOUR_KEY"
  os.environ["SUPABASE_URL"]         = "https://mykrpktonsjvyzjxdqoc.supabase.co"
  os.environ["SUPABASE_SERVICE_KEY"] = "YOUR_SERVICE_ROLE_KEY"
  # Then run the cell containing this file, or:
  # exec(open("backend/app.py").read())
"""

import os
import re
import json
import logging
import time
import threading
from functools import wraps
from typing import Optional

import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PORT = int(os.environ.get("PORT", 5000))

# Context window: max messages to send to LLM per conversation (keeps tokens bounded)
MAX_HISTORY_MESSAGES = 20
# How many chars of the memory summary to inject at most
MAX_MEMORY_CHARS = 600
# Minimum seconds between memory summary updates (avoid hammering Supabase)
MEMORY_UPDATE_INTERVAL = 120

if not SUPABASE_URL:
    log.warning("SUPABASE_URL not set — database features disabled")
if not SUPABASE_SERVICE_KEY:
    log.warning("SUPABASE_SERVICE_KEY not set — JWT validation disabled")
if not GEMINI_API_KEY:
    log.warning("GEMINI_API_KEY not set — LLM responses will fail")

# ---------------------------------------------------------------------------
# Gemini setup
# ---------------------------------------------------------------------------
try:
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    _MODEL = genai.GenerativeModel("gemini-1.5-flash")
    log.info("Gemini model initialised")
except Exception as exc:
    log.error("Failed to initialise Gemini: %s", exc)
    _MODEL = None

# ---------------------------------------------------------------------------
# In-process conversation cache  {conversation_id: [{"role": .., "content": ..}, ...]}
# This is populated lazily from Supabase on first use and used as a write-through cache.
# ---------------------------------------------------------------------------
_cache: dict[str, list[dict]] = {}
_cache_lock = threading.Lock()

# Per-user memory update timestamps  {user_id: last_update_epoch_seconds}
_memory_last_updated: dict[str, float] = {}

# ---------------------------------------------------------------------------
# Supabase helpers (direct REST, no SDK dependency in Colab)
# ---------------------------------------------------------------------------

def _sb_headers(use_service_key: bool = True) -> dict:
    key = SUPABASE_SERVICE_KEY if use_service_key else ""
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def verify_jwt(token: str) -> Optional[dict]:
    """Validate a Supabase JWT by calling the Supabase /auth/v1/user endpoint.
    Returns the user dict on success, None on failure.
    Never trusts any user-id supplied in the request body.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        log.warning("JWT validation skipped — Supabase not configured")
        return {"id": "anonymous", "email": "anonymous@local"}
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json()
        log.warning("JWT validation failed: %s %s", resp.status_code, resp.text[:120])
        return None
    except Exception as exc:
        log.error("JWT validation exception: %s", exc)
        return None


def fetch_conversation_messages(conversation_id: str, user_id: str) -> list[dict]:
    """Load messages from Supabase for a given conversation.
    Verifies that the conversation belongs to user_id.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return []
    try:
        url = (
            f"{SUPABASE_URL}/rest/v1/conversations"
            f"?id=eq.{conversation_id}&user_id=eq.{user_id}&select=messages"
        )
        resp = requests.get(url, headers=_sb_headers(), timeout=5)
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                msgs = rows[0].get("messages", [])
                return msgs if isinstance(msgs, list) else []
        return []
    except Exception as exc:
        log.error("fetch_conversation_messages exception: %s", exc)
        return []


def save_conversation_to_db(
    conversation_id: str,
    user_id: str,
    messages: list[dict],
    title: str = "",
    companion: str = "Companion",
) -> None:
    """Persist a conversation's full message list to Supabase (upsert)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return
    try:
        if not title:
            first_user = next((m["content"] for m in messages if m.get("role") == "user"), "A conversation")
            title = first_user[:48].rstrip() + ("…" if len(first_user) > 48 else "")

        payload = {
            "id": conversation_id,
            "user_id": user_id,
            "title": title,
            "companion": companion,
            "messages": messages,
            "updated_at": _iso_now(),
        }
        url = f"{SUPABASE_URL}/rest/v1/conversations"
        resp = requests.post(
            url,
            headers={**_sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=payload,
            timeout=8,
        )
        if resp.status_code not in (200, 201):
            log.warning("save_conversation_to_db failed: %s %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        log.error("save_conversation_to_db exception: %s", exc)


def fetch_user_memory(user_id: str) -> str:
    """Retrieve the long-term memory summary for a user. Returns empty string on failure."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return ""
    try:
        url = f"{SUPABASE_URL}/rest/v1/user_memory?user_id=eq.{user_id}&select=summary"
        resp = requests.get(url, headers=_sb_headers(), timeout=5)
        if resp.status_code == 200:
            rows = resp.json()
            return rows[0]["summary"] if rows else ""
        return ""
    except Exception as exc:
        log.error("fetch_user_memory exception: %s", exc)
        return ""


def update_user_memory(user_id: str, summary: str) -> None:
    """Save the extracted memory summary for a user (upsert)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return
    try:
        payload = {"user_id": user_id, "summary": summary[:MAX_MEMORY_CHARS], "updated_at": _iso_now()}
        url = f"{SUPABASE_URL}/rest/v1/user_memory"
        requests.post(
            url,
            headers={**_sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=payload,
            timeout=8,
        )
    except Exception as exc:
        log.error("update_user_memory exception: %s", exc)


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# In-process cache helpers
# ---------------------------------------------------------------------------

def get_cached_messages(conversation_id: str) -> Optional[list[dict]]:
    with _cache_lock:
        return _cache.get(conversation_id)


def set_cached_messages(conversation_id: str, messages: list[dict]) -> None:
    with _cache_lock:
        _cache[conversation_id] = messages


def clear_cached_messages(conversation_id: str) -> None:
    with _cache_lock:
        _cache.pop(conversation_id, None)


def load_conversation(conversation_id: str, user_id: str) -> list[dict]:
    """Return messages from cache, falling back to Supabase. Always ownership-checked."""
    cached = get_cached_messages(conversation_id)
    if cached is not None:
        return cached
    msgs = fetch_conversation_messages(conversation_id, user_id)
    set_cached_messages(conversation_id, msgs)
    return msgs


# ---------------------------------------------------------------------------
# Crisis detection
# ---------------------------------------------------------------------------
CRISIS_PATTERNS = re.compile(
    r"\b(suicid|kill\s+myself|end\s+my\s+life|want\s+to\s+die|self.harm|"
    r"hurt\s+myself|overdos|no\s+reason\s+to\s+live|can't\s+go\s+on)\b",
    re.IGNORECASE,
)

CRISIS_RESOURCES = (
    "\n\n---\n**If you're in crisis**, please reach out to a real person right now:\n"
    "- **iCall (India):** 9152987821\n"
    "- **Vandrevala Foundation:** 1860-2662-345 (24/7)\n"
    "- **Emergency:** 112\n"
    "You deserve real support. 💙"
)


def is_crisis(text: str) -> bool:
    return bool(CRISIS_PATTERNS.search(text))


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_system_prompt(companion_name: str = "Milo", memory_summary: str = "") -> str:
    memory_section = ""
    if memory_summary.strip():
        memory_section = (
            f"\n\n[Long-term memory about this user — use this to personalise responses, "
            f"but do NOT repeat it verbatim or reference it directly unless relevant]\n"
            f"{memory_summary.strip()}"
        )

    return f"""You are {companion_name}, a warm, empathetic emotional-support companion.
Your role is to listen actively, reflect feelings, validate experiences, and gently encourage healthy coping strategies.
You are NOT a therapist or doctor. Never diagnose. Never prescribe. Always recommend professional help for serious concerns.

Guidelines:
- Keep responses concise (2-5 sentences) unless the user needs more detail.
- Mirror the user's emotional tone: gentle for distress, lighter when they are calm.
- Ask one follow-up question at a time to deepen understanding.
- Acknowledge feelings before offering any advice or reframing.
- Respect boundaries; never push the user to share more than they want to.
- If the user expresses a safety concern, provide crisis resources immediately.
{memory_section}"""


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def call_llm(system_prompt: str, history: list[dict], user_message: str) -> str:
    """Send the full conversation history + new message to Gemini and return the reply."""
    if _MODEL is None:
        return "I'm having trouble connecting to my AI service right now. Please try again shortly."

    # Build Gemini chat history (role must be "user" or "model")
    chat_history = []
    for msg in history:
        role = "model" if msg.get("role") in ("bot", "assistant", "model") else "user"
        content = msg.get("content", "")
        if content:
            chat_history.append({"role": role, "parts": [content]})

    try:
        chat = _MODEL.start_chat(
            history=chat_history,
            # Gemini does not support a dedicated system message in start_chat,
            # so we prepend it as the very first user + model exchange if there's no history,
            # or inject it into the generation config as a system instruction.
        )
        # Use system_instruction if supported by the model version
        model_with_sys = genai.GenerativeModel(
            "gemini-1.5-flash",
            system_instruction=system_prompt,
        )
        chat = model_with_sys.start_chat(history=chat_history)
        response = chat.send_message(user_message)
        return response.text.strip()
    except Exception as exc:
        log.error("LLM call failed: %s", exc)
        return "I'm sorry — I ran into a hiccup. Give me a moment and try again."


# ---------------------------------------------------------------------------
# Memory extraction (async, fire-and-forget)
# ---------------------------------------------------------------------------

def _extract_and_save_memory(user_id: str, messages: list[dict], companion_name: str) -> None:
    """Ask the LLM to distil a short memory summary from recent messages, then save it."""
    if _MODEL is None:
        return
    # Rate-limit: don't update more than once every MEMORY_UPDATE_INTERVAL seconds
    last = _memory_last_updated.get(user_id, 0)
    if time.time() - last < MEMORY_UPDATE_INTERVAL:
        return
    _memory_last_updated[user_id] = time.time()

    user_msgs = [m["content"] for m in messages if m.get("role") == "user"][-10:]
    if not user_msgs:
        return

    prompt = (
        "Below are recent messages from a user of an emotional-support chatbot. "
        "Extract a concise (max 4 bullet points, plain text) summary of: "
        "their current emotional themes, any preferences or coping strategies they mentioned, "
        "and anything else that would help a companion personalise future conversations. "
        "Do NOT include identifying information. Be empathetic and brief.\n\n"
        + "\n".join(f"- {m}" for m in user_msgs)
    )
    try:
        response = _MODEL.generate_content(prompt)
        summary = response.text.strip()
        if summary:
            update_user_memory(user_id, summary)
            log.info("Updated memory for user %s", user_id[:8])
    except Exception as exc:
        log.error("Memory extraction failed: %s", exc)


def async_update_memory(user_id: str, messages: list[dict], companion_name: str) -> None:
    t = threading.Thread(
        target=_extract_and_save_memory,
        args=(user_id, messages, companion_name),
        daemon=True,
    )
    t.start()


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def require_auth(f):
    """Decorator: extracts the Bearer token, verifies it with Supabase,
    and injects the verified `user` dict as a keyword argument.
    Returns 401 if the token is missing or invalid.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401
        token = auth_header[7:].strip()
        user = verify_jwt(token)
        if user is None:
            return jsonify({"error": "Invalid or expired token"}), 401
        return f(*args, user=user, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=True)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "gemini-1.5-flash"})


@app.route("/chat", methods=["POST"])
@require_auth
def chat(user: dict):
    """
    POST /chat
    Headers: Authorization: Bearer <supabase_jwt>
    Body:    { "message": str, "conversation_id": str, "companion": str? }
    Returns: { "reply": str, "is_crisis": bool }
    """
    body = request.get_json(silent=True) or {}
    user_message = (body.get("message") or "").strip()
    conversation_id = (body.get("conversation_id") or "").strip()
    companion_name = (body.get("companion") or "Milo").strip()

    if not user_message:
        return jsonify({"error": "message is required"}), 400
    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400

    # ── User ID comes ONLY from the verified JWT, never from the body ──
    user_id: str = user["id"]

    # 1. Load existing history (cache → Supabase, ownership-checked)
    history = load_conversation(conversation_id, user_id)

    # Trim to context limit (most recent MAX_HISTORY_MESSAGES messages)
    if len(history) > MAX_HISTORY_MESSAGES:
        history = history[-MAX_HISTORY_MESSAGES:]

    # 2. Fetch long-term memory for personalisation
    memory_summary = fetch_user_memory(user_id)

    # 3. Build system prompt
    system_prompt = build_system_prompt(companion_name, memory_summary)

    # 4. Call LLM with full history + new message
    reply = call_llm(system_prompt, history, user_message)

    # 5. Crisis check — append resources if needed
    crisis_detected = is_crisis(user_message) or is_crisis(reply)
    if crisis_detected:
        reply += CRISIS_RESOURCES

    # 6. Append both turns to history and update cache + Supabase
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    set_cached_messages(conversation_id, history)

    # Save to DB (synchronous — we want persistence before returning)
    save_conversation_to_db(conversation_id, user_id, history, companion=companion_name)

    # 7. Async: update long-term memory summary
    async_update_memory(user_id, history, companion_name)

    return jsonify({"reply": reply, "is_crisis": crisis_detected})


@app.route("/reset", methods=["POST"])
@require_auth
def reset(user: dict):
    """
    POST /reset
    Headers: Authorization: Bearer <supabase_jwt>
    Body:    { "conversation_id": str }
    Clears ONLY the specified conversation's in-process cache.
    Does NOT delete the conversation from Supabase.
    Returns: { "ok": true }
    """
    body = request.get_json(silent=True) or {}
    conversation_id = (body.get("conversation_id") or "").strip()

    # ── User ID from JWT only ──
    user_id: str = user["id"]

    if conversation_id:
        # Verify ownership before clearing — don't let user A reset user B's cache
        msgs = fetch_conversation_messages(conversation_id, user_id)
        if msgs is not None:  # None means ownership check failed / not found
            clear_cached_messages(conversation_id)
            log.info("Reset conversation %s for user %s", conversation_id[:8], user_id[:8])

    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Colab / local entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        # Try pyngrok for Colab tunnelling
        from pyngrok import ngrok
        public_url = ngrok.connect(PORT)
        log.info("ngrok tunnel: %s", public_url)
    except ImportError:
        log.info("pyngrok not installed — running on localhost:%d", PORT)

    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)
