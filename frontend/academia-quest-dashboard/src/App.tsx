import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ViewMode, ThemeMode, SyncState } from './types.ts';
import { CalendarView } from './components/CalendarView';
import { SemesterOverview } from './components/SemesterOverview';
import { GameModal } from './components/GameModal';
import { RefreshCw } from 'lucide-react';
import { api } from './lib/api';
import { OutlineUpload } from './components/OutlineUpload';
import { useAuth } from './hooks/useAuth';
import { getToken } from './lib/api';

// ─── helpers ────────────────────────────────────────────────────────────────

function toCalendarEvent(a: any) {
  return {
    id: a.id,
    title: a.title,
    course: a.course ?? 'Unknown',
    dueDate: a.due_date ?? null,
    status: a.status ?? 'pending',
    priority: a.priority ?? 0,
    grade: a.grade ?? null,
    maxGrade: a.max_grade ?? null,
    type: 'assignment' as const,
  };
}

function toPlayerFromUser(user: any) {
  return {
    name: user.name ?? 'Student',
    level: user.level ?? 1,
    xp: user.xp ?? 0,
    xpMax: user.xp_max ?? 1000,
    streak: user.streak ?? 0,
    gpa: null,
  };
}

export function weightColour(weight: number): string {
  const clamped = Math.max(0, Math.min(100, weight));
  if (clamped <= 50) {
    const t = clamped / 50;
    const r = Math.round(t * 234);
    const g = Math.round(154 + t * (195 - 154));
    return `rgb(${r},${g},0)`;
  } else {
    const t = (clamped - 50) / 50;
    const r = Math.round(234 + t * (226 - 234));
    const g = Math.round(195 - t * 195);
    return `rgb(${r},${g},0)`;
  }
}

