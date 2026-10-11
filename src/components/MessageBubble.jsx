import CompanionAvatar from "./CompanionAvatar.jsx";

export default function MessageBubble({ message, companion }) {
  const { role, content, crisis, error, time } = message;

  if (role === "user") {
    return (
      <div className="message-group user-group">
        <div className="row user"><div className="bubble user">{content}</div></div>
        {time && <div className="meta user-meta">{time}</div>}
      </div>
    );
  }

  const classes = ["bubble", "bot", crisis ? "crisis" : "", error ? "error" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="assistant-message">
      <CompanionAvatar name={companion.name} avatar={companion.avatar} className="avatar message-avatar" />
      <div className="assistant-content">
        <span className="message-author">{companion.name}</span>
        <div className={classes}>{content}</div>
        {time && <div className="meta">{time}</div>}
      </div>
    </div>
  );
}
