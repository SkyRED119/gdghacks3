/**
 * GameModal.tsx
 *
 * Quest Arena entry-point.
 *
 * Flow:
 *   Calendar dashboard → "Start Game" button → this modal opens to the MENU
 *   Menu has three options:
 *     · Start     → enters the playable arena (GameCanvas)
 *     · Customize → opens armor color customization
 *     · Return    → closes the modal back to the dashboard
 *
 * Pricing rules surfaced in the customize screen:
 *   · 10 gems per individual armor color (helmet / upper body / lower body)
 *   · 30 gems for a full matching set (all three pieces in the same color)
 *
 * Gem economy (from grades):
 *   <50 = 0 · 50–59 = 2 · 60–69 = 4 · 70–79 = 6 · 80–89 = 8 · 90+ = 10
 *
 * The player starts wearing a full silver set, with silver as the only
 * unlocked color in every slot.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { GameCanvas, type ArmorColor, type ArmorSlot, type ArmorSelection } from './GameCanvas';

interface Props {
  onClose: () => void;
  isDark?: boolean;
}

type Screen = 'menu' | 'customize' | 'game';

type Unlocks = Record<ArmorSlot, ArmorColor[]>;

type GradeInput = {
  id: number;
  name: string;
  percent: number;
};

const AVAILABLE_COLORS: ArmorColor[] = ['silver', 'red', 'blue', 'gold', 'black'];
const ARMOR_SLOTS: ArmorSlot[] = ['head', 'chest', 'legs'];
const ITEM_COST = 10;
const FULL_SET_COST = 30;

const STARTING_ARMOR: ArmorSelection = {
  head: 'silver',
  chest: 'silver',
  legs: 'silver',
};

const STARTING_UNLOCKS: Unlocks = {
  head: ['silver'],
  chest: ['silver'],
  legs: ['silver'],
};

function gemsForGrade(percent: number) {
  if (percent < 50) return 0;
  if (percent < 60) return 2;
  if (percent < 70) return 4;
  if (percent < 80) return 6;
  if (percent < 90) return 8;
  return 10;
}

function slotLabel(slot: ArmorSlot) {
  if (slot === 'head') return 'Helmet';
  if (slot === 'chest') return 'Upper Body';
  return 'Lower Body';
}

function colorLabel(color: ArmorColor) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

const SWATCH_HEX: Record<ArmorColor, string> = {
  silver: '#cbd5d5',
  red: '#a64242',
  blue: '#3a5a8a',
  gold: '#c9a14a',
  black: '#1f1f1d',
};

// ─── Inline scoped styles ───────────────────────────────────────────────────
// All scoped under .aq-game-modal so they don't leak into the dashboard.
const MODAL_CSS = `
.aq-game-modal-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.62);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 8px;
  animation: aq-fadein 0.18s ease;
}

.aq-game-modal {
  width: 100%; max-width: 980px; max-height: calc(100vh - 32px);
  overflow: auto;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  font-family: var(--font-body);
  color: var(--text);
  animation: aq-popin 0.22s ease;
}

/* Game mode: lock the modal to the viewport, no outer scroll. The game
   shell fills the remaining space, and the side panel scrolls internally
   if its content overflows. */
