/**
 * background.js
 * Service worker — the brain of the extension.
 *
 * Handles:
 *   - Receiving messages from content.js
 *   - Storing/deduplicating assignments + grades in chrome.storage.local
 *   - Computing priority scores
 *   - Syncing to the FastAPI backend
 *   - Calculating XP, streaks, levels
 */

"use strict";

const LOG = (...a) => console.log("[AQ-bg]", ...a);

// ─── Configuration ─────────────────────────────────────────────────────────

const CONFIG = {
  API_BASE: "http://localhost:8000",
  SYNC_INTERVAL_MINUTES: 30,
  XP_TABLE: {
    complete_early: 150,
    complete_ontime: 100,
    complete_late: 40,
    streak_day: 25,
    new_assignment_synced: 5,
    grade_A: 200,
    grade_B: 100,
    grade_C: 50,
  },
};

// ─── Storage helpers ───────────────────────────────────────────────────────

async function storageGet(key) {
  return new Promise((res) => chrome.storage.local.get(key, (r) => res(r[key])));
}

async function storageSet(key, value) {
  return new Promise((res) => chrome.storage.local.set({ [key]: value }, res));
}

async function getAllAssignments() {
  return (await storageGet("assignments")) ?? {};
}

async function getAllGrades() {
  return (await storageGet("grades")) ?? {};
}

async function getState() {
  return (await storageGet("state")) ?? {
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: null,
    userId: null,
    userName: null,
  };
}

async function setState(partial) {
  const current = await getState();
  await storageSet("state", { ...current, ...partial });
}

// ─── Priority formula ──────────────────────────────────────────────────────

/**
 * priority = weight × urgency × difficulty
 * We estimate weight and difficulty from title keywords.
 * Urgency = 1/daysUntilDue (clamped to avoid division by zero).
 */
function computePriority(assignment) {
  const now = new Date();

  // Urgency
  let urgency = 0.5; // default if no due date
  if (assignment.dueDate) {
    const due = new Date(assignment.dueDate);
    const daysLeft = Math.max((due - now) / 86400000, 0.1);
    urgency = Math.min(10 / daysLeft, 10); // max 10
  }

  // Difficulty estimate from keywords (faked for MVP)
  const title = (assignment.title ?? "").toLowerCase();
  let difficulty = 1.0;
  if (/exam|midterm|final|test/i.test(title)) difficulty = 3.0;
  else if (/report|essay|paper|project/i.test(title)) difficulty = 2.5;
  else if (/assignment|lab|quiz/i.test(title)) difficulty = 1.5;

  // Weight estimate (everything equal for now)
  const weight = 1.0;

  return Math.round(weight * urgency * difficulty * 10) / 10;
}

// ─── XP helpers ───────────────────────────────────────────────────────────

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.4, level - 1));
}

async function awardXP(reason, amount) {
  const state = await getState();
  let { xp, level } = state;

  xp += amount;

  // Level up
  while (xp >= xpForLevel(level + 1)) {
    xp -= xpForLevel(level + 1);
    level += 1;
    LOG(`Level up! → ${level}`);
    showNotification("Level Up! 🎉", `You reached Level ${level}!`);
  }

  await setState({ xp, level });

  // Track XP event
  const events = (await storageGet("xpEvents")) ?? [];
  events.push({ reason, amount, ts: Date.now() });
  if (events.length > 200) events.splice(0, events.length - 200); // keep last 200
  await storageSet("xpEvents", events);

  LOG(`+${amount} XP (${reason}) → total: ${xp}, level: ${level}`);
}

async function updateStreak() {
  const state = await getState();
  const today = new Date().toISOString().split("T")[0];

  if (state.lastActiveDate === today) return; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const newStreak = state.lastActiveDate === yesterday ? state.streak + 1 : 1;

  await setState({ streak: newStreak, lastActiveDate: today });
  await awardXP("streak_day", CONFIG.XP_TABLE.streak_day * newStreak);

  if (newStreak > 1) {
    showNotification("🔥 Streak!", `${newStreak}-day streak! Keep it up!`);
  }
}

// ─── Notification helper ───────────────────────────────────────────────────

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
  });
}

// ─── Backend sync ──────────────────────────────────────────────────────────

async function syncToBackend(endpoint, payload) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    LOG("Backend sync failed (backend may not be running):", err.message);
    return null;
  }
}

async function syncAllToBackend() {
  const assignments = Object.values(await getAllAssignments());
  const grades = Object.values(await getAllGrades());
  const state = await getState();

  await syncToBackend("/api/sync", {
    userId: state.userId,
    assignments,
    grades,
    state,
  });
}

// ─── Message handlers ──────────────────────────────────────────────────────

async function handleAssignmentsFound(assignments) {
  if (!Array.isArray(assignments) || !assignments.length) return;

  const stored = await getAllAssignments();
  let newCount = 0;

  for (const a of assignments) {
    if (!a.id || !a.title) continue;

    const isNew = !stored[a.id];
    stored[a.id] = {
      ...stored[a.id],
      ...a,
      priority: computePriority(a),
    };

    if (isNew) {
      newCount++;
      await awardXP("new_assignment_synced", CONFIG.XP_TABLE.new_assignment_synced);
    }
  }

  await storageSet("assignments", stored);
  LOG(`Stored ${Object.keys(stored).length} assignments (${newCount} new)`);

  // Push to backend asynchronously
  syncToBackend("/api/assignments/sync", {
    assignments: Object.values(stored),
  });
}

