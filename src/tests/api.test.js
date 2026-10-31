/**
 * Tests for src/services/api.js
 *
 * Uses vi.stubGlobal("fetch", ...) to avoid real HTTP calls.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Supabase mock (provides session token) ───────────────────────────────────

vi.mock("../config/supabase.js", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: "test-jwt-token" } } }),
    },
  },
}));

// ── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ── Import after mocks are set up ────────────────────────────────────────────

const { sendMessage, resetChat, checkHealth, getAuthToken } = await import(
  "../services/api.js"
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getAuthToken", () => {
  it("returns the token from the current session", async () => {
    const token = await getAuthToken();
    expect(token).toBe("test-jwt-token");
  });
});

describe("sendMessage", () => {
  it("POSTs to /chat with message, conversation_id, and companion", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: "Hello there!", is_crisis: false }),
    });

    const result = await sendMessage("Hi", "conv-123", "Milo");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];

    expect(url).toContain("/chat");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.message).toBe("Hi");
    expect(body.conversation_id).toBe("conv-123");
    expect(body.companion).toBe("Milo");

    expect(result).toEqual({ reply: "Hello there!", is_crisis: false });
  });

  it("includes Authorization header with Bearer token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: "OK", is_crisis: false }),
    });

    await sendMessage("test", "conv-abc");
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer test-jwt-token");
  });

  it("throws when server returns a non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(sendMessage("msg", "conv-1")).rejects.toThrow("Server returned 401");
  });

  it("throws on 500 server error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(sendMessage("msg", "conv-2")).rejects.toThrow("Server returned 500");
  });
});

describe("resetChat", () => {
  it("POSTs to /reset with the correct conversation_id", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    await resetChat("conv-456");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];

    expect(url).toContain("/reset");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).conversation_id).toBe("conv-456");
    expect(opts.headers["Authorization"]).toBe("Bearer test-jwt-token");
  });

  it("does not throw when the backend is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(resetChat("conv-789")).resolves.toBeUndefined();
  });

  it("does not clear other conversations — only sends the specified ID", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    await resetChat("conv-only-this-one");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.conversation_id).toBe("conv-only-this-one");
    // Only one request was made — no other conversations affected
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("checkHealth", () => {
  it("returns true when backend responds ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await checkHealth()).toBe(true);
  });

  it("returns false when backend responds with error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await checkHealth()).toBe(false);
  });

  it("returns false when fetch throws (network unreachable)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await checkHealth()).toBe(false);
  });
});

describe("Authorization — cross-conversation isolation", () => {
  it("each sendMessage call carries the current user JWT (not a hardcoded user_id)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "ok", is_crisis: false }),
    });

    await sendMessage("msg 1", "conv-A");
    await sendMessage("msg 2", "conv-B");

    const calls = mockFetch.mock.calls;
    expect(calls).toHaveLength(2);

    // Both calls must carry the auth token — user ID is never in the body
    for (const [, opts] of calls) {
      expect(opts.headers["Authorization"]).toBe("Bearer test-jwt-token");
      const body = JSON.parse(opts.body);
      expect(body).not.toHaveProperty("user_id");
    }

    // And they must use different conversation IDs
    const ids = calls.map(([, opts]) => JSON.parse(opts.body).conversation_id);
    expect(ids[0]).toBe("conv-A");
    expect(ids[1]).toBe("conv-B");
  });
});
