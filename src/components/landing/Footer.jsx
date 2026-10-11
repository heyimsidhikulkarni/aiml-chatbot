import { LogoIcon } from "./icons.jsx";
import { CONTACT_HREF, PRIVACY_HREF, SITE_NAME } from "../../config/site.js";
import { scrollToSection } from "./scrollToSection.js";

export default function Footer() {
  const go = (id) => (e) => {
    e.preventDefault();
    scrollToSection(id);
  };

  return (
    <footer id="contact" className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__top">
          <a className="lp-footer__brand" href="#/" aria-label={SITE_NAME + " home"}>
            <LogoIcon size={28} />
            <span>{SITE_NAME}</span>
          </a>
          <nav className="lp-footer__links" aria-label="Footer">
            <a href="#features" onClick={go("features")}>Features</a>
            <a href="#features" onClick={go("features")}>About Us</a>
            {CONTACT_HREF ? (
              <a href={CONTACT_HREF}>Contact</a>
            ) : (
              <a href="#contact" onClick={go("contact")}>Contact</a>
            )}
            {PRIVACY_HREF && <a href={PRIVACY_HREF}>Privacy Policy</a>}
          </nav>
        </div>
        <p className="lp-footer__disclaimer">
          This chatbot offers general emotional support and is not a substitute for professional
          mental health care.
        </p>
      </div>
    </footer>
  );
}