async function handleGradesFound(grades) {
  if (!Array.isArray(grades) || !grades.length) return;

  const stored = await getAllGrades();

  for (const g of grades) {
    if (!g.id) continue;

    const isNew = !stored[g.id];
    const pct = g.percentage ?? (g.maxGrade ? (g.grade / g.maxGrade) * 100 : null);

    stored[g.id] = { ...stored[g.id], ...g };

    if (isNew && pct !== null) {
      if (pct >= 80) await awardXP("grade_A", CONFIG.XP_TABLE.grade_A);
      else if (pct >= 65) await awardXP("grade_B", CONFIG.XP_TABLE.grade_B);
      else await awardXP("grade_C", CONFIG.XP_TABLE.grade_C);
    }
  }

  await storageSet("grades", stored);
  LOG(`Stored ${Object.keys(stored).length} grades`);

  syncToBackend("/api/grades/sync", {
    grades: Object.values(stored),
  });
}

async function handleUserInfo(user) {
  if (!user?.name) return;
  const state = await getState();
  if (state.userName !== user.name) {
    await setState({ userName: user.name });
    LOG("User identified:", user.name);
  }
}

async function handlePageVisit({ page }) {
  await updateStreak();
  LOG("Page visit:", page);
}

// ─── Complete assignment (called from popup/webapp) ────────────────────────

async function completeAssignment(assignmentId) {
  const stored = await getAllAssignments();
  const a = stored[assignmentId];
  if (!a || a.status === "submitted") return;

  const now = new Date();
  let xpReason = "complete_ontime";

  if (a.dueDate) {
    const due = new Date(a.dueDate);
    const hoursLeft = (due - now) / 3600000;
    if (hoursLeft > 24) xpReason = "complete_early";
    if (hoursLeft < 0) xpReason = "complete_late";
  }

  stored[assignmentId] = { ...a, status: "submitted", completedAt: now.toISOString() };
  await storageSet("assignments", stored);
  await awardXP(xpReason, CONFIG.XP_TABLE[xpReason]);

  syncToBackend("/api/assignments/complete", { assignmentId });
}

// ─── Popup data request ────────────────────────────────────────────────────

async function buildPopupPayload() {
  const [assignments, grades, state, xpEvents] = await Promise.all([
    getAllAssignments(),
    getAllGrades(),
    getState(),
    storageGet("xpEvents").then((e) => e ?? []),
  ]);

  const now = new Date();
  const assignmentList = Object.values(assignments);

  // Sort by priority desc
  assignmentList.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Upcoming (next 14 days, not submitted)
  const upcoming = assignmentList.filter((a) => {
    if (a.status === "submitted") return false;
    if (!a.dueDate) return true;
    const diff = (new Date(a.dueDate) - now) / 86400000;
    return diff >= -1 && diff <= 14;
  });

  // GPA estimate from grades
  const gradeList = Object.values(grades);
  const gpa = gradeList.length
    ? +(gradeList.reduce((s, g) => s + (g.percentage ?? 0), 0) / gradeList.length / 25).toFixed(2)
    : null;

  return {
    state,
    upcoming: upcoming.slice(0, 10),
    totalAssignments: assignmentList.length,
    totalGrades: gradeList.length,
    gpa,
    xpToNextLevel: xpForLevel(state.level + 1),
    recentXP: xpEvents.slice(-5).reverse(),
  };
}

// ─── Message router ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  LOG("Message:", msg.type);

  const handle = async () => {
    switch (msg.type) {
      case "ASSIGNMENTS_FOUND":
        await handleAssignmentsFound(msg.assignments);
        return { ok: true };

      case "GRADES_FOUND":
        await handleGradesFound(msg.grades);
        return { ok: true };

      case "USER_INFO":
        await handleUserInfo(msg.user);
        return { ok: true };

      case "PAGE_VISIT":
        await handlePageVisit(msg);
        return { ok: true };

      case "COMPLETE_ASSIGNMENT":
        await completeAssignment(msg.assignmentId);
        return { ok: true };

      case "GET_POPUP_DATA":
        return await buildPopupPayload();

      case "SYNC_NOW":
        await syncAllToBackend();
        return { ok: true };

      case "CLEAR_DATA":
        await chrome.storage.local.clear();
        return { ok: true };

      default:
        return { error: "unknown message type" };
    }
  };

  handle().then(sendResponse).catch((err) => {
    LOG("Handler error:", err);
    sendResponse({ error: err.message });
  });

  return true; // keep channel open for async response
});

// ─── Alarm: periodic backend sync ─────────────────────────────────────────

chrome.alarms.create("periodic_sync", { periodInMinutes: CONFIG.SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "periodic_sync") {
    LOG("Periodic sync triggered");
    syncAllToBackend();
  }
});

// ─── Install / startup ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  LOG("Installed, reason:", reason);
  if (reason === "install") {
    showNotification(
      "Academia Quest installed! 🎮",
      "Open Brightspace to start syncing your assignments automatically."
    );
  }
});

LOG("Background service worker started.");
