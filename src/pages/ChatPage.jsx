import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { getCompanion } from "../components/CompanionAvatar.jsx";
import {
  checkHealth,
  getApiUrl,
  resetChat,
  sendMessage,
} from "../services/api.js";
import {
  createConversationId,
  getActiveConversationId,
  fetchUserConversations,
  saveConversationToDb,
  deleteConversationFromDb,
  setActiveConversationId,
  upsertConversation,
} from "../services/history.js";
import { supabase } from "../config/supabase.js";

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// CHANGED: UI-only "couldn't reach the chat service" bubbles are never saved. They
// are not part of the conversation, and once saved they would come back every time
// the chat is reopened and be replayed as history.
const persistable = (msgs) => (msgs || []).filter((m) => !m.error);

// CHANGED: identifies "what is already stored" so data we just LOADED from Supabase
// is not written straight back (which bumped updated_at and reordered the history
// list merely because a chat was opened).
const persistKey = (id, msgs) => {
  const list = persistable(msgs);
  return `${id}:${list.length}:${list[list.length - 1]?.id ?? ""}`;
};

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(
    () => getActiveConversationId() || createConversationId()
  );
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("checking");
  const [panel, setPanel] = useState("");
  const [profileName, setProfileName] = useState("Profile");

  const apiUrl = getApiUrl();
  const companion = getCompanion();

  // Key of the last state known to be in Supabase (loaded or saved).
  const persistedKeyRef = useRef(null);

  // ── Cached auth session — refreshed on every request, held in a ref
  //    so handlers always have the latest token without re-rendering ──────────
  const sessionRef = useRef(null);
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    sessionRef.current = session;
    return session?.access_token ?? null;
  }, []);

  // ── Load user profile & conversations from Supabase ────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "Profile";
        setProfileName(name);
      }
    });

    fetchUserConversations().then((loaded) => {
      setConversations(loaded);
      const activeId = getActiveConversationId();
      const current = loaded.find((c) => c.id === activeId);
      if (current) {
        persistedKeyRef.current = persistKey(current.id, current.messages); // CHANGED
        setConversationId(current.id);
        setMessages(current.messages || []);
      }
    });
  }, []);

  // ── Health check ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    checkHealth().then((ok) => {
      if (!cancelled) setStatus(ok ? "online" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  // ── Persist conversation updates to state and Supabase ──────────────────────
  // saveConversationToDb is debounced internally — safe to call on every update.
  useEffect(() => {
    setActiveConversationId(conversationId);
    const toSave = persistable(messages); // CHANGED: never persist error bubbles
    if (!toSave.length) return;

    const key = persistKey(conversationId, messages);
    if (key === persistedKeyRef.current) return; // CHANGED: nothing new to save
    persistedKeyRef.current = key;

    setConversations((current) =>
      upsertConversation(current, conversationId, toSave)
    );

    saveConversationToDb(conversationId, toSave, null, companion.name);
  }, [conversationId, messages, companion.name]);

  // ── Send a message ──────────────────────────────────────────────────────────
  async function handleSend(text) {
    if (loading) return;

    const userMsg = {
      id: `${Date.now()}-${Math.random()}`,
      role: "user",
      content: text,
      time: now(),
    };
    setMessages((current) => [...current, userMsg]);
    setLoading(true);

    try {
      // The backend authenticates the JWT itself and loads THIS conversation's saved
      // history from Supabase; the frontend never supplies a user_id.
      const data = await sendMessage(text, conversationId, companion.name);
      setStatus("online");
      const botMsg = {
        id: `${Date.now()}-${Math.random()}`,
        role: "bot",
        content: data.reply,
        crisis: !!data.is_crisis,
        time: now(),
      };
      setMessages((current) => [...current, botMsg]);
    } catch {
      setStatus("offline");
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random()}`,
          role: "bot",
          error: true,
          content:
            "I couldn't reach the chat service just now. Please try again in a little while.",
          time: now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── New chat ─────────────────────────────────────────────────────────────────
  // Does NOT call resetChat(): the old conversation stays intact in Supabase and a
  // new UUID starts a clean conversation (long-term memory carries over server-side).
  async function handleNewChat() {
    if (loading) return;
    const id = createConversationId();
    setConversationId(id);
    setActiveConversationId(id);
    setMessages([]);
    setPanel("");
  }

  // ── Open a saved conversation ─────────────────────────────────────────────────
  // Saved messages are shown from state; the backend reloads the same history from
  // Supabase on the next /chat call, so the conversation continues with full context.
  async function openConversation(conversation) {
    setPanel("");
    if (loading) return;
    if (conversation.id === conversationId) return; // already open

    persistedKeyRef.current = persistKey(conversation.id, conversation.messages); // CHANGED
    setConversationId(conversation.id);
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages || []);
    setStatus("online");
  }

  // ── Delete a conversation ─────────────────────────────────────────────────────
  async function handleDeleteConversation(id) {
    await deleteConversationFromDb(id);
    setConversations((current) => current.filter((c) => c.id !== id));
    if (conversationId === id) {
      handleNewChat();
    }
  }

  return (
    <div className="app">
      <Header
        status={status}
        onNewChat={handleNewChat}
        onOpenPanel={setPanel}
        profileName={profileName}
      />
      <ChatWindow messages={messages} loading={loading} onSuggestion={handleSend} />
      <MessageInput onSend={handleSend} disabled={loading} />
      <ChatPanel
        panel={panel}
        onClose={() => setPanel("")}
        conversations={conversations}
        activeId={conversationId}
        onOpenConversation={openConversation}
        onDeleteConversation={handleDeleteConversation}
        onProfileSave={(profile) =>
          setProfileName(profile.name.trim() || "Profile")
        }
      />
    </div>
  );
}