.aq-game-modal--game {
  max-width: 1400px;
  width: 100%;
  height: calc(100vh - 16px);
  max-height: calc(100vh - 16px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.aq-game-modal--game .aq-modal-header {
  flex-shrink: 0;
  padding: 8px 16px;
}
.aq-game-modal--game .aq-modal-title { font-size: 22px; }

@keyframes aq-fadein { from { opacity: 0; } to { opacity: 1; } }
@keyframes aq-popin {
  from { opacity: 0; transform: scale(0.97) translateY(4px); }
  to { opacity: 1; transform: none; }
}

/* Header bar */
.aq-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 22px 28px;
  border-bottom: 1.5px solid var(--border);
  gap: 14px;
}
.aq-modal-title {
  font-family: var(--font-display);
  font-size: 26px;
  font-style: italic;
  color: var(--text);
  margin: 0;
}
.aq-modal-eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 2px;
}
.aq-modal-close {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  border-radius: 8px;
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.aq-modal-close:hover {
  background: var(--bg-surface); color: var(--text);
  border-color: var(--border-strong);
}

.aq-modal-body { padding: 28px; }

.aq-modal-body--game {
  flex: 1 1 auto;
  min-height: 0;
  padding: 6px 12px 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Eyebrow + sub copy used inside body */
.aq-eyebrow {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin: 0 0 8px;
}
.aq-h1 {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 40px);
  font-style: italic;
  color: var(--text);
  line-height: 1.05;
  margin: 0 0 14px;
}
.aq-h2 {
  font-family: var(--font-display);
  font-size: 19px;
  font-style: italic;
  color: var(--text);
  margin: 0 0 12px;
}
.aq-copy {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 22px;
  max-width: 640px;
}
.aq-muted {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

/* Buttons (mirror .fl-game-btn idiom: outlined, uppercase, letterspaced) */
.aq-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; padding: 12px 26px;
  background: none;
  border: 1.5px solid var(--border-strong);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.aq-btn:hover:not(:disabled) {
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}
.aq-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.aq-btn-primary {
  background: var(--text);
  color: var(--bg-card);
  border-color: var(--text);
}
.aq-btn-primary:hover:not(:disabled) {
  background: var(--text);
  color: var(--bg-card);
  opacity: 0.88;
}

.aq-btn-ghost {
  border-color: var(--border);
  color: var(--text-muted);
  font-weight: 500;
}

.aq-btn-block { width: 100%; }

/* Menu screen */
.aq-menu-stack {
  display: grid;
  gap: 12px;
  width: min(360px, 100%);
  margin: 4px auto 0;
}

.aq-gem-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.aq-menu-gem-row {
  display: flex; justify-content: center;
  margin-top: 22px;
}

.aq-rules-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin: 18px 0 26px;
}
.aq-rules-grid > div {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 8px;
  background: var(--bg-surface);
  text-align: center;
}
.aq-rules-grid strong {
  display: block;
  font-size: 13px;
  color: var(--text);
  font-weight: 600;
}
.aq-rules-grid span {
  display: block;
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.04em;
}

/* Pricing banner on customize screen */
.aq-pricing {
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 22px;
  display: grid;
  gap: 6px;
}
.aq-pricing-row {
  display: flex; align-items: baseline; gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
}
.aq-pricing-amount {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 20px;
  color: var(--text);
  min-width: 90px;
}
.aq-pricing-row span { color: var(--text-muted); }

/* Customize layout */
.aq-customize-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 24px;
  align-items: start;
}

.aq-preview-panel {
  display: grid;
  gap: 12px;
  justify-items: center;
  padding: 18px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  border-radius: 12px;
  position: sticky;
  top: 0;
}
.aq-sprite-stage {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  display: grid; place-items: center;
}
.aq-sprite-stage canvas {
  image-rendering: pixelated;
  display: block;
}
.aq-equipped-line {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  text-align: center;
  margin: 0;
}

.aq-shop-stack { display: grid; gap: 16px; }

.aq-shop-section {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  background: var(--bg-card);
}
.aq-shop-section h3 {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  font-family: var(--font-display);
  font-style: italic;
  font-size: 17px;
  margin: 0 0 12px;
  font-weight: 400;
  color: var(--text);
}
.aq-cost-tag {
  font-family: var(--font-body);
  font-size: 10.5px;
  font-style: normal;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  padding: 3px 9px;
  border-radius: 5px;
  font-weight: 500;
}
.aq-cost-tag.aq-cost-tag--accent {
  color: var(--text);
  border-color: var(--border-strong);
}

.aq-shop-section--bundle {
  border-color: var(--border-strong);
  background:
    linear-gradient(to bottom right, var(--bg-surface), var(--bg-card));
}
.aq-bundle-blurb {
  font-size: 12px;
  color: var(--text-muted);
  margin: -4px 0 12px;
  line-height: 1.55;
}

