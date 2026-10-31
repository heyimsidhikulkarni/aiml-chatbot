"""
Unit tests for backend/app.py
Run: pip install pytest pytest-mock && pytest backend/tests/test_app.py -v
"""

import json
import threading
import time
import sys
import os

# Make sure the backend module is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

# ── Minimal env before importing app ─────────────────────────────────────────
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")


# ── Patch heavy dependencies before import ────────────────────────────────────
import unittest.mock as mock

# Patch genai so no real API calls are made
genai_mock = mock.MagicMock()
genai_mock.GenerativeModel.return_value = mock.MagicMock()
sys.modules["google.generativeai"] = genai_mock

import importlib
import backend.app as app_module
importlib.reload(app_module)  # reload after env vars are set

from backend.app import (
    app,
    _cache,
    _cache_lock,
    get_cached_messages,
    set_cached_messages,
    clear_cached_messages,
    load_conversation,
    build_system_prompt,
    is_crisis,
    CRISIS_PATTERNS,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    """Clear in-process cache before each test."""
    with _cache_lock:
        _cache.clear()
    yield
    with _cache_lock:
        _cache.clear()


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _make_user(user_id="user-abc", email="test@example.com"):
    return {"id": user_id, "email": email}


# ── In-process cache tests ────────────────────────────────────────────────────

class TestCache:
    def test_set_and_get(self):
        msgs = [{"role": "user", "content": "hi"}]
        set_cached_messages("conv-1", msgs)
        assert get_cached_messages("conv-1") == msgs

    def test_get_missing_returns_none(self):
        assert get_cached_messages("non-existent") is None

    def test_clear_removes_entry(self):
        set_cached_messages("conv-del", [{"role": "user", "content": "bye"}])
        clear_cached_messages("conv-del")
        assert get_cached_messages("conv-del") is None

    def test_clear_does_not_affect_other_conversations(self):
        set_cached_messages("conv-a", [{"role": "user", "content": "a"}])
        set_cached_messages("conv-b", [{"role": "user", "content": "b"}])
        clear_cached_messages("conv-a")
        assert get_cached_messages("conv-a") is None
        assert get_cached_messages("conv-b") == [{"role": "user", "content": "b"}]

    def test_thread_safety(self):
        """Concurrent cache reads/writes should not raise."""
        errors = []
        def worker(conv_id, value):
            try:
                set_cached_messages(conv_id, [{"role": "user", "content": value}])
                result = get_cached_messages(conv_id)
                assert result is not None
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(f"conv-{i}", f"val-{i}")) for i in range(20)]
        for t in threads: t.start()
        for t in threads: t.join()
        assert errors == [], f"Thread safety errors: {errors}"


