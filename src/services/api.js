// Connects the frontend to the Flask backend running in Colab (via ngrok)
// or on localhost. Endpoints: GET /health, POST /chat, POST /reset.

import { supabase } from "../config/supabase.js";

const ENV_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const clean = (url) => url.trim().replace(/\/+$/, "");

export function getApiUrl() {
  return clean(ENV_URL);
}

// The ngrok header skips ngrok's browser warning page on free tunnels.
const baseHeaders = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

/**
 * Retrieve the current Supabase session JWT.
 * Returns the token string, or null if the user is not authenticated.
 */
export async function getAuthToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Build request headers, injecting the Supabase JWT as a Bearer token.
 * Always call this right before each request so the token is fresh.
 */
async function authHeaders() {
  const token = await getAuthToken();
  return {
    ...baseHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function checkHealth() {
  try {
    const res = await fetch(getApiUrl() + "/health", { headers: baseHeaders });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a user message to the Flask backend.
 *
 * @param {string} message        – The user's text
 * @param {string} conversationId – Stable UUID for the current conversation
 * @param {string} [companion]    – Companion name (e.g. "Milo")
 * @returns {{ reply: string, is_crisis: boolean }}
 */
export async function sendMessage(message, conversationId, companion = "Milo") {
  const headers = await authHeaders();
  const res = await fetch(getApiUrl() + "/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ message, conversation_id: conversationId, companion }),
  });
  if (!res.ok) throw new Error("Server returned " + res.status);
  return res.json(); // { reply: string, is_crisis: boolean }
}

/**
 * Reset the in-process cache for a specific conversation.
 * Does NOT delete data from Supabase — previous conversations remain intact.
 *
 * @param {string} conversationId – The conversation whose cache to clear
 */
export async function resetChat(conversationId) {
  try {
    const headers = await authHeaders();
    await fetch(getApiUrl() + "/reset", {
      method: "POST",
      headers,
      body: JSON.stringify({ conversation_id: conversationId }),
    });
  } catch {
    /* backend unreachable: nothing to reset */
  }
}
