import "../landing.css";
import Navbar from "../components/landing/Navbar.jsx";
import HeroSection from "../components/landing/HeroSection.jsx";
import FeaturesSection from "../components/landing/FeaturesSection.jsx";
import HowItWorksSection from "../components/landing/HowItWorksSection.jsx";
import FinalCTA from "../components/landing/FinalCTA.jsx";
import Footer from "../components/landing/Footer.jsx";

export default function LandingPage({ isLoggedIn = false }) {
  return (
    <div className="lp">
      <Navbar isLoggedIn={isLoggedIn} />
      <main>
        <HeroSection isLoggedIn={isLoggedIn} />
        <FeaturesSection />
        <HowItWorksSection />
        <FinalCTA isLoggedIn={isLoggedIn} />
      </main>
      <Footer />
    </div>
  );
}
