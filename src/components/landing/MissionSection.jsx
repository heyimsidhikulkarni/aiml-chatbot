import { AUTH_ROUTE } from "../../config/site.js";

export default function MissionSection() {
  return (
    <section id="about" className="lp-section lp-section--narrow" aria-labelledby="mission-title">
      <h2 id="mission-title" className="lp-h2">Everyone Deserves a Space to Talk</h2>
      <p className="lp-lead">
        Life can feel overwhelming sometimes. Our goal is to make it easier to express your
        thoughts, reflect on everyday challenges, and explore small steps forward through
        supportive AI conversations.
      </p>
      <a className="lp-btn lp-btn--primary" href={AUTH_ROUTE}>Meet Your Companion</a>
    </section>
  );
}
