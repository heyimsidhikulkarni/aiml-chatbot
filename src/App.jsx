import { useEffect, useState } from "react";
import LandingPage from "./pages/LandingPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ChooseCompanionPage from "./pages/ChooseCompanionPage.jsx";
import { supabase } from "./services/supabase.js";

// Tiny hash router (no extra dependency).
function getRoute() {
  if (window.location.hash.startsWith("#/chat")) return "chat";
  if (window.location.hash.startsWith("#/login")) return "login";
  if (window.location.hash.startsWith("#/choose-companion")) return "choose-companion";
  return "home";
}

export default function App() {
  const [route, setRoute] = useState(getRoute());
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setProfile(undefined);
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("companion_id, companion_name, display_name")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setProfile(error ? null : data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => { cancelled = true; };
  }, [session, route]);

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

  if (session === undefined) return null;

  if (route === "login") return <LoginPage />;
  if (session && profile === undefined) return null;

  if (!session && (route === "chat" || route === "choose-companion")) return <LoginPage />;
  if (session && profile?.companion_id && route === "choose-companion") return <ChatPage />;

  if (route === "chat") return <ChatPage />;
  if (route === "choose-companion") return <ChooseCompanionPage />;
  return <LandingPage isLoggedIn={Boolean(session)} />;
}
