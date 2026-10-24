import { useState } from "react";
import { COMPANION_ROUTE } from "../config/site.js";
import { LogoIcon } from "../components/landing/icons.jsx";
import { supabase } from "../config/supabase.js";
import "../landing.css";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice("");
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data?.user?.identities?.length === 0) {
          setError("An account with this email already exists. Please log in.");
          return;
        }

        try {
          const profileEmail = data?.user?.email || email.trim();
          localStorage.setItem("therapeutic_profile_email", profileEmail);
          localStorage.setItem("therapeutic_profile_name", profileEmail.split("@")[0]);
        } catch { /* storage fallback */ }

        if (data?.session) {
          window.location.hash = COMPANION_ROUTE;
        } else {
          setNotice("Account created! If email confirmation is enabled, please check your inbox to verify your account.");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        try {
          const profileEmail = data?.user?.email || email.trim();
          localStorage.setItem("therapeutic_profile_email", profileEmail);
          localStorage.setItem("therapeutic_profile_name", profileEmail.split("@")[0]);
        } catch { /* storage fallback */ }

        window.location.hash = COMPANION_ROUTE;
      }
    } catch (err) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lp login-page">
      <header className="lp-nav login-nav">
        <div className="lp-nav__inner">
          <a className="lp-nav__wordmark" href="#/" aria-label="Mello home">
            <img src="/brand/mello-logo.png" alt="Mello" />
          </a>
          <a className="lp-nav__link login-home" href="#/">Back to home</a>
        </div>
      </header>
      <section className="login-card" aria-labelledby="login-title">
        <span className="login-mark" aria-hidden="true"><LogoIcon /></span>
        <p className="login-kicker">{isSignUp ? "JOIN MELLO" : "WELCOME BACK"}</p>
        <h1 id="login-title">{isSignUp ? "Create your space" : "Log in to your space"}</h1>
        <p className="login-copy">
          {isSignUp
            ? "Sign up with your email and password to start your personalized journey."
            : "Sign in to choose a companion and start your own space."}
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSignUp ? "At least 6 characters" : "Your password"}
            />
          </label>
          <button className="lp-btn lp-btn--primary login-submit" type="submit" disabled={loading}>
            {loading ? (isSignUp ? "Creating account..." : "Logging in...") : (isSignUp ? "Sign up" : "Log in")}
          </button>
        </form>

        {notice && <p className="login-notice" role="status">{notice}</p>}
        {error && (
          <p className="login-notice" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }} role="alert">
            {error}
          </p>
        )}

        <p className="login-small">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(""); setNotice(""); }}
                style={{ background: "none", border: "none", color: "inherit", font: "inherit", fontWeight: 800, textDecoration: "underline", cursor: "pointer", padding: 0 }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(""); setNotice(""); }}
                style={{ background: "none", border: "none", color: "inherit", font: "inherit", fontWeight: 800, textDecoration: "underline", cursor: "pointer", padding: 0 }}
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
