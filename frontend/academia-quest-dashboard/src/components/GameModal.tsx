/**
 * GameModal.tsx
 *
 * Shell for the Quest Arena / Boss Raid game.
 *
 * ── How to plug in your game ────────────────────────────────────────────────
 * 1. Build your game as a React component, e.g. <BossRaid />.
 * 2. Import it here and replace <GamePlaceholder /> below.
 * 3. Pass `api` down if the game needs to call backend endpoints.
 *
 * The backend game endpoints expected (add them to main.py when ready):
 *   POST /api/game/start   → { sessionId, boss, playerHp, bossHp }
 *   POST /api/game/action  { sessionId, action } → updated state
 *   GET  /api/game/state/:sessionId → current state
 *
 * The api helpers are already in src/lib/api.ts:
 *   api.gameStart()
 *   api.gameAction(sessionId, action)
 *   api.gameState(sessionId)
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useAuth } from "../hooks/useAuth";
// import { BossRaid } from "./BossRaid"; // ← uncomment when your game is ready

interface Props {
  onClose: () => void;
}

// ─── Placeholder shown until the game component is ready ─────────────────────
function GamePlaceholder() {
  return (
    <div
      style={{
        height: 420,
        border: "1px dashed var(--border-strong)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "var(--bg-surface)",
      }}
    >
      <span style={{ fontSize: 56 }}>🐉</span>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          color: "var(--text)",
          letterSpacing: "0.06em",
        }}
      >
        BOSS RAID — COMING SOON
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.6,
          maxWidth: 360,
        }}
      >
        When your game component is ready:
        <br />
        1. Import it at the top of <code>GameModal.tsx</code>
        <br />
        2. Replace <code>&lt;GamePlaceholder /&gt;</code> with <code>&lt;BossRaid /&gt;</code>
        <br />
        3. The backend game API is already wired in <code>src/lib/api.ts</code>
      </p>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
export function GameModal({ onClose }: Props) {
  const { user } = useAuth();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 860,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          margin: "0 16px",
        }}
      >
        {/* Header */}
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                color: "var(--text)",
                fontStyle: "italic",
              }}
            >
              ⚔ Quest Arena
            </h2>
            {user && (
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                Level {user.level} · {user.xp} XP · {user.streak} day streak
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              borderRadius: 8,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── SWAP THIS OUT when your game component is ready ─────────────── */}
        <GamePlaceholder />
        {/* <BossRaid user={user} onXpEarned={handleXp} /> */}
        {/* ──────────────────────────────────────────────────────────────────── */}
      </div>
    </div>
  );
}
