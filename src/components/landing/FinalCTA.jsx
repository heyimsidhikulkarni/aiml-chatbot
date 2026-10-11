import { AUTH_ROUTE } from "../../config/site.js";

export default function FinalCTA() {
  return (
    <section className="lp-section lp-section--narrow lp-cta" aria-labelledby="cta-title">
      <h2 id="cta-title" className="lp-h2">Ready to Meet Your Companion?</h2>
      <p className="lp-lead">
        Choose your character, give them a name, and start with whatever is on your mind.
      </p>
      <a className="lp-btn lp-btn--primary" href={AUTH_ROUTE}>Get Started</a>
    </section>
  );
}
