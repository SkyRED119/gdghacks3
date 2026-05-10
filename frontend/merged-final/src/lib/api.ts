// ─── Base URL (set in .env.local) ────────────────────────────────────────────
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

  // Outline upload
  uploadOutline: (assignments: OutlineAssignment[]) =>
    authFetch("/api/assignments/sync", {
      method: "POST",
      body: JSON.stringify({ assignments }),
    }),

  // Game boss fight
  gameStart: () =>
    authFetch("/api/game/start", { method: "POST", body: JSON.stringify({}) }),
  gameAction: (sessionId: string, action: string) =>
    authFetch("/api/game/action", {
      method: "POST",
      body: JSON.stringify({ sessionId, action }),
    }),
  gameState: (sessionId: string) => authFetch(`/api/game/state/${sessionId}`),

  // Quest Arena — gems, armor, unlocks, pending grades
  questArenaGet: () => authFetch("/api/game/me") as Promise<QuestArenaState>,
  questArenaSave: (state: QuestArenaState) =>
    authFetch("/api/game/me", {
      method: "PUT",
      body: JSON.stringify(state),
    }) as Promise<QuestArenaState>,
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type ArmorColor = "silver" | "red" | "blue" | "gold" | "black";
export type ArmorSlot = "head" | "chest" | "legs";

export interface PendingGrade {
  id: number;
  name: string;
  percent: number;
}

export interface QuestArenaState {
  gems: number;
  armor: Record<ArmorSlot, ArmorColor>;
  unlocks: Record<ArmorSlot, ArmorColor[]>;
  pendingGrades: PendingGrade[];
}

export interface OutlineAssignment {
  id: string;
  courseId?: string;
  course?: string;
  title: string;
  dueDate?: string;
  status?: string;
  priority?: number;
  source?: string;
}
