import { AUTH_ROUTE, CHAT_ROUTE } from "../../config/site.js";

export default function FinalCTA({ isLoggedIn = false }) {
  return (
    <section className="lp-section lp-section--narrow lp-cta" aria-labelledby="cta-title">
      <h2 id="cta-title" className="lp-h2">{isLoggedIn ? "Ready to continue?" : "Ready to Meet Your Companion?"}</h2>
      <p className="lp-lead">
        {isLoggedIn ? "Pick up where you left off and talk through whatever is on your mind." : "Choose your character, give them a name, and start with whatever is on your mind."}
      </p>
      <a className="lp-btn lp-btn--primary" href={isLoggedIn ? CHAT_ROUTE : AUTH_ROUTE}>{isLoggedIn ? "Continue" : "Get Started"}</a>
    </section>
  );
}
