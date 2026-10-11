const HISTORY_KEY = "therapeutic_chat_history_v1";
const ACTIVE_KEY = "therapeutic_active_conversation_v1";

export function createConversationId() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages)) : [];
  } catch {
    return [];
  }
}

export function saveHistory(conversations) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
  } catch {
    /* Browser storage can be unavailable or full. */
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
