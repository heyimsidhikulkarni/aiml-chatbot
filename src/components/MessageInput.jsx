import { useState } from "react";

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState("");

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer-shell">
      <div className="composer">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tell me what's on your mind..."
          aria-label="Message"
        />
        <button className="send" onClick={submit} disabled={disabled || !text.trim()} aria-label="Send message">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7" /></svg>
        </button>
      </div>
      <p className="disclaimer">
        This chatbot offers general emotional support and is not a substitute for professional mental health care.
      </p>
    </div>
  );
}
