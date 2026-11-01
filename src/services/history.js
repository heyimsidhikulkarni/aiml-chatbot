import { supabase } from "./supabase.js";

const HISTORY_KEY = "therapeutic_chat_history_v1";
const ACTIVE_KEY = "therapeutic_active_conversation_v1";

export function createConversationId() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadLocalHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages)) : [];
  } catch {
    return [];
  }
}

export async function loadHistory() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return loadLocalHistory();

  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (conversationError) throw conversationError;
  if (!conversations?.length) return [];

  const { data: rows, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, crisis, error, created_at, ordinal")
    .in("conversation_id", conversations.map((conversation) => conversation.id))
    .order("ordinal", { ascending: true });

  if (messageError) throw messageError;

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updated_at,
    messages: (rows || [])
      .filter((message) => message.conversation_id === conversation.id)
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        crisis: message.crisis,
        error: message.error,
        time: new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }))
  }));
}

export function saveLocalHistory(conversations) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
  } catch {
    /* Browser storage can be unavailable or full. */
  }
}

export async function saveHistory(conversations) {
  saveLocalHistory(conversations);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const userId = session.user.id;
  for (const conversation of conversations) {
    const { error: conversationError } = await supabase.from("conversations").upsert({
      id: conversation.id,
      user_id: userId,
      title: conversation.title,
      updated_at: conversation.updatedAt
    });
    if (conversationError) throw conversationError;

    await supabase.from("messages").delete().eq("conversation_id", conversation.id);
    if (conversation.messages.length) {
      const rows = conversation.messages.map((message, ordinal) => ({
        id: globalThis.crypto?.randomUUID ? undefined : `${conversation.id}-${ordinal}-${Date.now()}`,
        conversation_id: conversation.id,
        user_id: userId,
        role: message.role === "user" ? "user" : "bot",
        content: message.content,
        crisis: Boolean(message.crisis),
        error: Boolean(message.error),
        ordinal
      }));
      const usableRows = rows.map(({ id, ...row }) => row);
      const { error: messageError } = await supabase.from("messages").insert(usableRows);
      if (messageError) throw messageError;
    }
  }
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
    /* Active selection is a convenience; history remains usable in memory. */
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
