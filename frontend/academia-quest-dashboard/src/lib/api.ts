// ─── Base URL (set in .env.local) ────────────────────────────────────────────
// Remove trailing slash so all paths work cleanly
const API = (import.meta.env.VITE_API_URL as string).replace(/\/$/, "");

// ─── Token helpers ────────────────────────────────────────────────────────────
export function getToken() {
  return localStorage.getItem("aq_token");
}
export function setToken(token: string) {
  localStorage.setItem("aq_token", token);
}
export function clearToken() {
  localStorage.removeItem("aq_token");
}

// ─── Authenticated fetch ──────────────────────────────────────────────────────
async function authFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// ─── API surface ──────────────────────────────────────────────────────────────
export const api = {
  // Auth
  googleAuth: async (idToken: string) => {
    const res = await fetch(`${API}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Auth failed: ${res.status}: ${text}`);
    }
    return res.json();
  },

  // User
  me: () => authFetch("/api/me"),

  // Assignments
  assignments: () => authFetch("/api/assignments"),
  completeAssignment: (assignmentId: string) =>
    authFetch("/api/assignments/complete", {
      method: "POST",
      body: JSON.stringify({ assignmentId }),
    }),

  // Grades
  grades: () => authFetch("/api/grades"),

  // ── Mock Outline upload ──────────────────────────────────────────────────
  // POST /api/outline/upload  { assignments: AssignmentIn[] }
  // Returns { ok: true, upserted: number }
  // The backend treats these as normal assignment upserts (user-specific).
  uploadOutline: (assignments: OutlineAssignment[]) =>
    authFetch("/api/assignments/sync", {
      method: "POST",
      body: JSON.stringify({ assignments }),
    }),

  // ── Game endpoints (ready when backend adds them) ────────────────────────
  // POST /api/game/start  → { sessionId, boss, playerHp, bossHp }
  gameStart: () =>
    authFetch("/api/game/start", { method: "POST", body: JSON.stringify({}) }),

  // POST /api/game/action  { sessionId, action: "attack"|"defend"|"skill" }
  gameAction: (sessionId: string, action: string) =>
    authFetch("/api/game/action", {
      method: "POST",
      body: JSON.stringify({ sessionId, action }),
    }),

  // GET /api/game/state/:sessionId
  gameState: (sessionId: string) => authFetch(`/api/game/state/${sessionId}`),
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OutlineAssignment {
  id: string;
  courseId?: string;
  course?: string;
  title: string;
  dueDate?: string;   // ISO string e.g. "2026-03-14"
  status?: string;    // "pending"
  priority?: number;  // 0-100 grade weight
  source?: string;    // "outline"
}
