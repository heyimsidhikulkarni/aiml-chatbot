# ============================================================
# NEW CELL — RUN THIS AT THE END OF YOUR NOTEBOOK
# Exposes your existing chatbot() function as an API
# so the React frontend can talk to it.
# ============================================================
# Run it AFTER all your other cells (it uses chatbot(),
# check_crisis_keywords() and conversation_memory defined there).

!pip install -q flask flask-cors pyngrok

import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from pyngrok import ngrok

# Free token from https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTH_TOKEN = "PASTE_YOUR_NGROK_TOKEN_HERE"

app = Flask(__name__)
CORS(app)  # allow the browser page to call this API


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required"}), 400

    reply = chatbot(message)  # your function from the notebook

    return jsonify({
        "reply": reply,
        "is_crisis": check_crisis_keywords(message)
    })


@app.route("/reset", methods=["POST"])
def reset():
    # Clears the shared conversation memory (the "New chat" button)
    conversation_memory["messages"] = []
    return jsonify({"status": "cleared"})


# Start Flask in a background thread so the notebook stays usable
threading.Thread(
    target=lambda: app.run(host="0.0.0.0", port=5000, use_reloader=False),
    daemon=True
).start()

# Public URL for the frontend
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
public_url = ngrok.connect(5000).public_url

print("=" * 60)
print("Backend is running. Paste this URL into the frontend")
print("(Connection -> Backend URL):")
print(public_url)
print("=" * 60)
