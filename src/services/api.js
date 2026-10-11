// Connects the frontend to the Flask backend running in Colab (via ngrok)
// or on localhost. Endpoints: GET /health, POST /chat, POST /reset.

const ENV_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const clean = (url) => url.trim().replace(/\/+$/, "");

export function getApiUrl() {
  return clean(ENV_URL);
}

// The ngrok header skips ngrok's browser warning page on free tunnels.
const headers = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true"
};

export async function checkHealth() {
  try {
    const res = await fetch(getApiUrl() + "/health", { headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendMessage(message) {
  const res = await fetch(getApiUrl() + "/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error("Server returned " + res.status);
  return res.json(); // { reply: string, is_crisis: boolean }
}

export async function resetChat() {
  try {
    await fetch(getApiUrl() + "/reset", { method: "POST", headers });
  } catch {
    /* backend unreachable: nothing to reset */
  }
}
