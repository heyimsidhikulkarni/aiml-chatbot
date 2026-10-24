import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { getCompanion } from "../components/CompanionAvatar.jsx";
import { checkHealth, getApiUrl, resetChat, sendMessage } from "../services/api.js";
import {
  createConversationId,
  getActiveConversationId,
  fetchUserConversations,
  saveConversationToDb,
  deleteConversationFromDb,
  setActiveConversationId,
  upsertConversation
} from "../services/history.js";
import { supabase } from "../config/supabase.js";

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(() => {
    return getActiveConversationId() || createConversationId();
  });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("checking");
  const [panel, setPanel] = useState("");
  const [profileName, setProfileName] = useState("Profile");
  const apiUrl = getApiUrl();
  const companion = getCompanion();

  // Load user profile & conversations from Supabase
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.display_name || user.email?.split("@")[0] || "Profile";
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

  // Health check
  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    checkHealth().then((ok) => { if (!cancelled) setStatus(ok ? "online" : "offline"); });
    return () => { cancelled = true; };
  }, [apiUrl]);

  // Persist conversation updates to state and Supabase database
  useEffect(() => {
    setActiveConversationId(conversationId);
    if (!messages.length) return;

    setConversations((current) => {
      const updated = upsertConversation(current, conversationId, messages);
      return updated;
    });

    // Save to user's database in Supabase
    saveConversationToDb(conversationId, messages, null, companion.name);
  }, [conversationId, messages]);

  async function handleSend(text) {
    if (loading) return;
    const userMsg = { id: `${Date.now()}-${Math.random()}`, role: "user", content: text, time: now() };
    setMessages((current) => [...current, userMsg]);
    setLoading(true);

    try {
      const data = await sendMessage(text);
      setStatus("online");
      const botMsg = { id: `${Date.now()}-${Math.random()}`, role: "bot", content: data.reply, crisis: !!data.is_crisis, time: now() };
      setMessages((current) => [...current, botMsg]);
    } catch {
      setStatus("offline");
      setMessages((current) => [...current, { id: `${Date.now()}-${Math.random()}`, role: "bot", error: true, content: "I couldn't reach the chat service just now. Please try again in a little while.", time: now() }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewChat() {
    if (loading) return;
    await resetChat();
    const id = createConversationId();
    setConversationId(id);
    setActiveConversationId(id);
    setMessages([]);
    setPanel("");
  }

  async function openConversation(conversation) {
    setPanel("");
    if (loading) return;
    if (conversation.id !== conversationId) {
      setLoading(true);
      await resetChat();
      try {
        for (const message of conversation.messages || []) {
          if (message.role === "user") await sendMessage(message.content);
        }
        setStatus("online");
      } catch {
        setStatus("offline");
      } finally {
        setLoading(false);
      }
    }
    setConversationId(conversation.id);
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages || []);
  }

  async function handleDeleteConversation(id) {
    await deleteConversationFromDb(id);
    setConversations((current) => current.filter((c) => c.id !== id));
    if (conversationId === id) {
      handleNewChat();
    }
  }

  return (
    <div className="app">
      <Header status={status} onNewChat={handleNewChat} onOpenPanel={setPanel} profileName={profileName} />
      <ChatWindow messages={messages} loading={loading} onSuggestion={handleSend} />
      <MessageInput onSend={handleSend} disabled={loading} />
      <ChatPanel
        panel={panel}
        onClose={() => setPanel("")}
        conversations={conversations}
        activeId={conversationId}
        onOpenConversation={openConversation}
        onDeleteConversation={handleDeleteConversation}
        onProfileSave={(profile) => setProfileName(profile.name.trim() || "Profile")}
      />
    </div>
  );
}
