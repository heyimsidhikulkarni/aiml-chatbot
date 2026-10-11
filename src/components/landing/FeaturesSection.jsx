import {
  ChatIcon,
  CompanionIcon,
  HeartIcon,
  StepsIcon,
  LayersIcon,
  ShieldIcon
} from "./icons.jsx";

const FEATURES = [
  {
    Icon: ChatIcon,
    title: "Personalized Conversations",
    text: "Get thoughtful, supportive responses that follow the flow of your conversation."
  },
  {
    Icon: CompanionIcon,
    title: "Your Own Companion",
    text: "Choose your favorite character, give them a name, and make your space feel like yours."
  },
  {
    Icon: HeartIcon,
    title: "A Space Without Judgment",
    text: "Talk about everyday worries, academic pressure, loneliness, or whatever is on your mind."
  },
  {
    Icon: StepsIcon,
    title: "Practical Coping Strategies",
    text: "Explore small, practical steps to help you navigate stressful moments."
  },
  {
    Icon: LayersIcon,
    title: "Conversation Context",
    text: "Continue conversations with relevant context when conversation history is available."
  },
  {
    Icon: ShieldIcon,
    title: "Supportive by Design",
    text: "Find a welcoming space for general emotional support, without diagnosis or judgment."
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="lp-section" aria-labelledby="features-title">
      <h2 id="features-title" className="lp-h2">A Little Support Goes a Long Way</h2>
      <ul className="lp-features">
        {FEATURES.map(({ Icon, title, text }) => (
          <li key={title} className="lp-feature">
            <span className="lp-feature__icon"><Icon /></span>
            <h3 className="lp-feature__title">{title}</h3>
            <p className="lp-feature__text">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
