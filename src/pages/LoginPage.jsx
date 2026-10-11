import { useState } from "react";
import { COMPANION_ROUTE } from "../config/site.js";
import { LogoIcon } from "../components/landing/icons.jsx";
import "../landing.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (password !== "1234") {
      setNotice("For this demo, use any email address and the password 1234.");
      return;
    }
    try {
      localStorage.setItem("therapeutic_profile_email", email.trim());
      localStorage.setItem("therapeutic_profile_name", email.trim().split("@")[0]);
    } catch { /* Continue to the demo companion setup if storage is unavailable. */ }
    window.location.hash = COMPANION_ROUTE;
  }

  return (
    <main className="lp login-page">
      <header className="lp-nav login-nav">
        <div className="lp-nav__inner">
          <a className="lp-nav__wordmark" href="#/" aria-label="Mello home"><img src="/brand/mello-logo.png" alt="Mello" /></a>
          <a className="lp-nav__link login-home" href="#/">Back to home</a>
        </div>
      </header>
      <section className="login-card" aria-labelledby="login-title">
        <span className="login-mark" aria-hidden="true"><LogoIcon /></span>
        <p className="login-kicker">WELCOME BACK</p>
        <h1 id="login-title">Log in to your space</h1>
        <p className="login-copy">Sign in to choose a companion and start your own space.</p>
        <form onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
          <button className="lp-btn lp-btn--primary login-submit" type="submit">Log in</button>
        </form>
        {notice && <p className="login-notice" role="status">{notice}</p>}
      </section>
    </main>
  );
}
