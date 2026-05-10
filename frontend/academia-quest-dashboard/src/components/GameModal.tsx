interface Props {
  onClose: () => void;
}

export function GameModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: 32,
          display: 'flex', flexDirection: 'column', gap: 20,
          margin: '0 16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 28,
            fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text)',
          }}>
            ⚔ QUEST ARENA
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 18, borderRadius: 8, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── GAME GOES HERE ───────────────────────────────────────────────── */}
        {/* When your game is ready, replace everything inside this div       */}
        {/* with your game component, e.g: <BossRaid /> or <GameScreen />     */}
        <div style={{
          height: 420,
          background: 'var(--bg-week)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 14,
        }}>
          <span style={{ fontSize: 56 }}>🐉</span>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em',
          }}>
            BOSS RAID — COMING SOON
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
            WebSocket multiplayer · character upgrades · boss fights<br />
            Drop your game component in GameModal.tsx where this placeholder is
          </p>
        </div>
        {/* ── END GAME PLACEHOLDER ─────────────────────────────────────────── */}

      </div>
    </div>
  );
}