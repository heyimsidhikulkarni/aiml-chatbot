import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import CompanionAvatar, { getCompanion } from "./CompanionAvatar.jsx";

const SUGGESTIONS = [
  { title: "I'm feeling overwhelmed", message: "There's a lot on my mind right now." },
  { title: "Academic stress", message: "I'm worried about my studies and exams." },
  { title: "I need some motivation", message: "Help me figure out a small next step." },
  { title: "I just want to talk", message: "I don't really know where to start." }
];

export default function ChatWindow({ messages, loading, onSuggestion }) {
  const endRef = useRef(null);
  const companion = getCompanion();

  useEffect(() => {
    if (messages.length === 0 && !loading) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <main className="messages" aria-live="polite">
      {messages.length === 0 && (
        <section className="welcome" aria-labelledby="welcome-title">
          <CompanionAvatar name={companion.name} avatar={companion.avatar} className="avatar welcome-avatar" />
          <p className="welcome-eyebrow">A little space, just for you</p>
          <h2 id="welcome-title">Hey, I'm {companion.name}.<br />What's on your mind?</h2>
          <p className="welcome-copy">You can talk about your day, share what's bothering you, or simply take a moment to sort through your thoughts.</p>
          <div className="suggestions" aria-label="Conversation starters">
            {SUGGESTIONS.map(({ title, message }, index) => (
              <button key={title} className="suggestion" onClick={() => onSuggestion(message)}>
                <span className="suggestion-icon" aria-hidden="true">{["☁", "✎", "↗", "♡"][index]}</span>
                <span><strong>{title}</strong><small>{message}</small></span>
                <span className="suggestion-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} companion={companion} />
      ))}

      {loading && (
        <div className="assistant-message" role="status" aria-label={`${companion.name} is replying`}>
          <CompanionAvatar name={companion.name} avatar={companion.avatar} className="avatar message-avatar" />
          <div className="assistant-content">
            <span className="message-author">{companion.name}</span>
            <div className="bubble bot typing"><span></span><span></span><span></span></div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </main>
  );
}
