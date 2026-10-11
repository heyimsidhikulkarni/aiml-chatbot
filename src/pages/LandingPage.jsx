import "../landing.css";
import Navbar from "../components/landing/Navbar.jsx";
import HeroSection from "../components/landing/HeroSection.jsx";
import FeaturesSection from "../components/landing/FeaturesSection.jsx";
import HowItWorksSection from "../components/landing/HowItWorksSection.jsx";
import FinalCTA from "../components/landing/FinalCTA.jsx";
import Footer from "../components/landing/Footer.jsx";

export default function LandingPage() {
  return (
    <div className="lp">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