.aq-color-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.aq-color-card {
  display: grid; gap: 6px; justify-items: center;
  border-radius: 8px;
  padding: 12px 6px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  font-family: var(--font-body);
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s;
}
.aq-color-card:hover:not(:disabled) {
  background: var(--bg-surface);
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.aq-color-card:disabled { opacity: 0.4; cursor: not-allowed; }
.aq-color-card.aq-equipped {
  border-color: var(--text);
  box-shadow: 0 0 0 1.5px var(--text);
}
.aq-swatch {
  width: 28px; height: 28px;
  border-radius: 999px;
  border: 1.5px solid var(--border-strong);
}
.aq-color-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.aq-color-status {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Game screen */
.aq-game-shell {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 8px;
  align-items: stretch;
}
.aq-game-container {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: transparent;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  min-width: 0;
  min-height: 0;
  position: relative;
}
.aq-game-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
  image-rendering: pixelated;
}
.aq-side-panel {
  display: grid;
  gap: 12px;
  align-content: start;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;       /* gap so scrollbar doesn't overlap card edges */
}
.aq-panel-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--bg-card);
}
.aq-panel-card h3 {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 16px;
  margin: 0 0 10px;
  color: var(--text);
  font-weight: 400;
}
.aq-panel-card p {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 4px 0;
  display: flex;
  align-items: center;
}
.aq-kbd {
  display: inline-grid; place-items: center;
  min-width: 26px; height: 24px;
  margin-right: 8px;
  border-radius: 5px;
  background: var(--bg-surface);
  color: var(--text);
  border: 1px solid var(--border);
  font-family: var(--font-body);
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.04em;
}
.aq-grade-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 10px 0;
}
.aq-grade-buttons button {
  padding: 8px 4px;
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text);
  border: 1px solid var(--border);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
  transition: background 0.12s, border-color 0.12s;
}
.aq-grade-buttons button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.aq-game-topbar {
  display: flex; justify-content: flex-end; align-items: center;
  margin-bottom: 6px; gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.aq-customize-actions {
  margin-top: 22px;
  display: flex; justify-content: flex-start;
}

.aq-loading {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 320px;
  padding: 40px 20px;
  text-align: center;
  font-family: var(--font-body);
  color: var(--text-faint);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  animation: fl-pulse 1.6s ease infinite;
}
.aq-loading p { text-transform: none; letter-spacing: 0.02em; font-size: 13px; }
@keyframes fl-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

@media (max-width: 880px) {
  .aq-customize-layout { grid-template-columns: 1fr; }
  .aq-preview-panel { position: static; }
  .aq-rules-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .aq-color-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  .aq-game-shell {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .aq-side-panel {
    max-height: 30vh;
  }
}
`;

// ─── Sprite preview used inside Customize ───────────────────────────────────
function SpritePreview({ armor }: { armor: ArmorSelection }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<ArmorSlot, Record<ArmorColor, HTMLImageElement>>>(
    {} as Record<ArmorSlot, Record<ArmorColor, HTMLImageElement>>
  );

  if (!imagesRef.current.head) {
    ARMOR_SLOTS.forEach((slot) => {
      imagesRef.current[slot] = {} as Record<ArmorColor, HTMLImageElement>;
      AVAILABLE_COLORS.forEach((color) => {
        const img = new Image();
        img.src = `/sprites/armor/${slot}/${color}/idle.png`;
        imagesRef.current[slot][color] = img;
      });
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const FRAME_SIZE = 64;
    const SCALE = 4;
    const DOWN_ROW = 2;

    const draw = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const order: ArmorSlot[] = ['legs', 'chest', 'head'];
      order.forEach((slot) => {
        const img = imagesRef.current[slot][armor[slot]];
        if (!img.complete || img.naturalWidth === 0) return;
        ctx.drawImage(
          img,
          0,
          DOWN_ROW * FRAME_SIZE,
          FRAME_SIZE,
          FRAME_SIZE,
          (canvas.width - FRAME_SIZE * SCALE) / 2,
          (canvas.height - FRAME_SIZE * SCALE) / 2,
          FRAME_SIZE * SCALE,
          FRAME_SIZE * SCALE
        );
      });
    };

    let attempts = 0;
    let timer: number | undefined;
    const tick = () => {
      draw();
      attempts += 1;
      if (attempts < 30) {
        timer = window.setTimeout(tick, 60);
      }
    };
    tick();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [armor]);

  return (
    <div className="aq-sprite-stage">
      <canvas ref={canvasRef} width={288} height={288} />
    </div>
  );
}

// ─── Main modal ─────────────────────────────────────────────────────────────
export function GameModal({ onClose, isDark: initialDark = false }: Props) {
  const { user } = useAuth();
  const [gameDark, setGameDark] = useState(initialDark);

  const [screen, setScreen] = useState<Screen>('menu');
  const [gems, setGems] = useState(0);
  const [armor, setArmor] = useState<ArmorSelection>(STARTING_ARMOR);
  const [unlocks, setUnlocks] = useState<Unlocks>(STARTING_UNLOCKS);
  const [grades, setGrades] = useState<GradeInput[]>([]);

  // Persistence flags. `loaded` flips true once the initial backend fetch
  // resolves — only then do we start saving back, so the placeholder
  // STARTING_ARMOR doesn't overwrite the real data on the way in.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Initial load: pull this user's persisted state from the backend.
  // The endpoint creates a default silver-armor record on the server's
  // side if the user has never played, so we can rely on the response
  // shape always being valid.
  useEffect(() => {
    let cancelled = false;
    api.questArenaGet()
      .then((state) => {
        if (cancelled) return;
        setGems(state.gems);
        setArmor(state.armor as ArmorSelection);
        setUnlocks(state.unlocks as Unlocks);
        setGrades(state.pendingGrades);
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // Fail open — keep the placeholder silver state and let the player
        // play offline. We don't flip `loaded` so we won't overwrite the
        // server with this in-memory state.
        setLoadError(err.message || 'Could not load saved progress');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Debounced save: whenever any persisted field changes after the
  // initial load, schedule a save. Subsequent changes within 600ms cancel
  // and replace the pending save, so the server only sees one PUT per
  // burst of activity (e.g. clicking through several armor swatches).
  const saveTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      api.questArenaSave({
        gems,
        armor,
        unlocks,
        pendingGrades: grades,
      }).catch(() => {
        // Silently ignore network errors — the next state change will
        // try again. We deliberately don't surface a toast for every
        // failed save to avoid pestering the player mid-game.
      });
    }, 600);
    return () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [loaded, gems, armor, unlocks, grades]);

  const earnedGemPreview = useMemo(
    () => grades.reduce((total, g) => total + gemsForGrade(g.percent), 0),
    [grades]
  );

  function claimGradeGems() {
    setGems((current) => current + earnedGemPreview);
    setGrades([]);
  }

  function addTestGrade(percent: number) {
    setGrades((current) => [
      ...current,
      { id: Date.now(), name: `Test Grade ${percent}%`, percent },
    ]);
  }

  // Per-piece purchase / equip — same logic as the original game.
  function buyColor(slot: ArmorSlot, color: ArmorColor) {
    const alreadyOwned = unlocks[slot].includes(color);

    if (alreadyOwned) {
      setArmor((current) => ({ ...current, [slot]: color }));
      return;
    }
    if (gems < ITEM_COST) return;

    setGems((current) => current - ITEM_COST);
    setUnlocks((current) => ({
      ...current,
      [slot]: [...current[slot], color],
    }));
    setArmor((current) => ({ ...current, [slot]: color }));
  }

  // Full-set bundle — 30 gems for all three pieces in one color.
  function buyFullSet(color: ArmorColor) {
    const missingSlots = ARMOR_SLOTS.filter((slot) => !unlocks[slot].includes(color));
    if (missingSlots.length === 0) {
      setArmor({ head: color, chest: color, legs: color });
      return;
    }
    if (gems < FULL_SET_COST) return;

    setGems((current) => current - FULL_SET_COST);
    setUnlocks((current) => {
      const next = { ...current };
      missingSlots.forEach((slot) => {
        next[slot] = [...next[slot], color];
      });
      return next;
    });
    setArmor({ head: color, chest: color, legs: color });
  }

  const inGame = screen === 'game';

  return (
    <div
      className="aq-game-modal-backdrop"
      onClick={onClose}
    >
      <style>{MODAL_CSS}</style>
      <div
        className={`aq-game-modal${inGame ? ' aq-game-modal--game' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="aq-modal-header">
          <div>
            <p className="aq-modal-eyebrow">⚔ Quest Arena</p>
            <h2 className="aq-modal-title">
              {screen === 'menu' && 'Choose your path'}
              {screen === 'customize' && 'Customize your armor'}
              {screen === 'game' && 'Armor Arena'}
            </h2>
            {user && (
              <span style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
                Level {user.level} · {user.xp} XP · {user.streak} day streak
              </span>
            )}
          </div>
          <button className="aq-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className={`aq-modal-body${inGame ? ' aq-modal-body--game' : ''}`}>
          {!loaded && !loadError && (
            <div className="aq-loading">Loading your saved progress…</div>
          )}

          {!loaded && loadError && (
            <div className="aq-loading">
              <p style={{ color: 'var(--text)', marginBottom: 8 }}>
                Couldn't reach the save server.
              </p>
              <p className="aq-muted" style={{ marginBottom: 16 }}>
                {loadError}. You can still play, but progress won't be saved this session.
              </p>
              <button
                className="aq-btn aq-btn-ghost"
                onClick={() => setLoaded(true)}
              >
                Continue offline
              </button>
            </div>
          )}

          {loaded && screen === 'menu' && (
            <>
              <p className="aq-eyebrow">Academia Quest</p>
              <h1 className="aq-h1">Turn grades into gear.</h1>
              <p className="aq-copy">
                You start with a full silver set. Earn gems from good grades, then spend
                them on new helmet, upper body, and lower body colors.
              </p>

              <div className="aq-rules-grid">
                <div><strong>&lt; 50%</strong><span>0 gems</span></div>
                <div><strong>50-59%</strong><span>2 gems</span></div>
                <div><strong>60-69%</strong><span>4 gems</span></div>
                <div><strong>70-79%</strong><span>6 gems</span></div>
                <div><strong>80-89%</strong><span>8 gems</span></div>
                <div><strong>90%+</strong><span>10 gems</span></div>
              </div>

              <div className="aq-menu-stack">
                <button
                  className="aq-btn aq-btn-primary aq-btn-block"
                  onClick={() => setScreen('game')}
                >
                  Start
                </button>
                <button
                  className="aq-btn aq-btn-block"
                  onClick={() => setScreen('customize')}
                >
                  Customize
                </button>
                <button
                  className="aq-btn aq-btn-ghost aq-btn-block"
                  onClick={onClose}
                >
                  Return
                </button>
              </div>

              <div className="aq-menu-gem-row">
                <span className="aq-gem-pill">💎 {gems} gems</span>
              </div>
            </>
          )}

          {loaded && screen === 'customize' && (
            <>
              <p className="aq-eyebrow">Armor Atelier</p>
              <h1 className="aq-h1">Customize your armor.</h1>
              <p className="aq-copy">
                Mix and match helmet, upper body, and lower body colors. Silver is yours
                by default — every other color must be unlocked with gems.
              </p>

              <div className="aq-pricing">
                <div className="aq-pricing-row">
                  <span className="aq-pricing-amount">10 gems</span>
                  <span>per individual piece — helmet, upper body, or lower body</span>
                </div>
                <div className="aq-pricing-row">
                  <span className="aq-pricing-amount">30 gems</span>
                  <span>full matching set — all three pieces in the same color, in one purchase</span>
                </div>
              </div>

              <div className="aq-customize-layout">
                <div className="aq-preview-panel">
                  <SpritePreview armor={armor} />
                  <span className="aq-gem-pill">💎 {gems} gems</span>
                  <p className="aq-equipped-line">
                    Wearing: {colorLabel(armor.head)} helmet · {colorLabel(armor.chest)} upper · {colorLabel(armor.legs)} lower
                  </p>
                </div>

                <div className="aq-shop-stack">
                  {ARMOR_SLOTS.map((slot) => (
                    <div className="aq-shop-section" key={slot}>
                      <h3>
                        {slotLabel(slot)}
                        <span className="aq-cost-tag">10 gems / color</span>
                      </h3>
                      <div className="aq-color-grid">
                        {AVAILABLE_COLORS.map((color) => {
                          const owned = unlocks[slot].includes(color);
                          const equipped = armor[slot] === color;
                          const disabled = !owned && gems < ITEM_COST;

                          return (
                            <button
                              key={`${slot}-${color}`}
                              className={`aq-color-card${equipped ? ' aq-equipped' : ''}`}
                              disabled={disabled}
                              onClick={() => buyColor(slot, color)}
                            >
                              <span
                                className="aq-swatch"
                                style={{ background: SWATCH_HEX[color] }}
                              />
                              <span className="aq-color-name">{colorLabel(color)}</span>
                              <span className="aq-color-status">
                                {owned ? (equipped ? 'Equipped' : 'Owned') : '10 gems'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="aq-shop-section aq-shop-section--bundle">
                    <h3>
                      Full Set Bundle
                      <span className="aq-cost-tag aq-cost-tag--accent">30 gems / set</span>
                    </h3>
                    <p className="aq-bundle-blurb">
                      Unlock and equip all three pieces in one color at once.
                      Always 30 gems flat — saving up to 10 versus buying piece-by-piece.
                    </p>
                    <div className="aq-color-grid">
                      {AVAILABLE_COLORS.map((color) => {
                        const ownedCount = ARMOR_SLOTS.filter((slot) =>
                          unlocks[slot].includes(color)
                        ).length;
                        const fullyOwned = ownedCount === ARMOR_SLOTS.length;
                        const fullyEquipped = ARMOR_SLOTS.every((slot) => armor[slot] === color);
                        const disabled = !fullyOwned && gems < FULL_SET_COST;

                        let label: string;
                        if (fullyEquipped) label = 'Equipped';
                        else if (fullyOwned) label = 'Equip set';
                        else label = '30 gems';

                        return (
                          <button
                            key={`set-${color}`}
                            className={`aq-color-card${fullyEquipped ? ' aq-equipped' : ''}`}
                            disabled={disabled}
                            onClick={() => buyFullSet(color)}
                          >
                            <span
                              className="aq-swatch"
                              style={{ background: SWATCH_HEX[color] }}
                            />
                            <span className="aq-color-name">{colorLabel(color)} Set</span>
                            <span className="aq-color-status">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="aq-customize-actions">
                <button
                  className="aq-btn aq-btn-ghost"
                  onClick={() => setScreen('menu')}
                >
                  Back to Menu
                </button>
              </div>
            </>
          )}

          {loaded && screen === 'game' && (
            <>
              <div className="aq-game-topbar">
                <span className="aq-gem-pill">💎 {gems} gems</span>
                <button
                  className="aq-btn aq-btn-ghost"
                  onClick={() => setGameDark(d => !d)}
                  title="Toggle game theme"
                  style={{ minWidth: 110 }}
                >
                  {gameDark ? '☀ Light mode' : '🌙 Dark mode'}
                </button>
                <button
                  className="aq-btn aq-btn-ghost"
                  onClick={() => setScreen('menu')}
                >
                  Back to Menu
                </button>
              </div>

              <div className="aq-game-shell">
                <GameCanvas armor={armor} isDark={gameDark} />

                <aside className="aq-side-panel">
                  <div className="aq-panel-card">
                    <h3>Controls</h3>
                    <p><span className="aq-kbd">W</span> run up</p>
                    <p><span className="aq-kbd">A</span> run left</p>
                    <p><span className="aq-kbd">S</span> run down</p>
                    <p><span className="aq-kbd">D</span> run right</p>
                    <p><span className="aq-kbd">␣</span> slash facing direction</p>
                  </div>

                  <div className="aq-panel-card">
                    <h3>Equipped Armor</h3>
                    {ARMOR_SLOTS.map((slot) => (
                      <p key={slot}>
                        <strong style={{ color: 'var(--text)', marginRight: 6, fontWeight: 500 }}>
                          {slotLabel(slot)}:
                        </strong>
                        {colorLabel(armor[slot])}
                      </p>
                    ))}
                  </div>

                  <div className="aq-panel-card">
                    <h3>Grade Gem Test</h3>
                    <p className="aq-muted" style={{ margin: '0 0 4px' }}>
                      Temporary until D2L grade sync is connected.
                    </p>
                    <div className="aq-grade-buttons">
                      {[45, 55, 65, 75, 85, 95].map((g) => (
                        <button key={g} onClick={() => addTestGrade(g)}>{g}%</button>
                      ))}
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 10px' }}>
                      Pending gems:{' '}
                      <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
                        {earnedGemPreview}
                      </strong>
                    </p>
                    <button
                      className="aq-btn aq-btn-primary aq-btn-block"
                      disabled={earnedGemPreview === 0}
                      onClick={claimGradeGems}
                    >
                      Claim Grade Gems
                    </button>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
