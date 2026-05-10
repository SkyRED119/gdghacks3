/**
 * popup.js
 * Fetches data from background.js and renders the popup UI.
 */

"use strict";

const $ = (id) => document.getElementById(id);

// ─── XP reason labels ─────────────────────────────────────────────────────

const XP_LABELS = {
  complete_early:       "✅ Completed early",
  complete_ontime:      "✅ Task completed",
  complete_late:        "⏰ Completed (late)",
  streak_day:           "🔥 Daily streak",
  new_assignment_synced:"📥 Assignment synced",
  grade_A:              "🏆 Grade A",
  grade_B:              "⭐ Grade B",
  grade_C:              "📖 Grade C",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  return Math.round(diff);
}

function dueDateLabel(days) {
  if (days === null) return "No due date";
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

function dueDateClass(days) {
  if (days === null) return "";
  if (days <= 2) return "urgent";
  if (days <= 5) return "soon";
  return "";
}

function urgencyClass(days) {
  if (days === null || days > 5) return "later";
  if (days <= 2) return "urgent";
  return "soon";
}

// ─── Render ────────────────────────────────────────────────────────────────

function render(data) {
  const { state, upcoming, totalAssignments, gpa, xpToNextLevel, recentXP } = data;

  // Player
  $("player-name").textContent = state.userName
    ? state.userName.split(" ")[0]
    : "Adventurer";
  $("player-level").textContent = `Level ${state.level} Explorer`;
  $("streak").textContent = state.streak;
  $("gpa").textContent = gpa !== null ? `${gpa.toFixed(2)} GPA` : "–";

  // XP bar
  const pct = Math.min((state.xp / xpToNextLevel) * 100, 100).toFixed(1);
  $("xp-fill").style.width = `${pct}%`;
  $("xp-text").textContent = `${state.xp} / ${xpToNextLevel}`;

  // Quest list
  const list = $("quest-list");
  list.innerHTML = "";

  const active = upcoming.filter((a) => a.status !== "submitted");
  $("quest-count").textContent = active.length;

  if (active.length === 0) {
    $("no-quests").hidden = false;
  } else {
    $("no-quests").hidden = true;
    active.forEach((a) => {
      const days = daysUntil(a.dueDate);
      const li = document.createElement("li");
      li.className = `quest-item ${urgencyClass(days)}`;
      li.dataset.id = a.id;

      const isSubmitted = a.status === "submitted";
      li.innerHTML = `
        <div class="quest-check ${isSubmitted ? "checked" : ""}" data-id="${a.id}"></div>
        <div class="quest-body">
          <div class="quest-title">${escape(a.title)}</div>
          <div class="quest-meta">
            <span class="quest-due ${dueDateClass(days)}">${dueDateLabel(days)}</span>
            <span>•</span>
            <span>${escape(a.course)}</span>
            ${a.priority ? `<span class="quest-priority">P${a.priority}</span>` : ""}
          </div>
        </div>
      `;

      li.querySelector(".quest-check").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (isSubmitted) return;
        await send("COMPLETE_ASSIGNMENT", { assignmentId: a.id });
        load(); // refresh
      });

      list.appendChild(li);
    });
  }

  // XP log
  const xpLog = $("xp-log");
  xpLog.innerHTML = "";
  if (!recentXP?.length) {
    const li = document.createElement("li");
    li.className = "xp-event";
    li.innerHTML = `<span style="color:var(--muted);font-style:italic">No XP yet — open Brightspace!</span>`;
    xpLog.appendChild(li);
  } else {
    recentXP.forEach((ev) => {
      const li = document.createElement("li");
      li.className = "xp-event";
      li.innerHTML = `
        <span>${XP_LABELS[ev.reason] ?? ev.reason}</span>
        <span class="xp-amount">+${ev.amount}</span>
      `;
      xpLog.appendChild(li);
    });
  }
}

function escape(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

// ─── Load ──────────────────────────────────────────────────────────────────

async function load() {
  try {
    const data = await send("GET_POPUP_DATA");
    $("loading").hidden = true;
    $("content").hidden = false;
    render(data);
  } catch (err) {
    $("loading").querySelector("p").textContent = "Error loading data.";
    console.error(err);
  }
}

// ─── Events ────────────────────────────────────────────────────────────────

$("btn-sync").addEventListener("click", async () => {
  $("btn-sync").classList.add("spinning");
  await send("SYNC_NOW");
  await load();
  $("btn-sync").classList.remove("spinning");
});

$("btn-brightspace").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://courselink.uoguelph.ca/d2l/home" });
});

$("btn-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:3000" });
});

// ─── Boot ──────────────────────────────────────────────────────────────────

load();
