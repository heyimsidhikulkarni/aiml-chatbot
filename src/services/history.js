import { supabase } from "../config/supabase.js";

const DEFAULT_HISTORY_KEY = "therapeutic_chat_history_v1";
const ACTIVE_KEY = "therapeutic_active_conversation_v1";

export function createConversationId() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getActiveConversationId() {
  try {
    return localStorage.getItem(ACTIVE_KEY) || "";
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

export function loadLocalHistory(userId = "") {
  try {
    const key = userId ? `${DEFAULT_HISTORY_KEY}_${userId}` : DEFAULT_HISTORY_KEY;
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages)) : [];
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

// Fetch user conversations from Supabase database
export async function fetchUserConversations() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return loadLocalHistory();
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
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
      messages: Array.isArray(row.messages) ? row.messages : [],
      updatedAt: row.updated_at
    }));

    saveLocalHistory(formatted, user.id);
    return formatted;
  } catch (err) {
    console.warn("Supabase fetch conversations exception:", err);
    return loadLocalHistory();
  }
}

// Persist conversation and messages to Supabase database
export async function saveConversationToDb(conversationId, messages, title, companionName = "Compassionate Companion") {
  if (!conversationId || !messages || !messages.length) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const firstUserMsg = messages.find((m) => m.role === "user")?.content || "A conversation";
    const computedTitle = title || (firstUserMsg.length > 48 ? `${firstUserMsg.slice(0, 48).trim()}…` : firstUserMsg);

    const { error } = await supabase.from("conversations").upsert({
      id: conversationId,
      user_id: user.id,
      title: computedTitle,
      companion: companionName,
      messages: messages,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    if (error) {
      console.warn("Failed to persist conversation in Supabase:", error.message);
    }
  } catch (err) {
    console.warn("Exception saving conversation to Supabase:", err);
  }
}

// Delete conversation from Supabase database
export async function deleteConversationFromDb(conversationId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("conversations").delete().eq("id", conversationId).eq("user_id", user.id);
    }
  } catch (err) {
    console.warn("Exception deleting conversation from Supabase:", err);
  }
}

export function upsertConversation(conversations, id, messages) {
  if (!messages.length) return conversations;
  const firstMessage = messages.find((message) => message.role === "user")?.content || "A conversation";
  const previous = conversations.find((conversation) => conversation.id === id);
  const next = {
    id,
    title: previous?.title || (firstMessage.length > 48 ? `${firstMessage.slice(0, 48).trim()}…` : firstMessage),
    updatedAt: new Date().toISOString(),
    messages
  };
  return [next, ...conversations.filter((conversation) => conversation.id !== id)]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