# ── Auth tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_chat_requires_authorization_header(self, client):
        resp = client.post("/chat", json={"message": "hi", "conversation_id": "c1"})
        assert resp.status_code == 401

    def test_chat_rejects_malformed_token(self, client):
        resp = client.post(
            "/chat",
            json={"message": "hi", "conversation_id": "c1"},
            headers={"Authorization": "NotBearer token"},
        )
        assert resp.status_code == 401

    def test_reset_requires_authorization_header(self, client):
        resp = client.post("/reset", json={"conversation_id": "c1"})
        assert resp.status_code == 401

    def test_chat_succeeds_with_valid_token(self, client, monkeypatch):
        user = _make_user()
        monkeypatch.setattr(app_module, "verify_jwt", lambda token: user)
        monkeypatch.setattr(app_module, "load_conversation", lambda cid, uid: [])
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "call_llm", lambda *a, **kw: "Great to hear from you!")
        monkeypatch.setattr(app_module, "save_conversation_to_db", lambda *a, **kw: None)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        resp = client.post(
            "/chat",
            json={"message": "hello", "conversation_id": "conv-1"},
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "reply" in data
        assert "is_crisis" in data


# ── Conversation isolation tests ──────────────────────────────────────────────

class TestConversationIsolation:
    def test_user_id_comes_from_jwt_not_body(self, client, monkeypatch):
        """The user_id in the body must be ignored; only the JWT is trusted."""
        captured = {}
        user_from_jwt = _make_user("jwt-user-id")

        def fake_verify(token):
            return user_from_jwt

        def fake_load(conv_id, uid):
            captured["uid"] = uid
            return []

        monkeypatch.setattr(app_module, "verify_jwt", fake_verify)
        monkeypatch.setattr(app_module, "load_conversation", fake_load)
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "call_llm", lambda *a, **kw: "OK")
        monkeypatch.setattr(app_module, "save_conversation_to_db", lambda *a, **kw: None)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        resp = client.post(
            "/chat",
            # Attacker supplies a different user_id in the body — must be ignored
            json={"message": "hi", "conversation_id": "c1", "user_id": "attacker-id"},
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert resp.status_code == 200
        # The user_id actually used must match the JWT, not the body
        assert captured["uid"] == "jwt-user-id"

    def test_reset_only_clears_specified_conversation(self, client, monkeypatch):
        """Resetting conv-A must not affect conv-B."""
        user = _make_user()

        def fake_verify(token):
            return user

        def fake_fetch(conv_id, uid):
            # Return messages only if ownership matches (simulates RLS)
            if uid == user["id"]:
                return [{"role": "user", "content": "existing"}]
            return None

        monkeypatch.setattr(app_module, "verify_jwt", fake_verify)
        monkeypatch.setattr(app_module, "fetch_conversation_messages", fake_fetch)

        # Pre-populate both conversations in cache
        set_cached_messages("conv-a", [{"role": "user", "content": "a msg"}])
        set_cached_messages("conv-b", [{"role": "user", "content": "b msg"}])

        resp = client.post(
            "/reset",
            json={"conversation_id": "conv-a"},
            headers={"Authorization": "Bearer valid-jwt"},
        )
        assert resp.status_code == 200
        # conv-a cleared
        assert get_cached_messages("conv-a") is None
        # conv-b untouched
        assert get_cached_messages("conv-b") == [{"role": "user", "content": "b msg"}]

    def test_two_users_do_not_share_conversation_cache(self, client, monkeypatch):
        user_a = _make_user("user-a")
        user_b = _make_user("user-b")

        histories = {
            ("conv-shared", "user-a"): [{"role": "user", "content": "user-a message"}],
            ("conv-shared", "user-b"): [],  # user-b has no messages in this conv
        }

        def fake_load(conv_id, uid):
            return histories.get((conv_id, uid), [])

        def fake_save(*args, **kwargs):
            pass

        monkeypatch.setattr(app_module, "load_conversation", fake_load)
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "save_conversation_to_db", fake_save)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        replies = {}

        def fake_call_llm(system, history, message):
            replies["history_len"] = len(history)
            return f"Reply for {history}"

        monkeypatch.setattr(app_module, "call_llm", fake_call_llm)

        # User B sends a message to the same conversation ID
        monkeypatch.setattr(app_module, "verify_jwt", lambda t: user_b)
        resp = client.post(
            "/chat",
            json={"message": "hi from b", "conversation_id": "conv-shared"},
            headers={"Authorization": "Bearer token-b"},
        )
        assert resp.status_code == 200
        # User B should see an empty history (no contamination from user A)
        assert replies["history_len"] == 0


# ── Persistence tests ─────────────────────────────────────────────────────────