const DEFAULT_TYPE_COLOURS: Record<string, string> = {
  midterm: '#888780',
  assignment: '#5F5E5A',
  exam: '#444441',
  quiz: '#B4B2A9',
  lab: '#D3D1C7',
  other: '#2C2C2A',
};

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

  :root {
    --font-display: 'DM Serif Display', Georgia, serif;
    --font-body: 'DM Sans', system-ui, sans-serif;

    /* Light palette — black borders */
    --bg:          #efede9;
    --bg-card:     #fafaf8;
    --bg-surface:  #e4e2dc;
    --bg-hover:    #d9d7d0;
    --text:        #111110;
    --text-muted:  #6b6966;
    --text-faint:  #9e9c97;
    --border:      rgba(0,0,0,0.18);
    --border-strong: rgba(0,0,0,0.45);
    --accent:      #111110;

    --shadow-sm: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 14px rgba(0,0,0,0.13), 0 2px 5px rgba(0,0,0,0.08);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08);
    --shadow-inset: inset 0 1px 3px rgba(0,0,0,0.09);
  }

  [data-theme="dark"] {
    --bg:          #111110;
    --bg-card:     #1c1c1b;
    --bg-surface:  #252523;
    --bg-hover:    #2e2e2c;
    --text:        #f0ede8;
    --text-muted:  #8a8880;
    --text-faint:  #555450;
    --border:      rgba(255,255,255,0.14);
    --border-strong: rgba(255,255,255,0.38);
    --accent:      #f0ede8;

    --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
    --shadow-md: 0 4px 14px rgba(0,0,0,0.5);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.6);
    --shadow-inset: inset 0 1px 3px rgba(0,0,0,0.3);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body { overflow-x: hidden; max-width: 100vw; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fl-fadein  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes fl-popin   { from { opacity: 0; transform: scale(0.97) translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes fl-slidein { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }
  @keyframes fl-pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  /* ─── App shell ─── */
  .flowestra-app {
    min-height: 100vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    transition: background 0.28s, color 0.28s;
    /* Grain */
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.045'/%3E%3C/svg%3E");
    background-size: 220px;
  }

  /* ─── Header ─── */
  .fl-header {
    position: sticky; top: 0; z-index: 100;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    padding: 0 20px;
    box-shadow: 0 1px 0 var(--border), var(--shadow-sm);
    overflow: visible; /* allow dropdown to escape */
  }
  .fl-header-inner {
    max-width: 1100px; margin: 0 auto;
    height: 54px; display: flex; align-items: center; gap: 1px;
    overflow: visible; /* allow dropdown to escape */
  }
  .fl-wordmark {
    font-family: var(--font-display);
    font-size: 20px; color: var(--text);
    flex: 1; letter-spacing: 0.01em; font-style: italic;
    white-space: nowrap;
  }

  /* Nav buttons */
  .fl-nav-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-family: var(--font-body); font-size: 12.5px;
    display: flex; align-items: center; gap: 5px;
    padding: 5px 9px; border-radius: 6px;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap; flex-shrink: 0;
  }
  .fl-nav-btn:hover { background: var(--bg-surface); color: var(--text); }
  .fl-nav-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.8; flex-shrink: 0; }

  /* Theme toggle */
  .fl-theme-toggle {
    background: none; border: 1px solid var(--border);
    cursor: pointer; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 7px; flex-shrink: 0;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.25s;
    margin-left: 4px;
  }
  .fl-theme-toggle:hover {
    background: var(--bg-surface); color: var(--text);
    border-color: var(--border-strong); transform: rotate(18deg);
  }
  .fl-theme-toggle svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.8; }

  /* Dropdown */
  .fl-dropdown {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 8px; min-width: 140px; overflow: hidden;
    box-shadow: var(--shadow-lg); z-index: 500;
    animation: fl-popin 0.16s ease;
  }
  .fl-dropdown-divider { height: 1px; background: var(--border); }
  .fl-dropdown-item {
    display: block; width: 100%; text-align: left;
    background: none; border: none; padding: 8px 12px;
    font-family: var(--font-body); font-size: 12.5px; color: var(--text);
    cursor: pointer; transition: background 0.12s; letter-spacing: 0.01em;
  }
  .fl-dropdown-item:hover { background: var(--bg-surface); }
  .fl-dropdown-item.danger { color: #c0392b; }
  .fl-dropdown-item.disabled { color: var(--text-muted); cursor: default; font-weight: 500; font-size: 11.5px; }
  .fl-dropdown-item.disabled:hover { background: none; }

  /* Avatar */
  .fl-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--bg-surface); border: 1.5px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 500; color: var(--text-muted);
    cursor: pointer; overflow: hidden; flex-shrink: 0; margin-left: 6px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .fl-avatar:hover { border-color: var(--border-strong); box-shadow: 0 0 0 3px var(--bg-surface); }
  .fl-avatar img { width: 100%; height: 100%; object-fit: cover; }

  /* ─── Main ─── */
  .fl-main {
    flex: 1;
    width: 100%;
    padding: 24px 20px 56px;
    display: flex; flex-direction: column; gap: 24px;
  }
  .fl-inner {
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
    animation: fl-fadein 0.35s ease;
  }

  /* ─── Page header ─── */
  .fl-page-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; flex-wrap: wrap; gap: 16px;
    padding-bottom: 22px;
    border-bottom: 2px solid var(--border);
  }
  .fl-page-title {
    font-family: var(--font-display); font-size: 32px;
    line-height: 1.1; color: var(--text); font-style: italic;
  }
  .fl-page-sub {
    font-size: 11px; color: var(--text-muted); margin-top: 6px;
    letter-spacing: 0.07em; text-transform: uppercase;
    display: flex; align-items: center; gap: 8px;
  }
  .fl-page-sub-dot {
    width: 3px; height: 3px; border-radius: 50%; background: var(--border-strong); flex-shrink: 0;
  }

  /* XP bar */
  .fl-xp-wrap { display: flex; align-items: center; gap: 9px; margin-top: 11px; }
  .fl-xp-label { font-size: 10px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .fl-xp-track {
    flex: 1; max-width: 150px; height: 3px;
    background: var(--border); border-radius: 2px; overflow: hidden;
    box-shadow: var(--shadow-inset);
  }
  .fl-xp-fill {
    height: 100%; background: var(--text); border-radius: 2px;
    transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .fl-xp-val { font-size: 11px; color: var(--text-faint); font-variant-numeric: tabular-nums; }

  /* Stat pills row */
  .fl-stat-pills { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .fl-stat-pill {
    display: flex; align-items: center; gap: 6px;
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: 20px; padding: 4px 11px;
    font-size: 11px; color: var(--text-muted); letter-spacing: 0.03em;
  }
  .fl-stat-pill strong { color: var(--text); font-weight: 500; }

  /* Sync pill */
  .fl-sync-pill {
    display: flex; align-items: center; gap: 7px;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 12px; font-size: 11.5px; color: var(--text-muted);
    box-shadow: var(--shadow-sm); letter-spacing: 0.02em;
    transition: box-shadow 0.2s;
    white-space: nowrap;
  }
  .fl-sync-pill:hover { box-shadow: var(--shadow-md); }
  .fl-sync-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .fl-sync-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); display: flex; align-items: center; padding: 0;
    transition: color 0.15s;
  }
  .fl-sync-btn:hover { color: var(--text); }

  /* ─── View tabs ─── */
  .fl-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  }
  .fl-view-tabs {
    display: flex; gap: 2px; background: var(--bg-surface);
    border-radius: 9px; padding: 3px; width: fit-content;
    border: 1px solid var(--border); box-shadow: var(--shadow-inset);
  }
  .fl-view-tab {
    background: none; border: 1px solid transparent; cursor: pointer;
    padding: 5px 18px; border-radius: 7px;
    font-family: var(--font-body); font-size: 12.5px; color: var(--text-muted);
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    font-weight: 400; letter-spacing: 0.03em; white-space: nowrap;
  }
  .fl-view-tab:hover:not(.active) { color: var(--text); background: var(--bg-hover); }
  .fl-view-tab.active {
    background: var(--bg-card); color: var(--text);
    box-shadow: var(--shadow-sm); border-color: var(--border); font-weight: 500;
  }
  .fl-period-label {
    font-size: 11px; color: var(--text-faint); letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  /* ─── Semester picker ─── */
  .fl-sem-picker {
    display: flex; align-items: center; gap: 6px;
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 4px 6px;
    box-shadow: var(--shadow-inset);
  }
  .fl-sem-picker-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .fl-sem-picker-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }
  .fl-sem-picker-btn:disabled { opacity: 0.25; cursor: default; }
  .fl-sem-picker-btn svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.4; }
  .fl-sem-picker-label {
    font-family: var(--font-display); font-size: 15px; color: var(--text); font-style: italic;
    padding: 0 8px; white-space: nowrap; min-width: 130px; text-align: center;
    letter-spacing: 0.01em;
  }
  .fl-sem-picker-label small {
    display: block; font-family: var(--font-body); font-size: 9px; color: var(--text-faint);
    text-transform: uppercase; letter-spacing: 0.1em; font-style: normal; margin-top: 1px;
  }

  /* ─── Carousel ─── */
  .fl-carousel-outer {
    width: 100%;
    overflow: hidden; /* hard block on x overflow */
  }
  .fl-carousel-wrap {
    position: relative; width: 100%;
    padding: 0 36px;
  }
  .fl-carousel-track { overflow: hidden; border-radius: 12px; width: 100%; }
  .fl-carousel-inner { display: flex; transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1); width: 100%; }
  .fl-carousel-slide { min-width: 100%; width: 100%; flex-shrink: 0; }

  .fl-carousel-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 12px; padding: 26px 28px;
    min-height: 500px;
    display: flex; flex-direction: column;
    box-shadow: var(--shadow-md);
    transition: box-shadow 0.25s;
    width: 100%;
    overflow: hidden;
  }

  .fl-card-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding-bottom: 14px; margin-bottom: 2px;
    border-bottom: 1.5px solid var(--border);
    gap: 12px;
  }
  .fl-card-header-left { display: flex; flex-direction: column; gap: 3px; }
  .fl-period-title {
    font-family: var(--font-display); font-size: 24px; color: var(--text); font-style: italic;
  }
  .fl-period-sub {
    font-size: 10px; color: var(--text-faint); letter-spacing: 0.08em; text-transform: uppercase;
  }
  .fl-period-count {
    font-size: 11px; color: var(--text-faint); letter-spacing: 0.04em; align-self: flex-end;
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: 5px; padding: 2px 8px;
  }

  .fl-carousel-btn {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--bg-card); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-muted);
    transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.18s;
    z-index: 5; box-shadow: var(--shadow-sm); flex-shrink: 0;
  }
  .fl-carousel-btn:hover {
    background: var(--bg-surface); color: var(--text);
    box-shadow: var(--shadow-md);
    transform: translateY(-50%) scale(1.07);
  }
  .fl-carousel-btn:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
  .fl-carousel-btn.prev { left: 0; }
  .fl-carousel-btn.next { right: 0; }
  .fl-carousel-btn svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.4; }

  /* Carousel dots */
  .fl-carousel-dots { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 10px; }
  .fl-carousel-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--border-strong); opacity: 0.35;
    transition: opacity 0.2s, transform 0.2s;
    cursor: pointer; border: none; padding: 0;
  }
  .fl-carousel-dot.active { opacity: 1; transform: scale(1.3); background: var(--text); }

  /* ─── Assignment row ─── */
  .fl-rows-container { flex: 1; overflow-y: auto; }
  .fl-row {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 8px; border-bottom: 1px solid var(--border);
    transition: background 0.12s; border-radius: 6px;
    animation: fl-slidein 0.2s ease both;
    margin: 0 -8px;
  }
  .fl-row:last-child { border-bottom: none; }
  .fl-row:hover { background: var(--bg-surface); }
  .fl-type-bar {
    width: 2px; border-radius: 2px;
    align-self: stretch; flex-shrink: 0; min-height: 38px; opacity: 0.65;
  }
  .fl-row-info { flex: 1; min-width: 0; }
  .fl-row-title {
    font-size: 13px; font-weight: 500; color: var(--text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .fl-row-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; letter-spacing: 0.02em; }
  .fl-row-status {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 1px 6px; border-radius: 3px; margin-top: 4px;
    display: inline-block; font-weight: 500;
  }
  .fl-row-status.pending  { background: var(--bg-surface); color: var(--text-faint); border: 1px solid var(--border); }
  .fl-row-status.complete { background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border); }

  .fl-weight-badge {
    font-size: 11px; font-weight: 600; padding: 3px 8px;
    border-radius: 5px; background: var(--bg-surface); flex-shrink: 0;
    align-self: center; border: 1px solid var(--border);
    font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
  }

  /* ─── Semester grid ─── */
  .fl-sem-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    width: 100%;
  }
  .fl-month-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 12px; padding: 22px 22px;
    min-height: 440px;
    display: flex; flex-direction: column;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.22s, transform 0.22s;
    overflow: hidden; min-width: 0;
  }
  .fl-month-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
  .fl-month-header {
    display: flex; align-items: baseline; justify-content: space-between;
    padding-bottom: 12px; margin-bottom: 4px;
    border-bottom: 1.5px solid var(--border);
    gap: 8px;
  }
  .fl-month-label {
    font-family: var(--font-display); font-size: 19px; color: var(--text); font-style: italic;
  }
  .fl-month-count {
    font-size: 10px; color: var(--text-faint); letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* ─── Start game button ─── */
  .fl-game-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin: 16px auto 0; padding: 10px 30px;
    background: none; border: 1.5px solid var(--border-strong); border-radius: 8px;
    font-family: var(--font-body); font-size: 11.5px; color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
    width: fit-content; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 500;
  }
  .fl-game-btn:hover {
    background: var(--bg-surface); border-color: var(--text); color: var(--text);
    box-shadow: var(--shadow-sm);
  }
  .fl-game-btn svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 1.8; }

  /* ─── Empty & loading ─── */
  .fl-empty {
    font-size: 12px; color: var(--text-faint); padding: 36px 0;
    text-align: center; letter-spacing: 0.04em; font-style: italic; flex: 1;
  }
  .fl-loading {
    display: flex; align-items: center; justify-content: center;
    min-height: 200px; color: var(--text-faint); font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase;
    animation: fl-pulse 1.6s ease infinite;
  }

  /* ─── Logout confirm ─── */
  .fl-confirm-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 400;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(5px);
    animation: fl-fadein 0.14s ease;
  }
  .fl-confirm-panel {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 14px; padding: 28px 28px 22px;
    width: 100%; max-width: 340px;
    box-shadow: var(--shadow-lg);
    animation: fl-popin 0.16s ease;
    display: flex; flex-direction: column; gap: 18px;
  }
  .fl-confirm-title {
    font-family: var(--font-display); font-size: 20px; font-style: italic; color: var(--text);
  }
  .fl-confirm-body { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
  .fl-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .fl-confirm-cancel {
    background: none; border: 1px solid var(--border); border-radius: 7px;
    padding: 8px 16px; font-family: var(--font-body); font-size: 13px; color: var(--text-muted);
    cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .fl-confirm-cancel:hover { background: var(--bg-surface); color: var(--text); }
  .fl-confirm-ok {
    background: #c0392b; border: none; border-radius: 7px;
    padding: 8px 18px; font-family: var(--font-body); font-size: 13px; color: #fff; font-weight: 500;
    cursor: pointer; transition: background 0.15s, box-shadow 0.15s;
    letter-spacing: 0.02em;
  }
  .fl-confirm-ok:hover { background: #a93226; box-shadow: 0 2px 8px rgba(192,57,43,0.35); }

  /* ─── Search overlay ─── */
  .fl-search-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.32); z-index: 300;
    display: flex; align-items: flex-start; justify-content: center; padding: 70px 16px 0;
    backdrop-filter: blur(5px);
    animation: fl-fadein 0.14s ease;
  }
  .fl-search-box {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 12px; width: 100%; max-width: 500px; overflow: hidden;
    box-shadow: var(--shadow-lg);
    animation: fl-popin 0.16s ease;
  }
  .fl-search-header {
    display: flex; align-items: center; gap: 10px;
    padding: 0 16px; border-bottom: 1px solid var(--border);
  }
  .fl-search-header svg { width: 14px; height: 14px; stroke: var(--text-faint); fill: none; stroke-width: 1.8; flex-shrink: 0; }
  .fl-search-input {
    flex: 1; border: none; background: none; padding: 14px 0;
    font-size: 14px; font-family: var(--font-body); color: var(--text); outline: none;
  }
  .fl-search-input::placeholder { color: var(--text-faint); }
  .fl-search-result {
    padding: 10px 16px; border-top: 1px solid var(--border);
    transition: background 0.1s; cursor: default;
  }
  .fl-search-result:hover { background: var(--bg-surface); }
  .fl-search-result-title { font-size: 13px; font-weight: 500; color: var(--text); }
  .fl-search-result-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  /* ─── Settings overlay ─── */
  .fl-settings-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.32); z-index: 300;
    display: flex; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(5px);
    animation: fl-fadein 0.14s ease;
  }
  .fl-settings-panel {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
    width: 100%; max-width: 380px; padding: 24px;
    display: flex; flex-direction: column; gap: 20px;
    box-shadow: var(--shadow-lg);
    animation: fl-popin 0.16s ease;
    max-height: 90vh; overflow-y: auto;
  }
  .fl-settings-title { font-family: var(--font-display); font-size: 20px; color: var(--text); font-style: italic; }
  .fl-settings-section { display: flex; flex-direction: column; gap: 10px; }
  .fl-settings-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); }
  .fl-colour-row { display: flex; align-items: center; justify-content: space-between; }
  .fl-colour-row span { font-size: 13px; color: var(--text); text-transform: capitalize; }
  .fl-colour-input { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; padding: 0; transition: transform 0.15s; }
  .fl-colour-input:hover { transform: scale(1.1); }
  .fl-settings-close {
    background: none; border: none; cursor: pointer; font-family: var(--font-body);
    font-size: 11px; color: var(--text-muted); align-self: flex-end; padding: 0;
    letter-spacing: 0.06em; text-transform: uppercase; transition: color 0.15s;
  }
  .fl-settings-close:hover { color: var(--text); }
  .fl-mode-toggle {
    background: none; border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 11px; cursor: pointer; color: var(--text-muted); font-family: var(--font-body);
    font-size: 13px; display: flex; align-items: center; gap: 6px; transition: background 0.15s, color 0.15s;
  }
  .fl-mode-toggle:hover { background: var(--bg-surface); color: var(--text); }
  .fl-mode-toggle svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 1.8; }

  /* ─── Help panel ─── */
  .fl-help-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.32); z-index: 300;
    display: flex; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(5px);
    animation: fl-fadein 0.14s ease;
  }
  .fl-help-panel {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
    width: 100%; max-width: 420px; padding: 24px;
    display: flex; flex-direction: column; gap: 18px;
    box-shadow: var(--shadow-lg);
    animation: fl-popin 0.16s ease;
    max-height: 90vh; overflow-y: auto;
  }
  .fl-help-title { font-family: var(--font-display); font-size: 20px; color: var(--text); font-style: italic; }
  .fl-help-section { display: flex; flex-direction: column; gap: 8px; }
  .fl-help-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); }
  .fl-help-item { display: flex; flex-direction: column; gap: 3px; }
  .fl-help-item-title { font-size: 13px; font-weight: 500; color: var(--text); }
  .fl-help-item-desc { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
  .fl-help-divider { height: 1px; background: var(--border); }
`;

// ─── Semester data ───────────────────────────────────────────────────────────

type SemesterTerm = 'Winter' | 'Summer' | 'Fall';

interface WeekRange {
  weekNum: number;     // 1-based
  start: Date;
  end: Date;
  label: string;       // e.g. "Jan 6 – Jan 12"
}

interface Semester {
  key: string;
  label: string;
  term: SemesterTerm;
  year: number;
  months: string[];
  monthCount: number;
  weekCount: number;
  startDate: Date;     // first Monday of the term
  weeks: WeekRange[];  // one entry per week
}

// Term start dates: first Monday of the first month of each term
// Winter = first Monday of January, Summer = first Monday of May, Fall = first Monday of September
function firstMonday(year: number, month: number /* 0-based */): Date {
  const d = new Date(year, month, 1);
  // day 0=Sun, 1=Mon … advance to first Monday
  const day = d.getDay();
  const offset = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function buildWeeks(startDate: Date, count: number): WeekRange[] {
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(startDate, i * 7);
    const end   = addDays(start, 6);
    return { weekNum: i + 1, start, end, label: `${fmtDate(start)} – ${fmtDate(end)}` };
  });
}

function buildSemesters(currentYear: number): Semester[] {
  const TERMS: SemesterTerm[] = ['Winter', 'Summer', 'Fall'];
  const TERM_MONTHS: Record<SemesterTerm, string[]> = {
    Winter: ['January', 'February', 'March', 'April'],
    Summer: ['May', 'June', 'July', 'August'],
    Fall:   ['September', 'October', 'November', 'December'],
  };
  const TERM_WEEKS: Record<SemesterTerm, number> = { Winter: 16, Summer: 12, Fall: 16 };
  const TERM_START_MONTH: Record<SemesterTerm, number> = { Winter: 0, Summer: 4, Fall: 8 }; // 0-based

  const semesters: Semester[] = [];
  for (let yearOffset = -1; yearOffset <= 1; yearOffset++) {
    const year = currentYear + yearOffset;
    for (const term of TERMS) {
      const startDate = firstMonday(year, TERM_START_MONTH[term]);
      const weekCount = TERM_WEEKS[term];
      semesters.push({
        key: `${term.toLowerCase()}-${year}`,
        label: `${term} ${year}`,
        term,
        year,
        months: TERM_MONTHS[term],
        monthCount: TERM_MONTHS[term].length,
        weekCount,
        startDate,
        weeks: buildWeeks(startDate, weekCount),
      });
    }
  }
  return semesters;
}

const ALL_SEMESTERS = buildSemesters(2026);
const DEFAULT_SEM_IDX = ALL_SEMESTERS.findIndex(s => s.key === 'winter-2026');

// ─── Icons ───────────────────────────────────────────────────────────────────

const Ic = {
  Search:   () => <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Settings: () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Help:     () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  ChevL:    () => <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevR:    () => <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>,
  Moon:     () => <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Sun:      () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Gamepad:  () => <svg viewBox="0 0 24 24"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>,
  LogOut:   () => <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  User:     () => <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

// ─── Semester picker component ────────────────────────────────────────────────

function SemesterPicker({ idx, onChange }: { idx: number; onChange: (i: number) => void }) {
  const sem = ALL_SEMESTERS[idx];
  const isCurrent = sem.key === 'winter-2026';
  return (
    <div className="fl-sem-picker">
      <button
        className="fl-sem-picker-btn"
        onClick={() => onChange(idx - 1)}
        disabled={idx === 0}
        aria-label="Previous semester"
        title={idx > 0 ? ALL_SEMESTERS[idx - 1].label : undefined}
      >
        <Ic.ChevL />
      </button>
      <div className="fl-sem-picker-label">
        {sem.label}
        {isCurrent && <small>Current</small>}
      </div>
      <button
        className="fl-sem-picker-btn"
        onClick={() => onChange(idx + 1)}
        disabled={idx === ALL_SEMESTERS.length - 1}
        aria-label="Next semester"
        title={idx < ALL_SEMESTERS.length - 1 ? ALL_SEMESTERS[idx + 1].label : undefined}
      >
        <Ic.ChevR />
      </button>
    </div>
  );
}

// ─── Logout confirm dialog ────────────────────────────────────────────────────

function LogoutConfirm({ onConfirm, onCancel, theme }: { onConfirm: () => void; onCancel: () => void; theme?: string }) {
  return (
    <div className="fl-confirm-overlay" onClick={onCancel} data-theme={theme}>
      <div className="fl-confirm-panel" onClick={e => e.stopPropagation()}>
        <div className="fl-confirm-title">Log out?</div>
        <div className="fl-confirm-body">
          You'll be signed out of Flowestra. Any unsynced changes will be lost.
        </div>
        <div className="fl-confirm-actions">
          <button className="fl-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="fl-confirm-ok" onClick={onConfirm}>Log out</button>
        </div>
      </div>
    </div>
  );
}

// ─── Assignment row ───────────────────────────────────────────────────────────

function AssignmentRow({ event, typeColours, delay = 0 }: { event: any; typeColours: Record<string, string>; delay?: number }) {
  const weight = event.priority ?? 0;
  const typeKey = (event.itemType ?? event.category ?? 'other').toLowerCase();
  const barColor = typeColours[typeKey] ?? typeColours.other ?? '#888780';
  const wColor = weightColour(weight);
  const due = event.dueDate
    ? new Date(event.dueDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className="fl-row" style={{ animationDelay: `${delay}ms` }}>
      <div className="fl-type-bar" style={{ background: barColor }} />
      <div className="fl-row-info">
        <div className="fl-row-title">{event.title}</div>
        <div className="fl-row-meta">
          {event.course}{event.courseCode ? ` · ${event.courseCode}` : ''} · Due {due}
        </div>
        {event.status && event.status !== 'pending' && (
          <span className={`fl-row-status ${event.status}`}>{event.status}</span>
        )}
      </div>
      {weight > 0 && (
        <div className="fl-weight-badge" style={{ color: wColor }}>{weight}%</div>
      )}
    </div>
  );
}

// ─── Week carousel ────────────────────────────────────────────────────────────

function WeekCarousel({ events, typeColours, onStartGame, semester }: { events: any[]; typeColours: Record<string, string>; onStartGame: () => void; semester: Semester }) {
  const [idx, setIdx] = useState(0);
  const WEEKS = semester.weekCount;

  const byWeek: Record<number, any[]> = {};
  events.forEach(e => {
    const w = typeof e.week === 'number' ? e.week : 0;
    if (!byWeek[w]) byWeek[w] = [];
    byWeek[w].push(e);
  });

  const items = (byWeek[idx] ?? []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="fl-carousel-outer">
        <div className="fl-carousel-wrap">
          <button className="fl-carousel-btn prev" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Previous">
            <Ic.ChevL />
          </button>
          <div className="fl-carousel-track">
            <div className="fl-carousel-inner" style={{ transform: `translateX(-${idx * 100}%)` }}>
              {Array.from({ length: WEEKS }, (_, w) => (
                <div className="fl-carousel-slide" key={w}>
                  <div className="fl-carousel-card">
                    <div className="fl-card-header">
                      <div className="fl-card-header-left">
                        <span className="fl-period-title">Week {w + 1}</span>
                        <span className="fl-period-sub">{semester.weeks[w]?.label ?? semester.label}</span>
                      </div>
                      <span className="fl-period-count">{(byWeek[w] ?? []).length} item{(byWeek[w] ?? []).length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="fl-rows-container">
                      {(byWeek[w] ?? []).length === 0
                        ? <div className="fl-empty">Nothing due this week</div>
                        : (byWeek[w] ?? []).map((e, i) => <AssignmentRow key={e.id} event={e} typeColours={typeColours} delay={i * 30} />)
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="fl-carousel-btn next" onClick={() => setIdx(i => Math.min(WEEKS - 1, i + 1))} disabled={idx === WEEKS - 1} aria-label="Next">
            <Ic.ChevR />
          </button>
        </div>
        <div className="fl-carousel-dots">
          {Array.from({ length: WEEKS }, (_, w) => (
            <button key={w} className={`fl-carousel-dot${idx === w ? ' active' : ''}`} onClick={() => setIdx(w)} aria-label={`Week ${w + 1}`} />
          ))}
        </div>
      </div>
      <button className="fl-game-btn" onClick={onStartGame}><Ic.Gamepad /> Start Game</button>
    </div>
  );
}

// ─── Month carousel ───────────────────────────────────────────────────────────

function MonthCarousel({ events, typeColours, onStartGame, semester }: { events: any[]; typeColours: Record<string, string>; onStartGame: () => void; semester: Semester }) {
  const [idx, setIdx] = useState(0);
  const MONTHS = semester.monthCount;
  const MONTH_NAMES = semester.months;

  const byMonth: Record<number, any[]> = {};
  events.forEach(e => {
    const m = typeof e.month === 'number' ? e.month : 0;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(e);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="fl-carousel-outer">
        <div className="fl-carousel-wrap">
          <button className="fl-carousel-btn prev" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Previous">
            <Ic.ChevL />
          </button>
          <div className="fl-carousel-track">
            <div className="fl-carousel-inner" style={{ transform: `translateX(-${idx * 100}%)` }}>
              {Array.from({ length: MONTHS }, (_, m) => (
                <div className="fl-carousel-slide" key={m}>
                  <div className="fl-carousel-card">
                    <div className="fl-card-header">
                      <div className="fl-card-header-left">
                        <span className="fl-period-title">{MONTH_NAMES[m]}</span>
                        <span className="fl-period-sub">Month {m + 1} of {MONTHS} · {semester.label}</span>
                      </div>
                      <span className="fl-period-count">{(byMonth[m] ?? []).length} item{(byMonth[m] ?? []).length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="fl-rows-container">
                      {(byMonth[m] ?? []).length === 0
                        ? <div className="fl-empty">Nothing due this month</div>
                        : (byMonth[m] ?? []).map((e, i) => <AssignmentRow key={e.id} event={e} typeColours={typeColours} delay={i * 30} />)
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="fl-carousel-btn next" onClick={() => setIdx(i => Math.min(MONTHS - 1, i + 1))} disabled={idx === MONTHS - 1} aria-label="Next">
            <Ic.ChevR />
          </button>
        </div>
        <div className="fl-carousel-dots">
          {Array.from({ length: MONTHS }, (_, m) => (
            <button key={m} className={`fl-carousel-dot${idx === m ? ' active' : ''}`} onClick={() => setIdx(m)} aria-label={MONTH_NAMES[m]} />
          ))}
        </div>
      </div>
      <button className="fl-game-btn" onClick={onStartGame}><Ic.Gamepad /> Start Game</button>
    </div>
  );
}

// ─── Semester grid ────────────────────────────────────────────────────────────

function SemesterGrid({ events, typeColours, onStartGame, semester }: { events: any[]; typeColours: Record<string, string>; onStartGame: () => void; semester: Semester }) {
  const MONTH_NAMES = semester.months;
  const MONTHS = semester.monthCount;

  // Compute which calendar month index each term month corresponds to
  const TERM_START_MONTH: Record<SemesterTerm, number> = { Winter: 0, Summer: 4, Fall: 8 };
  const calendarMonthOffset = TERM_START_MONTH[semester.term];

  // Build a date range label for each term month (e.g. "Jan 6 – Jan 31")
  function monthDateRange(termMonthIdx: number): string {
    const calMonth = calendarMonthOffset + termMonthIdx;
    // First day of this calendar month that falls within the semester
    const monthStart = new Date(semester.year, calMonth, 1);
    const monthEnd   = new Date(semester.year, calMonth + 1, 0); // last day of month
    // Clamp to semester bounds
    const semEnd = addDays(semester.startDate, semester.weekCount * 7 - 1);
    const displayStart = monthStart < semester.startDate ? semester.startDate : monthStart;
    const displayEnd   = monthEnd > semEnd ? semEnd : monthEnd;
    return `${fmtDate(displayStart)} – ${fmtDate(displayEnd)}`;
  }

  const byMonth: Record<number, any[]> = {};
  events.forEach(e => {
    const m = typeof e.month === 'number' ? e.month : 0;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(e);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="fl-sem-grid">
        {Array.from({ length: MONTHS }, (_, m) => (
          <div className="fl-month-card" key={m}>
            <div className="fl-month-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="fl-month-label">{MONTH_NAMES[m]}</span>
                <span className="fl-period-sub" style={{ fontSize: '10px' }}>{monthDateRange(m)}</span>
              </div>
              <span className="fl-month-count">{(byMonth[m] ?? []).length} item{(byMonth[m] ?? []).length !== 1 ? 's' : ''}</span>
            </div>
            {(byMonth[m] ?? []).length === 0
              ? <div className="fl-empty">Nothing due</div>
              : (byMonth[m] ?? []).map((e, i) => <AssignmentRow key={e.id} event={e} typeColours={typeColours} delay={i * 25} />)
            }
          </div>
        ))}
      </div>
      <button className="fl-game-btn" onClick={onStartGame}><Ic.Gamepad /> Start Game</button>
    </div>
  );
}


// ─── Edit Account Modal ───────────────────────────────────────────────────────
function TokenPanel() {
  const [copied, setCopied] = useState(false);
  const token = getToken();
  if (!token) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        🔑 <strong>Extension Token</strong> — paste into the Chrome extension popup to link your account
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          readOnly
          value={token}
          style={{
            flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-faint)', fontFamily: 'monospace',
            fontSize: 10, padding: '6px 10px', outline: 'none',
          }}
        />
        <button
          onClick={() => { navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            background: copied ? '#27ae60' : 'var(--text)', color: 'var(--bg)',
            border: 'none', borderRadius: 6, padding: '6px 12px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}



function EditAccountModal({ user, onClose, theme }: { user: any; onClose: () => void; theme?: string }) {
  const displayName = user?.name ?? 'Unknown';
  const email       = user?.email ?? '';
  const picture     = user?.picture ?? '';

  return (
    <div
      data-theme={theme}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(5px)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 28, width: '100%', maxWidth: 380,
          display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', color: 'var(--text)' }}>
            Account
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
        </div>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--bg-surface)', border: '2px solid var(--border)',
            overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'var(--text-muted)',
          }}>
            {picture
              ? <img src={picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            }
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{email}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 10,
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {[
            { label: 'Level',  value: user?.level ?? 1 },
            { label: 'XP',     value: (user?.xp ?? 0).toLocaleString() },
            { label: 'Streak', value: `${user?.streak ?? 0} days` },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{row.value}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.6 }}>
          Your account is managed through Google.<br />
          Sign in again to switch accounts.
        </p>
        <TokenPanel />
        <button
          onClick={onClose}
          style={{
            background: 'var(--text)', color: 'var(--bg)', border: 'none',
            borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-body)', width: '100%',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Account dropdown ─────────────────────────────────────────────────────────
// The dropdown is rendered via a portal directly into document.body so it is
// completely immune to any stacking context created by parent elements.

function AccountMenu({ user, onSignOut, theme }: { user: any; onSignOut: () => void; theme: string }) {
  const [open, setOpen]           = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [pos, setPos]             = useState({ top: 0, right: 0 });
  const avatarRef                 = useRef<HTMLDivElement>(null);

  const initials = (user?.name ?? 'U')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  function openMenu() {
    if (avatarRef.current) {
      const r = avatarRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(true);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        avatarRef.current && !avatarRef.current.contains(target) &&
        !(target as Element).closest?.('[data-dropdown="account"]')
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('click', close);
return () => document.removeEventListener('click', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const dropdown = open && createPortal(
    <div
      {...{ 'data-theme': theme }}
      style={{
        position: 'fixed',
        top: pos.top,
        right: pos.right,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        minWidth: '140px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 9999,
        fontFamily: 'var(--font-body)',
        animation: 'fl-popin 0.16s ease',
      }}
    >
      <div style={{
        padding: '8px 12px',
        fontSize: '11.5px',
        color: 'var(--text-muted)',
        fontWeight: 500,
        cursor: 'default',
        userSelect: 'none',
      }}>
        {user?.name ?? 'Account'}
      </div>
      <div style={{ height: '1px', background: 'var(--border)' }} />
      <button
        onClick={() => { setOpen(false); setEditOpen(true); }}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'none', border: 'none', padding: '8px 12px',
          fontFamily: 'var(--font-body)', fontSize: '12.5px', color: 'var(--text)',
          cursor: 'pointer', transition: 'background 0.12s',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
        onMouseOut={e  => (e.currentTarget.style.background = 'none')}
      >
        Edit account
      </button>
      <div style={{ height: '1px', background: 'var(--border)' }} />
      <button
        onClick={() => { setOpen(false); setConfirmOpen(true); }}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'none', border: 'none', padding: '8px 12px',
          fontFamily: 'var(--font-body)', fontSize: '12.5px', color: '#c0392b',
          cursor: 'pointer', transition: 'background 0.12s',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
        onMouseOut={e  => (e.currentTarget.style.background = 'none')}
      >
        Log out
      </button>
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={avatarRef}
        className="fl-avatar"
        onClick={openMenu}
        role="button"
        aria-label="Account menu"
        title={user?.name ?? 'Account'}
      >
        {user?.picture ? <img src={user.picture} alt="" /> : initials}
      </div>

      {dropdown}

      {confirmOpen && createPortal(
        <LogoutConfirm
          onConfirm={() => { setConfirmOpen(false); onSignOut(); }}
          onCancel={() => setConfirmOpen(false)}
          theme={theme}
        />,
        document.body
      )}

      {editOpen && createPortal(
        <EditAccountModal user={user} onClose={() => setEditOpen(false)} theme={theme}/>,
        document.body
      )}
    </>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({
  typeColours, onChangeColour, onClose, theme, onThemeToggle,
}: {
  typeColours: Record<string, string>;
  onChangeColour: (t: string, v: string) => void;
  onClose: () => void;
  theme: ThemeMode;
  onThemeToggle: () => void;
}) {
  return (
    <div className="fl-settings-overlay" onClick={onClose}>
      <div className="fl-settings-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="fl-settings-title">Settings</span>
          <button className="fl-settings-close" onClick={onClose}>✕ Close</button>
        </div>

        <div className="fl-settings-section">
          <div className="fl-settings-section-label">Appearance</div>
          <div className="fl-colour-row">
            <span>Theme</span>
            <button className="fl-mode-toggle" onClick={onThemeToggle}>
              {theme === 'dark' ? <Ic.Sun /> : <Ic.Moon />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </div>

        <div className="fl-settings-section">
          <div className="fl-settings-section-label">Assignment type colours</div>
          {Object.keys(typeColours).map(type => (
            <div className="fl-colour-row" key={type}>
              <span>{type}</span>
              <input
                type="color"
                className="fl-colour-input"
                value={typeColours[type]}
                onChange={e => onChangeColour(type, e.target.value)}
                style={{ background: typeColours[type] }}
              />
            </div>
          ))}
        </div>

        <button className="fl-settings-close" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ─── Help panel ───────────────────────────────────────────────────────────────

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fl-help-overlay" onClick={onClose}>
      <div className="fl-help-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="fl-help-title">Help</span>
          <button className="fl-settings-close" onClick={onClose}>✕ Close</button>
        </div>

        <div className="fl-help-section">
          <div className="fl-help-section-label">Navigation</div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">View tabs</span>
            <span className="fl-help-item-desc">Switch between Week, Month, and Semester views using the tabs in the toolbar. Each view shows your assignments grouped by that time period.</span>
          </div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">Semester picker</span>
            <span className="fl-help-item-desc">Use the ‹ › arrows next to the view tabs to browse semesters — one year back and one year forward from the current term.</span>
          </div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">Search</span>
            <span className="fl-help-item-desc">Click Search in the header to filter assignments by title or course name in real time.</span>
          </div>
        </div>

        <div className="fl-help-divider" />

        <div className="fl-help-section">
          <div className="fl-help-section-label">Assignments</div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">Weight badge</span>
            <span className="fl-help-item-desc">The percentage shown on each row is the assignment's grade weight. Green means low weight, yellow is mid, red means it counts for a lot.</span>
          </div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">Colour bars</span>
            <span className="fl-help-item-desc">The thin vertical bar on the left of each row indicates the assignment type (midterm, quiz, lab, etc.). Colours can be customised in Settings.</span>
          </div>
        </div>

        <div className="fl-help-divider" />

        <div className="fl-help-section">
          <div className="fl-help-section-label">Sync & data</div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">Syncing from Brightspace</span>
            <span className="fl-help-item-desc">Your assignments are pulled from Brightspace automatically. Click the refresh icon next to the sync pill to fetch the latest data manually.</span>
          </div>
          <div className="fl-help-item">
            <span className="fl-help-item-title">XP & levels</span>
            <span className="fl-help-item-desc">You earn XP by completing assignments on time. Level up to unlock new features and climb the leaderboard.</span>
          </div>
        </div>

        <button className="fl-settings-close" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, signOut } = useAuth();
  const [theme, setTheme]               = useState<ThemeMode>('dark');
  const [view, setView]                 = useState<ViewMode>('semester');
  const [search, setSearch]             = useState('');
  const [searchOpen, setSearchOpen]     = useState(false);
  const [syncState, setSyncState]       = useState<SyncState>('idle');
  const [lastSynced, setLastSynced]     = useState('never');
  const [gameOpen, setGameOpen]         = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen]         = useState(false);
  const [events, setEvents]             = useState<any[]>([]);
  const [player, setPlayer]             = useState(toPlayerFromUser(user ?? {}));
  const [loading, setLoading]           = useState(true);
  const [typeColours, setTypeColours]   = useState<Record<string, string>>(DEFAULT_TYPE_COLOURS);
  const [semesterIdx, setSemesterIdx]   = useState(DEFAULT_SEM_IDX < 0 ? 4 : DEFAULT_SEM_IDX);

  useEffect(() => {
    const id = 'flowestra-css';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = CSS;
  }, []);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setSyncState('syncing');
    try {
      const [assignments, me] = await Promise.all([api.assignments(), api.me()]);
      setEvents((assignments as any[]).map(toCalendarEvent));
      setPlayer(toPlayerFromUser(me));
      setSyncState('synced');
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to fetch:', err);
      setSyncState('error');
    } finally {
      setLoading(false);
    }
  }

  const syncDot = { idle: '#888780', syncing: '#b4b2a9', synced: '#5f5e5a', error: '#c0392b' }[syncState];
  const xpPct = Math.min(100, Math.round((player.xp / (player.xpMax || 1000)) * 100));

  const filtered = search
    ? events.filter(e =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.course ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : events;

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const activeSemester = ALL_SEMESTERS[semesterIdx];

  const PERIOD_LABELS: Record<ViewMode, string> = {
    week: `${activeSemester.weekCount} weeks`,
    month: `${activeSemester.monthCount} months`,
    semester: 'Full semester',
  };

  return (
    <div data-theme={theme} className="flowestra-app">
      {/* ── Header ── */}
      <header className="fl-header">
        <div className="fl-header-inner">
          <span className="fl-wordmark">Flowestra</span>

          <button className="fl-nav-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Ic.Search /><span>Search</span>
          </button>
          <button className="fl-nav-btn" onClick={() => setHelpOpen(true)} aria-label="Help">
            <Ic.Help /><span>Help</span>
          </button>
          <button className="fl-nav-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Ic.Settings /><span>Settings</span>
          </button>

          <button
            className="fl-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Ic.Sun /> : <Ic.Moon />}
          </button>

          <AccountMenu user={user} onSignOut={signOut} theme={theme} />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="fl-main">
        <div className="fl-inner" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Page header */}
          <div className="fl-page-header">
            <div>
              <h1 className="fl-page-title">Welcome back, {firstName}.</h1>
              <div className="fl-page-sub">
                <span>Lv. {player.level}</span>
                <span className="fl-page-sub-dot" />
                <span>{player.streak} day streak</span>
                <span className="fl-page-sub-dot" />
                <span>{activeSemester.label}</span>
              </div>
              <div className="fl-xp-wrap">
                <span className="fl-xp-label">XP</span>
                <div className="fl-xp-track">
                  <div className="fl-xp-fill" style={{ width: `${xpPct}%` }} />
                </div>
                <span className="fl-xp-val">{player.xp.toLocaleString()} / {(player.xpMax ?? 1000).toLocaleString()}</span>
              </div>
              <div className="fl-stat-pills">
                <div className="fl-stat-pill"><strong>{events.length}</strong> assignments</div>
                <div className="fl-stat-pill"><strong>{events.filter(e => e.status === 'complete').length}</strong> completed</div>
                {player.gpa !== null && <div className="fl-stat-pill">GPA <strong>{player.gpa}</strong></div>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <OutlineUpload onSynced={fetchData} />
              <div className="fl-sync-pill">
                <span className="fl-sync-dot" style={{ background: syncDot }} />
                <span>{syncState === 'syncing' ? 'Syncing…' : `Synced ${lastSynced}`}</span>
                <button className="fl-sync-btn" onClick={fetchData} aria-label="Refresh" title="Refresh">
                  <RefreshCw size={11} style={{ animation: syncState === 'syncing' ? 'spin 1s linear infinite' : undefined }} />
                </button>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="fl-toolbar">
            <div className="fl-view-tabs">
              {(['week', 'month', 'semester'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  className={`fl-view-tab${view === v ? ' active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <SemesterPicker idx={semesterIdx} onChange={setSemesterIdx} />
              <span className="fl-period-label">{PERIOD_LABELS[view]}</span>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="fl-loading">Loading schedule…</div>
          ) : (
            <>
              {view === 'week'     && <WeekCarousel   key={activeSemester.key} events={filtered} typeColours={typeColours} onStartGame={() => setGameOpen(true)} semester={activeSemester} />}
              {view === 'month'    && <MonthCarousel  key={activeSemester.key} events={filtered} typeColours={typeColours} onStartGame={() => setGameOpen(true)} semester={activeSemester} />}
              {view === 'semester' && <SemesterGrid   key={activeSemester.key} events={filtered} typeColours={typeColours} onStartGame={() => setGameOpen(true)} semester={activeSemester} />}

              <div style={{ display: 'none' }} aria-hidden="true">
                <CalendarView events={events} view={view} search={search} />
                <SemesterOverview events={events} />
              </div>
            </>
          )}

        </div>
      </main>

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div className="fl-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="fl-search-box" onClick={e => e.stopPropagation()}>
            <div className="fl-search-header">
              <Ic.Search />
              <input
                autoFocus
                className="fl-search-input"
                placeholder="Search assignments, courses…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); }}
              />
            </div>
            {search && (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {filtered.length === 0
                  ? <div className="fl-empty" style={{ padding: '14px 16px' }}>No results</div>
                  : filtered.map(e => (
                    <div key={e.id} className="fl-search-result">
                      <div className="fl-search-result-title">{e.title}</div>
                      <div className="fl-search-result-sub">{e.course}</div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Help overlay ── */}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}

      {/* ── Settings overlay ── */}
      {settingsOpen && (
        <SettingsPanel
          typeColours={typeColours}
          onChangeColour={(t, v) => setTypeColours(prev => ({ ...prev, [t]: v }))}
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          onThemeToggle={toggleTheme}
        />
      )}

      {/* ── Game modal ── */}
      {gameOpen && <GameModal onClose={() => setGameOpen(false)} />}
    </div>
  );
}
