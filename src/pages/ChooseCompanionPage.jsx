import { useState } from "react";
import { CHAT_ROUTE } from "../config/site.js";
import "../landing.css";
import companion01 from "../assets/companions/companion-01.png";
import companion02 from "../assets/companions/companion-02.png";
import companion03 from "../assets/companions/companion-03.png";
import companion04 from "../assets/companions/companion-04.png";
import companion05 from "../assets/companions/companion-05.png";
import companion06 from "../assets/companions/companion-06.png";
import companion07 from "../assets/companions/companion-07.png";
import companion08 from "../assets/companions/companion-08.png";
import companion09 from "../assets/companions/companion-09.png";
import companion10 from "../assets/companions/companion-10.png";
import companion11 from "../assets/companions/companion-11.png";
import companion12 from "../assets/companions/companion-12.png";
import companion13 from "../assets/companions/companion-13.png";
import companion14 from "../assets/companions/companion-14.png";
import companion15 from "../assets/companions/companion-15.png";
import companion16 from "../assets/companions/companion-16.png";

const COMPANION_IMAGES = [
  companion01, companion02, companion03, companion04, companion05, companion06, companion07, companion08,
  companion09, companion10, companion11, companion12, companion13, companion14, companion15, companion16
];
const COMPANIONS = COMPANION_IMAGES.map((image, index) => ({
  id: `companion-${String(index + 1).padStart(2, "0")}`,
  image,
  label: `Character ${index + 1}`
}));

export default function ChooseCompanionPage() {
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");

  function startChat() {
    if (!selected) return;
    const companion = COMPANIONS.find((item) => item.id === selected);
    try {
      localStorage.setItem("companionName", name.trim() || "mello");
      localStorage.setItem("companionAvatar", companion.image);
    } catch { /* The chat can still start if local storage is unavailable. */ }
    window.location.hash = CHAT_ROUTE;
  }

  function skipNaming() {
    setName("mello");
  }

  return (
    <main className="lp login-page choose-page">
      <header className="lp-nav login-nav">
        <div className="lp-nav__inner">
          <a className="lp-nav__wordmark" href="#/" aria-label="Mello home"><img src="/brand/mello-logo.png" alt="Mello" /></a>
          <a className="lp-nav__link login-home" href="#/login">Back to sign in</a>
        </div>
      </header>
      <section className="choose-card" aria-labelledby="choose-title">
        <p className="login-kicker">MAKE IT YOURS</p>
        <h1 id="choose-title">Choose your companion</h1>
        <p className="login-copy">Pick the character you’d like by your side. You can give them a name, too.</p>

        <div className="companion-grid" role="group" aria-label="Choose a character">
          {COMPANIONS.map((companion) => (
            <button
              className={`companion-option${selected === companion.id ? " is-selected" : ""}`}
              key={companion.id}
              type="button"
              aria-label={companion.label}
              aria-pressed={selected === companion.id}
              onClick={() => setSelected(companion.id)}
            >
              <img src={companion.image} alt="" />
              <span>{companion.label}</span>
            </button>
          ))}
        </div>

        <label className="companion-name-field" htmlFor="companion-name">What would you like to call them?</label>
        <div className="companion-name-row">
          <input id="companion-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Type a name or skip" />
          <button className="name-skip" type="button" onClick={skipNaming}>Skip naming</button>
        </div>
        <button className="lp-btn lp-btn--primary choose-start" type="button" disabled={!selected} onClick={startChat}>Get Started</button>
        {!selected && <p className="choose-hint" role="status">Choose a character to continue.</p>}
      </section>
    </main>
  );
}
