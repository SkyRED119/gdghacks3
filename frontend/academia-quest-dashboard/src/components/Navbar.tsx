import { useState } from 'react';
import { Search, Settings, HelpCircle, User, Moon, Sun, Zap, X } from 'lucide-react';
import type { ViewMode, ThemeMode } from '../types';

interface Props {
  theme: ThemeMode;
  onThemeToggle: () => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  search: string;
  onSearch: (s: string) => void;
  onOpenGame: () => void;
}

export function Navbar({ theme, onThemeToggle, view, onViewChange, search, onSearch, onOpenGame }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const isDark = theme === 'dark';

  const navStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    height: 'var(--nav-h)',
    background: isDark ? 'rgba(9,9,9,0.92)' : 'rgba(242,242,245,0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border)',
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: '0 24px',
    gap: 16,
  };

  const iconBtn: React.CSSProperties = {
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--border)', borderRadius: 10,
    background: 'transparent', color: 'var(--text-muted)',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
  };

  const viewBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 8, border: 'none',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    fontFamily: 'var(--font-display)', fontWeight: 700,
    fontSize: 14, letterSpacing: '0.04em',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
    textTransform: 'uppercase',
  });

  return (
    <nav style={navStyle}>

      {/* LEFT — logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, flexShrink: 0,
          background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(124,58,237,0.45)',
        }}>
          <Zap size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '0.06em', lineHeight: 1 }}>
            COURSE<span style={{ color: 'var(--accent)' }}>QUEST</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
            academia · gamified
          </div>
        </div>
      </div>

      {/* CENTER — game button + view switcher */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <button
          onClick={onOpenGame}
          style={{
            padding: '7px 24px', borderRadius: 10,
            border: '1px solid rgba(124,58,237,0.5)',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(192,38,211,0.18))',
            color: '#a78bfa', fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 14, letterSpacing: '0.1em',
            cursor: 'pointer', transition: 'background 0.15s, box-shadow 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(192,38,211,0.3))';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(192,38,211,0.18))';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          ⚔ START GAME
        </button>

        <div style={{
          display: 'flex',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: 2, gap: 2,
        }}>
          {(['week', 'month', 'semester'] as ViewMode[]).map(v => (
            <button key={v} style={viewBtn(view === v)} onClick={() => onViewChange(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT — search + icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        {searchOpen && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
            borderRadius: 10, padding: '6px 10px', flex: 1, maxWidth: 260,
          }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              autoFocus
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-body)',
                minWidth: 0,
              }}
            />
            {search && (
              <button onClick={() => onSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {[
          { icon: <Search size={15} />, action: () => setSearchOpen(s => !s), label: 'Search' },
          { icon: <Settings size={15} />, action: () => {}, label: 'Settings' },
          { icon: <HelpCircle size={15} />, action: () => {}, label: 'Help' },
          { icon: <User size={15} />, action: () => {}, label: 'Account' },
        ].map(({ icon, action, label }) => (
          <button key={label} style={iconBtn} title={label} onClick={action}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-week)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >{icon}</button>
        ))}

        <button
          style={{ ...iconBtn, background: isDark ? 'var(--bg-week)' : 'var(--bg-month)' }}
          onClick={onThemeToggle}
          title="Toggle theme"
        >
          {isDark ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="#7c3aed" />}
        </button>
      </div>
    </nav>
  );
}