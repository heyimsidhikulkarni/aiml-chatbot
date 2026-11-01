import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { checkHealth, getApiUrl, resetChat, sendMessage } from "../services/api.js";
import { createConversationId, loadHistory, loadLocalHistory, saveHistory, saveLocalHistory, setActiveConversationId, upsertConversation } from "../services/history.js";
import { supabase } from "../services/supabase.js";

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(createConversationId);
  const [messages, setMessages] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("checking");
  const [panel, setPanel] = useState("");
  const [profileName, setProfileName] = useState(() => {
    try { return localStorage.getItem("therapeutic_profile_name") || "Profile"; } catch { return "Profile"; }
  });
  const apiUrl = getApiUrl();

  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .catch(() => loadLocalHistory())
      .then((storedConversations) => {
        if (cancelled) return;
        const newConversationId = createConversationId();
        setConversations(storedConversations);
        setConversationId(newConversationId);
        setActiveConversationId(newConversationId);
        setMessages([]);
        setHistoryLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    checkHealth().then((ok) => { if (!cancelled) setStatus(ok ? "online" : "offline"); });
    return () => { cancelled = true; };
  }, [apiUrl]);

  useEffect(() => {
    if (!historyLoaded) return;
    setActiveConversationId(conversationId);
    if (!messages.length) return;
    setConversations((current) => {
      const updated = upsertConversation(current, conversationId, messages);
      saveHistory(updated).catch(() => undefined);
      return updated;
    });
  }, [conversationId, messages, historyLoaded]);

  async function handleSend(text) {
    if (loading) return;
    setMessages((current) => [...current, { id: `${Date.now()}-${Math.random()}`, role: "user", content: text, time: now() }]);
    setLoading(true);
    try {
      const data = await sendMessage(text);
      setStatus("online");
      setMessages((current) => [...current, { id: `${Date.now()}-${Math.random()}`, role: "bot", content: data.reply, crisis: !!data.is_crisis, time: now() }]);
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
    setShowSuggestions(false);
    setPanel("");
  }

  async function handleDeleteConversation(conversation) {
    const remaining = conversations.filter((item) => item.id !== conversation.id);
    setConversations(remaining);
    saveLocalHistory(remaining);
    if (conversation.id === conversationId) {
      setMessages([]);
      setConversationId(createConversationId());
      setShowSuggestions(false);
    }
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", conversation.id);
      if (error) throw error;
    } catch {
      // The local history is removed even if cloud history cannot be reached.
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setPanel("");
    window.location.hash = "#/";
  }

  async function openConversation(conversation) {
    setPanel("");
    if (loading) return;
    if (conversation.id !== conversationId) {
      setLoading(true);
      await resetChat();
      try {
        // Restore this thread's backend context by replaying its earlier user turns.
        for (const message of conversation.messages) {
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
    setMessages(conversation.messages);
  }

  return (
    <div className="app">
      <Header status={status} onNewChat={handleNewChat} onOpenPanel={setPanel} profileName={profileName} />
      <ChatWindow messages={messages} loading={loading} onSuggestion={handleSend} showSuggestions={showSuggestions} />
      <MessageInput onSend={handleSend} disabled={loading} />
      <ChatPanel
        panel={panel}
        onClose={() => setPanel("")}
        conversations={conversations}
        activeId={conversationId}
        onOpenConversation={openConversation}
        onDeleteConversation={handleDeleteConversation}
        onProfileSave={(profile) => setProfileName(profile.name.trim() || "Profile")}
        onLogout={handleLogout}
      />
    </div>
  );
}
