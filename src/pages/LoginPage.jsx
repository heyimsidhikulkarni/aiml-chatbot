import { useState } from "react";
import { COMPANION_ROUTE } from "../config/site.js";
import { LogoIcon } from "../components/landing/icons.jsx";
import { supabase } from "../services/supabase.js";
import "../landing.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    const credentials = { email: email.trim(), password };
    const { error } = mode === "signup"
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setNotice(error.message);
      setSubmitting(false);
      return;
    }

    if (mode === "signup") {
      setNotice("Account created. Check your email if confirmation is enabled, then sign in.");
      setMode("login");
      setSubmitting(false);
      return;
    }

    try { localStorage.setItem("therapeutic_profile_email", credentials.email); }
    catch { /* Profile storage is optional. */ }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase
      .from("profiles")
      .select("companion_id, companion_name")
      .eq("id", user.id)
      .maybeSingle() : { data: null };
    window.location.hash = profile?.companion_id ? "#/chat" : COMPANION_ROUTE;
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
        <p className="login-kicker">{mode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}</p>
        <h1 id="login-title">{mode === "signup" ? "Create your space" : "Log in to your space"}</h1>
        <p className="login-copy">Sign in to choose a companion and start your own space.</p>
        <form onSubmit={handleSubmit}>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>
          <button className="lp-btn lp-btn--primary login-submit" type="submit" disabled={submitting}>{submitting ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}</button>
        </form>
        <button type="button" className="login-switch" onClick={() => { setNotice(""); setMode(mode === "login" ? "signup" : "login"); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
        {notice && <p className="login-notice" role="status">{notice}</p>}
      </section>
    </main>
  );
}
