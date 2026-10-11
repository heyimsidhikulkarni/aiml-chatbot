const STEPS = [
  { n: "01", title: "Create Your Account", text: "Sign up and make your own space." },
  {
    n: "02",
    title: "Choose Your Character",
    text: "Pick one of six characters and give your companion a name."
  },
  {
    n: "03",
    title: "Start Talking",
    text: "Share what's on your mind and explore supportive responses at your own pace."
  }
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="lp-section" aria-labelledby="how-title">
      <h2 id="how-title" className="lp-h2">Your Space, Your Companion</h2>
      <ol className="lp-steps">
        {STEPS.map((s) => (
          <li key={s.n} className="lp-step">
            <span className="lp-step__num" aria-hidden="true">{s.n}</span>
            <h3 className="lp-step__title">
              <span className="lp-sr">Step {s.n}: </span>
              {s.title}
            </h3>
            <p className="lp-step__text">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
