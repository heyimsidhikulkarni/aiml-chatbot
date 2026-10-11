import CompanionAvatar, { getCompanion } from "./CompanionAvatar.jsx";

export default function Header({ status, onNewChat, onOpenPanel, profileName = "Profile" }) {
  const companion = getCompanion();

  return (
    <header className="header">
      <a className="chat-wordmark" href="#/" aria-label="Mello home"><img src="/brand/mello-logo.png" alt="Mello" /></a>
      <div className="header-companion">
        <CompanionAvatar name={companion.name} avatar={companion.avatar} />
        <span className="companion-copy">
          <span className="companion-name">{companion.name}</span>
          <span className="status"><span className={`dot ${status === "online" ? "ok" : status === "offline" ? "bad" : ""}`} />{status === "online" ? "Here with you" : status === "offline" ? "Reconnecting" : "Getting ready"}</span>
        </span>
      </div>
      <div className="header-actions">
        <button className="btn utility-btn" onClick={() => onOpenPanel("history")} aria-label="Open conversation history"><span aria-hidden="true">◷</span><span>History</span></button>
        <button className="btn utility-btn" onClick={() => onOpenPanel("help")}><span aria-hidden="true">?</span><span>Help</span></button>
        <button className="btn new-chat" onClick={onNewChat} aria-label="Start a new chat">
          <span aria-hidden="true">＋</span><span>New chat</span>
        </button>
        <button className="btn profile-btn" onClick={() => onOpenPanel("profile")}><span className="profile-mark" aria-hidden="true">{profileName === "Profile" ? "♙" : profileName.slice(0, 1).toUpperCase()}</span><span>{profileName}</span></button>
      </div>
    </header>
  );
}
