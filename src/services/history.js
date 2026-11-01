import { supabase } from "../config/supabase.js";

const DEFAULT_HISTORY_KEY = "therapeutic_chat_history_v1";
const ACTIVE_KEY = "therapeutic_active_conversation_v1";

// ─── Conversation ID helpers ────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CHANGED: always returns a real UUID v4. The old fallback ("chat-<time>-<rand>")
// was used whenever crypto.randomUUID is unavailable (it only exists on https or
// localhost, so e.g. http://192.168.x.x dev servers hit it). That string is not a
// valid value for conversations.id (uuid) so saves failed, and the backend rejects it.
export function createConversationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// CHANGED: ignore a stored id that is not a UUID (left over from the old fallback
// format). Returning "" makes the page create a fresh valid id instead of sending
// an id the backend and database will reject on every message.
export function getActiveConversationId() {
  try {
    const stored = localStorage.getItem(ACTIVE_KEY) || "";
    return UUID_RE.test(stored) ? stored : "";
  } catch {
    return "";
  }
}

export function setActiveConversationId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* fallback */
  }
}

// ─── Local storage fallback (used when user is not signed in) ───────────────

export function loadLocalHistory(userId = "") {
  try {
    const key = userId ? `${DEFAULT_HISTORY_KEY}_${userId}` : DEFAULT_HISTORY_KEY;
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            item && typeof item.id === "string" && Array.isArray(item.messages)
        )
      : [];
  } catch {
    return [];
  }
}

export function saveLocalHistory(conversations, userId = "") {
  try {
    const key = userId ? `${DEFAULT_HISTORY_KEY}_${userId}` : DEFAULT_HISTORY_KEY;
    localStorage.setItem(key, JSON.stringify(conversations));
  } catch {
    /* fallback */
  }
}

// ─── Supabase: fetch all conversations for the signed-in user ────────────────

export async function fetchUserConversations() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return loadLocalHistory();
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, companion, messages, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("Error fetching conversations from Supabase:", error.message);
      return loadLocalHistory(user.id);
    }

    const formatted = (data || []).map((row) => ({
      id: row.id,
      title: row.title || "A conversation",
      companion: row.companion || "Companion",
      // Store only the messages array — the full JSONB column from Supabase
      messages: Array.isArray(row.messages) ? row.messages : [],
      updatedAt: row.updated_at,
    }));

    // Mirror to localStorage as an offline fallback
    saveLocalHistory(formatted, user.id);
    return formatted;
  } catch (err) {
    console.warn("Supabase fetchUserConversations exception:", err);
    return loadLocalHistory();
  }
}

/**
 * Fetch the messages for a single conversation from Supabase.
 * The RLS policy ensures the user can only read their own rows.
 * Returns an empty array if the conversation is not found or belongs to another user.
 */
export async function fetchConversationMessages(conversationId) {
  if (!conversationId) return [];
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("conversations")
      .select("messages")
      .eq("id", conversationId)
      .eq("user_id", user.id) // explicit ownership check (belt-and-suspenders with RLS)
      .single();

    if (error || !data) return [];
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (err) {
    console.warn("fetchConversationMessages exception:", err);
    return [];
  }
}

// ─── Debounced save ──────────────────────────────────────────────────────────
// Prevents duplicate writes when messages state updates rapidly (e.g. during
// the user sending + bot replying in quick succession).

const _saveTimers = new Map(); // conversationId → timeoutId
const SAVE_DEBOUNCE_MS = 600;

/**
 * Persist a conversation's messages to Supabase, debounced per conversation.
 * The save is skipped entirely if:
 *   - There are no messages
 *   - The user is not signed in
 * Safe to call on every render — only the final call within the debounce window
 * actually writes to the database.
 */
export function saveConversationToDb(
  conversationId,
  messages,
  title = null,
  companionName = "Compassionate Companion"
) {
  if (!conversationId || !messages || !messages.length) return;

  // Cancel any pending save for this conversation
  if (_saveTimers.has(conversationId)) {
    clearTimeout(_saveTimers.get(conversationId));
  }

  const timerId = setTimeout(async () => {
    _saveTimers.delete(conversationId);
    await _doSave(conversationId, messages, title, companionName);
  }, SAVE_DEBOUNCE_MS);

  _saveTimers.set(conversationId, timerId);
}

async function _doSave(conversationId, messages, title, companionName) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const firstUserMsg =
      messages.find((m) => m.role === "user")?.content || "A conversation";
    const computedTitle =
      title ||
      (firstUserMsg.length > 48
        ? `${firstUserMsg.slice(0, 48).trim()}…`
        : firstUserMsg);

    const { error } = await supabase.from("conversations").upsert(
      {
        id: conversationId,
        user_id: user.id,
        title: computedTitle,
        companion: companionName,
        messages: messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("Failed to persist conversation in Supabase:", error.message);
    }
  } catch (err) {
    console.warn("Exception saving conversation to Supabase:", err);
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteConversationFromDb(conversationId) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", user.id); // explicit ownership check
    }
  } catch (err) {
    console.warn("Exception deleting conversation from Supabase:", err);
  }
}

// ─── Local state helper ───────────────────────────────────────────────────────

export function upsertConversation(conversations, id, messages) {
  if (!messages.length) return conversations;
  const firstMessage =
    messages.find((message) => message.role === "user")?.content ||
    "A conversation";
  const previous = conversations.find((conversation) => conversation.id === id);
  const next = {
    id,
    title:
      previous?.title ||
      (firstMessage.length > 48
        ? `${firstMessage.slice(0, 48).trim()}…`
        : firstMessage),
    updatedAt: new Date().toISOString(),
    messages,
  };
  return [next, ...conversations.filter((conversation) => conversation.id !== id)].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}