class TestPersistence:
    def test_messages_appended_to_history_after_chat(self, client, monkeypatch):
        """After /chat, both the user message and reply are in the cache."""
        user = _make_user()
        monkeypatch.setattr(app_module, "verify_jwt", lambda t: user)
        monkeypatch.setattr(app_module, "load_conversation", lambda cid, uid: [])
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "call_llm", lambda *a, **kw: "Nice to meet you")
        monkeypatch.setattr(app_module, "save_conversation_to_db", lambda *a, **kw: None)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        client.post(
            "/chat",
            json={"message": "hello", "conversation_id": "new-conv"},
            headers={"Authorization": "Bearer tok"},
        )

        cached = get_cached_messages("new-conv")
        assert cached is not None
        assert len(cached) == 2
        assert cached[0]["role"] == "user"
        assert cached[0]["content"] == "hello"
        assert cached[1]["role"] == "assistant"
        assert cached[1]["content"] == "Nice to meet you"

    def test_history_loaded_from_supabase_on_cache_miss(self, client, monkeypatch):
        """If the conversation is not in cache, it is loaded from Supabase."""
        user = _make_user()
        db_messages = [
            {"role": "user", "content": "previous message"},
            {"role": "assistant", "content": "previous reply"},
        ]
        loaded_from_db = []

        def fake_fetch(conv_id, uid):
            loaded_from_db.append(conv_id)
            return db_messages

        def fake_call_llm(system, history, message):
            # history should contain the DB messages
            assert history == db_messages
            return "Continuing..."

        monkeypatch.setattr(app_module, "verify_jwt", lambda t: user)
        monkeypatch.setattr(app_module, "fetch_conversation_messages", fake_fetch)
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "call_llm", fake_call_llm)
        monkeypatch.setattr(app_module, "save_conversation_to_db", lambda *a, **kw: None)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        # Cache is empty — should trigger DB load
        assert get_cached_messages("existing-conv") is None

        resp = client.post(
            "/chat",
            json={"message": "continuing...", "conversation_id": "existing-conv"},
            headers={"Authorization": "Bearer tok"},
        )
        assert resp.status_code == 200
        assert "existing-conv" in loaded_from_db

    def test_save_called_exactly_once_per_request(self, client, monkeypatch):
        """Exactly one save call per /chat — no duplicates."""
        user = _make_user()
        save_count = {"n": 0}

        def counting_save(*args, **kwargs):
            save_count["n"] += 1

        monkeypatch.setattr(app_module, "verify_jwt", lambda t: user)
        monkeypatch.setattr(app_module, "load_conversation", lambda cid, uid: [])
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "call_llm", lambda *a, **kw: "hi")
        monkeypatch.setattr(app_module, "save_conversation_to_db", counting_save)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        client.post(
            "/chat",
            json={"message": "test", "conversation_id": "c1"},
            headers={"Authorization": "Bearer tok"},
        )
        assert save_count["n"] == 1


# ── Crisis detection tests ────────────────────────────────────────────────────

class TestCrisisDetection:
    @pytest.mark.parametrize("text", [
        "I want to kill myself",
        "thinking about suicide",
        "I want to end my life",
        "I've been self-harming",
        "no reason to live anymore",
    ])
    def test_detects_crisis_phrases(self, text):
        assert is_crisis(text) is True

    @pytest.mark.parametrize("text", [
        "I'm feeling sad today",
        "I had a bad week",
        "I'm stressed about work",
    ])
    def test_does_not_flag_normal_messages(self, text):
        assert is_crisis(text) is False

    def test_crisis_response_includes_resources(self, client, monkeypatch):
        user = _make_user()
        monkeypatch.setattr(app_module, "verify_jwt", lambda t: user)
        monkeypatch.setattr(app_module, "load_conversation", lambda cid, uid: [])
        monkeypatch.setattr(app_module, "fetch_user_memory", lambda uid: "")
        monkeypatch.setattr(app_module, "call_llm", lambda *a, **kw: "I hear you.")
        monkeypatch.setattr(app_module, "save_conversation_to_db", lambda *a, **kw: None)
        monkeypatch.setattr(app_module, "async_update_memory", lambda *a, **kw: None)

        resp = client.post(
            "/chat",
            json={"message": "I want to kill myself", "conversation_id": "crisis-conv"},
            headers={"Authorization": "Bearer tok"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["is_crisis"] is True
        assert "iCall" in data["reply"] or "112" in data["reply"]


# ── System prompt / long-term memory tests ────────────────────────────────────

class TestSystemPrompt:
    def test_memory_summary_included_in_prompt(self):
        prompt = build_system_prompt("Milo", "User prefers CBT techniques and breathing exercises.")
        assert "CBT" in prompt
        assert "breathing" in prompt

    def test_empty_memory_produces_clean_prompt(self):
        prompt = build_system_prompt("Aria", "")
        assert "Long-term memory" not in prompt

    def test_companion_name_in_prompt(self):
        prompt = build_system_prompt("Zara", "")
        assert "Zara" in prompt


# ── Health endpoint ───────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "ok"
