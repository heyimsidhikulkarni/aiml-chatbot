import { useEffect, useState } from "react";
import { getCompanion } from "./CompanionAvatar.jsx";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "";

function readProfile() {
  try {
    return {
      name: localStorage.getItem("therapeutic_profile_name") || "",
      email: localStorage.getItem("therapeutic_profile_email") || ""
    };
  } catch {
    return { name: "", email: "" };
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPanel({ panel, onClose, conversations = [], activeId, onOpenConversation, onProfileSave }) {
  const [profile, setProfile] = useState(readProfile);
  const [saved, setSaved] = useState(false);
  const companion = getCompanion();

  useEffect(() => {
    if (panel === "profile") {
      setProfile(readProfile());
      setSaved(false);
    }
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel, onClose]);

  if (!panel) return null;

  function saveProfile(event) {
    event.preventDefault();
    try {
      localStorage.setItem("therapeutic_profile_name", profile.name.trim());
      localStorage.setItem("therapeutic_profile_email", profile.email.trim());
    } catch {
      // Keep the values in this view if browser storage is unavailable.
    }
    onProfileSave?.(profile);
    setSaved(true);
  }

  return (
    <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`chat-panel ${panel === "history" ? "history-panel" : "dialog-panel"}`} role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <header className="panel-header">
          <div>
            <p className="panel-kicker">YOUR SPACE</p>
            <h2 id="panel-title">{panel === "history" ? "Conversation history" : panel === "profile" ? "Your profile" : "Help center"}</h2>
          </div>
          <button className="panel-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {panel === "history" && (
          <div className="panel-body">
            <p className="panel-intro">Your conversations are saved on this device, so you can come back to them anytime.</p>
            {conversations.length === 0 ? (
              <div className="panel-empty"><span aria-hidden="true">◷</span><strong>No conversations yet</strong><p>Your chats will appear here as you talk.</p></div>
            ) : (
              <div className="history-list">
                {conversations.map((conversation) => (
                  <button key={conversation.id} className={`history-item ${conversation.id === activeId ? "is-active" : ""}`} onClick={() => onOpenConversation(conversation)}>
                    <span className="history-icon" aria-hidden="true">◷</span>
                    <span className="history-item-copy"><strong>{conversation.title || "A conversation"}</strong><small>{conversation.messages.filter((message) => message.role === "user").length} messages</small></span>
                    <time>{formatDate(conversation.updatedAt)}</time>
                  </button>
                ))}
              </div>
            )}
            <p className="panel-footnote">Chat history is stored in this browser and is not synced between devices.</p>
          </div>
        )}

        {panel === "profile" && (
          <form className="panel-body profile-form" onSubmit={saveProfile}>
            <p className="panel-intro">Add your details so your space feels a little more personal.</p>
            <div className="profile-companion">
              <span className="profile-companion-image">
                {companion.avatar ? <img src={companion.avatar} alt={`${companion.name}, your companion`} /> : <span aria-hidden="true">{companion.name.slice(0, 1).toUpperCase()}</span>}
              </span>
              <span className="profile-companion-name">{companion.name}</span>
            </div>
            <label>Your name<input autoComplete="name" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" /></label>
            <label>Email address<input type="email" autoComplete="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" /></label>
            <p className="panel-footnote">Profile details are saved on this device. They are not used to sign in.</p>
            <button className="panel-primary" type="submit">Save profile</button>
            {saved && <p className="saved-note" role="status">Your profile is saved.</p>}
          </form>
        )}

        {panel === "help" && (
          <div className="panel-body help-body">
            <p className="panel-intro">You deserve support from a real person, too. Choose the option that feels right for you.</p>
            <div className="help-card">
              <span className="help-symbol" aria-hidden="true">♡</span>
              <div><h3>Talk with a professional</h3><p>{SUPPORT_EMAIL ? "Send a note to our support team and ask about connecting with a mental health professional." : "A professional support contact has not been set up for this app yet. If you already have a care provider, you can reach out to them directly."}</p></div>
              {SUPPORT_EMAIL && <a className="panel-primary" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Professional support request")}`}>Get in touch</a>}
            </div>
            <div className="help-card help-card--soft">
              <span className="help-symbol" aria-hidden="true">☎</span>
              <div><h3>Mental health helpline</h3><p>Call 14416 to reach the helpline.</p></div>
              <a className="panel-primary" href="tel:14416">Call 14416</a>
            </div>
            <div className="help-card help-card--soft">
              <span className="help-symbol" aria-hidden="true">✳</span>
              <div><h3>Need immediate help?</h3><p>If you or someone else may be in immediate danger, contact your local emergency services or go to the nearest emergency department.</p></div>
            </div>
            <p className="panel-footnote">This chatbot provides general emotional support and cannot replace professional mental health care.</p>
          </div>
        )}
      </section>
    </div>
  );
}
