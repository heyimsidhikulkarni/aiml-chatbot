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
  // Only runs when conversationId or messages actually change.
  // saveConversationToDb is debounced internally — safe to call on every update.
  useEffect(() => {
    setActiveConversationId(conversationId);
    if (!messages.length) return;

    setConversations((current) =>
      upsertConversation(current, conversationId, messages)
    );

    saveConversationToDb(conversationId, messages, null, companion.name);
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
      // sendMessage now receives conversationId so Flask can load the correct history.
      // The auth token is fetched inside sendMessage (via authHeaders()) — the
      // frontend never supplies the user_id; the backend derives it from the JWT.
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
  // FIXED: we do NOT call resetChat() here. The old conversation stays fully
  // intact in Supabase. We simply generate a new UUID for the next conversation.
  // The Flask backend will start a clean slate automatically because it has never
  // seen this new conversationId before.
  async function handleNewChat() {
    if (loading) return;
    const id = createConversationId();
    setConversationId(id);
    setActiveConversationId(id);
    setMessages([]);
    setPanel("");
  }

  // ── Open a saved conversation ─────────────────────────────────────────────────
  // FIXED: we no longer replay messages through the LLM.
  // The saved messages are displayed immediately from Supabase.
  // The Flask backend loads the conversation history from Supabase on the next /chat call.
  async function openConversation(conversation) {
    setPanel("");
    if (loading) return;
    if (conversation.id === conversationId) return; // already open

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
