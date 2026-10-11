import { useEffect, useState } from "react";
import Header from "../components/Header.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { checkHealth, getApiUrl, resetChat, sendMessage } from "../services/api.js";
import { createConversationId, getActiveConversationId, loadHistory, saveHistory, setActiveConversationId, upsertConversation } from "../services/history.js";

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function loadActiveMessages() {
  const id = getActiveConversationId();
  return loadHistory().find((conversation) => conversation.id === id)?.messages || [];
}

export default function ChatPage() {
  const [conversations, setConversations] = useState(loadHistory);
  const [conversationId, setConversationId] = useState(() => {
    const id = getActiveConversationId();
    return loadHistory().some((conversation) => conversation.id === id) ? id : createConversationId();
  });
  const [messages, setMessages] = useState(loadActiveMessages);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("checking");
  const [panel, setPanel] = useState("");
  const [profileName, setProfileName] = useState(() => {
    try { return localStorage.getItem("therapeutic_profile_name") || "Profile"; } catch { return "Profile"; }
  });
  const apiUrl = getApiUrl();

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    checkHealth().then((ok) => { if (!cancelled) setStatus(ok ? "online" : "offline"); });
    return () => { cancelled = true; };
  }, [apiUrl]);

  useEffect(() => {
    setActiveConversationId(conversationId);
    if (!messages.length) return;
    setConversations((current) => {
      const updated = upsertConversation(current, conversationId, messages);
      saveHistory(updated);
      return updated;
    });
  }, [conversationId, messages]);

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
    setPanel("");
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
      <ChatWindow messages={messages} loading={loading} onSuggestion={handleSend} />
      <MessageInput onSend={handleSend} disabled={loading} />
      <ChatPanel
        panel={panel}
        onClose={() => setPanel("")}
        conversations={conversations}
        activeId={conversationId}
        onOpenConversation={openConversation}
        onProfileSave={(profile) => setProfileName(profile.name.trim() || "Profile")}
      />
    </div>
  );
}
