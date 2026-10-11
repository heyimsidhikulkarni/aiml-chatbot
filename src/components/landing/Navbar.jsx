import { useEffect, useState } from "react";
import { AUTH_ROUTE, CONTACT_HREF, LOGIN_ROUTE } from "../../config/site.js";
import { scrollToSection } from "./scrollToSection.js";

const LINKS = [
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "About Us", id: "features" },
  { label: "Contact", id: "contact", href: CONTACT_HREF }
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleLink(e, link) {
    setOpen(false);
    if (link.href) return; // external / explicit destination: let the browser navigate
    e.preventDefault();
    scrollToSection(link.id);
  }

  return (
    <header className="lp-nav">
      <div className="lp-nav__inner">
        <a className="lp-nav__wordmark" href="#/" aria-label="Mello home">
          <img src="/brand/mello-logo.png" alt="Mello" />
        </a>

        <nav
          id="lp-nav-links"
          className={"lp-nav__links" + (open ? " is-open" : "")}
          aria-label="Main"
        >
          {LINKS.map((link) => (
            <a
              key={link.label}
              className="lp-nav__link"
              href={link.href || "#" + link.id}
              onClick={(e) => handleLink(e, link)}
            >
              {link.label}
            </a>
          ))}
          <a className="lp-btn lp-btn--primary lp-btn--sm lp-nav__cta-mobile" href={AUTH_ROUTE}>
            Get Started
          </a>
          <a className="lp-btn lp-btn--outline lp-btn--sm lp-nav__login-mobile" href={LOGIN_ROUTE}>Log in</a>
        </nav>

        <div className="lp-nav__actions">
          <a className="lp-btn lp-btn--outline lp-btn--sm lp-nav__login" href={LOGIN_ROUTE}>Log in</a>
          <a className="lp-btn lp-btn--primary lp-btn--sm lp-nav__cta" href={AUTH_ROUTE}>Get Started</a>
        </div>

        <button
          type="button"
          className="lp-nav__toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="lp-nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true" className={"lp-burger" + (open ? " is-open" : "")}>
            <i /><i /><i />
          </span>
        </button>
      </div>
    </header>
  );
}
