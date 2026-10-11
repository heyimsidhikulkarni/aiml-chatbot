import { AUTH_ROUTE, CHAT_ROUTE } from "../../config/site.js";
import HeroCharacterVideo from "./HeroCharacterVideo.jsx";
import FloatingCharacters from "./FloatingCharacters.jsx";

export default function HeroSection() {
  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <FloatingCharacters />
      <h1 id="hero-title" className="lp-hero__title">
        Your Personal AI Companion for Life’s Ups and Downs
      </h1>
      <p className="lp-hero__sub">
        A little space to share your thoughts, talk through life's challenges, and find your next
        small step. Meet your companion and start a conversation at your own pace.
      </p>
      <div className="lp-hero__actions">
        <a className="lp-btn lp-btn--primary" href={AUTH_ROUTE}>
          Meet Your Companion
        </a>
        <a className="lp-btn lp-btn--outline" href={CHAT_ROUTE}>Try Mello</a>
      </div>
      <HeroCharacterVideo />
    </section>
  );
}
