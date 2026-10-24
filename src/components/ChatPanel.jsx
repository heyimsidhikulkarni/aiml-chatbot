import { useEffect, useState } from "react";
import { getCompanion } from "./CompanionAvatar.jsx";
import { supabase } from "../config/supabase.js";
import { LOGIN_ROUTE } from "../config/site.js";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatPanel({
  panel,
  onClose,
  conversations = [],
  activeId,
  onOpenConversation,
  onDeleteConversation,
  onProfileSave,
}) {
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [currentUser, setCurrentUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const companion = getCompanion();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      const email = user?.email || localStorage.getItem("therapeutic_profile_email") || "";
      const name = localStorage.getItem("therapeutic_profile_name") || email.split("@")[0] || "";
      setProfile({ name, email });
    });
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel, onClose]);

  if (!panel) return null;

  async function saveProfile(event) {
    event.preventDefault();
    try {
      localStorage.setItem("therapeutic_profile_name", profile.name.trim());
      localStorage.setItem("therapeutic_profile_email", profile.email.trim());

      if (currentUser) {
        await supabase.from("profiles").upsert({
          id: currentUser.id,
          email: profile.email.trim(),
          display_name: profile.name.trim(),
          updated_at: new Date().toISOString()
        });
      }
    } catch {
      // fallback
    }
    onProfileSave?.(profile);
    setSaved(true);
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("therapeutic_profile_email");
      localStorage.removeItem("therapeutic_profile_name");
    } catch {
      // fallback
    }
    window.location.hash = LOGIN_ROUTE;
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
            <p className="panel-intro">
              {currentUser
                ? `Conversations are saved to your account database (${currentUser.email}).`
                : "Your conversations are saved on this device."}
            </p>
            {conversations.length === 0 ? (
              <div className="panel-empty"><span aria-hidden="true">◷</span><strong>No conversations yet</strong><p>Your chats will appear here as you talk.</p></div>
            ) : (
              <div className="history-list">
                {conversations.map((conversation) => (
                  <div key={conversation.id} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      className={`history-item ${conversation.id === activeId ? "is-active" : ""}`}
                      onClick={() => onOpenConversation(conversation)}
                      style={{ flex: 1 }}
                    >
                      <span className="history-icon" aria-hidden="true">◷</span>
                      <span className="history-item-copy">
                        <strong>{conversation.title || "A conversation"}</strong>
                        <small>{(conversation.messages || []).filter((m) => m.role === "user").length} messages</small>
                      </span>
                      <time>{formatDate(conversation.updatedAt)}</time>
                    </button>
                    {onDeleteConversation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Delete this conversation from your history?")) {
                            onDeleteConversation(conversation.id);
                          }
                        }}
                        title="Delete conversation"
                        style={{
                          background: "none",
                          border: "1px solid var(--line, #e2d9cd)",
                          borderRadius: "10px",
                          width: "36px",
                          height: "36px",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          color: "#991b1b",
                          fontSize: "14px"
                        }}
                        aria-label="Delete conversation"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="panel-footnote">
              {currentUser
                ? "All messages are securely synced to your Supabase cloud database under your user account."
                : "Sign in to synchronize your chat history across devices."}
            </p>
          </div>
        )}

        {panel === "profile" && (
          <form className="panel-body profile-form" onSubmit={saveProfile}>
            <p className="panel-intro">Add your details so your space feels personal.</p>
            <div className="profile-companion">
              <span className="profile-companion-image">
                {companion.avatar ? <img src={companion.avatar} alt={`${companion.name}, your companion`} /> : <span aria-hidden="true">{companion.name.slice(0, 1).toUpperCase()}</span>}
              </span>
              <span className="profile-companion-name">{companion.name}</span>
            </div>
            <label>
              Your name
              <input
                autoComplete="name"
                value={profile.name}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                placeholder="Your name"
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                disabled={!!currentUser}
                value={profile.email}
                onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
              />
            </label>
            {currentUser && (
              <p className="panel-footnote" style={{ marginTop: 0, color: "#166534" }}>
                ✓ Signed in with Supabase ({currentUser.email})
              </p>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button className="panel-primary" type="submit" style={{ flex: 1 }}>Save profile</button>
              {currentUser && (
                <button
                  className="panel-primary"
                  type="button"
                  onClick={handleSignOut}
                  style={{ background: "#7f1d1d", flex: 1 }}
                >
                  Log out
                </button>
              )}
            </div>
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
