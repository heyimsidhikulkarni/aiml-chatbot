import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ChooseCompanionPage from "./pages/ChooseCompanionPage.jsx";

// Tiny hash router (no extra dependency).
function getRoute() {
  if (window.location.hash.startsWith("#/chat")) return "chat";
  if (window.location.hash.startsWith("#/login")) return "login";
  if (window.location.hash.startsWith("#/choose-companion")) return "choose-companion";
  return "home";
}

export default function App() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onChange = () => {
      const next = getRoute();
      setRoute((prev) => {
        if (prev !== next) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (route === "chat") return <ChatPage />;
  if (route === "login") return <LoginPage />;
  if (route === "choose-companion") return <ChooseCompanionPage />;
  return <LandingPage />;
}
