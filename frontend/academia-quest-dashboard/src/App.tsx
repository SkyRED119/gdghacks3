import { useState } from 'react';
import type { ViewMode, ThemeMode, SyncState } from './types';
import { MOCK_EVENTS, MOCK_PLAYER } from './data';
import { Navbar } from './components/Navbar';
import { CalendarView } from './components/CalendarView';
import { SemesterOverview } from './components/SemesterOverview';
import { GameModal } from './components/GameModal';
import { RefreshCw, CalendarDays } from 'lucide-react';

export default function App() {
  const [theme, setTheme]           = useState<ThemeMode>('dark');
  const [view, setView]             = useState<ViewMode>('semester');
  const [search, setSearch]         = useState('');
  const [syncState, setSyncState]   = useState<SyncState>('idle');
  const [lastSynced, setLastSynced] = useState('never');
  const [gameOpen, setGameOpen]     = useState(false);

  const events = MOCK_EVENTS;
  const player = MOCK_PLAYER;

  const handleSync = () => {
    setSyncState('syncing');
    setTimeout(() => {
      setSyncState('synced');
      setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1200);
  };

  const syncDot = {
    idle:    '#6b6b7a',
    syncing: '#f59e0b',
    synced:  '#10b981',
    error:   '#ef4444',
  }[syncState];

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        transition: 'background-color 0.25s, color 0.25s',
        overflowX: 'hidden',
      }}
    >
      <Navbar
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        view={view}
        onViewChange={setView}
        search={search}
        onSearch={setSearch}
        onOpenGame={() => setGameOpen(true)}
      />

      <main style={{
        flex: 1,
        width: '100%',
        padding: '20px 24px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box',
      }}>

        {/* Page header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <CalendarDays size={12} color="var(--text-muted)" />
              <span style={{
                fontSize: 11, color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
              }}>
                WINTER 2026 · SEMESTER DASHBOARD
              </span>
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 26, letterSpacing: '0.04em', lineHeight: 1.1,
            }}>
              YOUR QUEST BOARD
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Upload course outline PDFs → backend extracts deadlines → extension syncs grades.
            </p>
          </div>

          {/* Sync pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '7px 12px',
            fontSize: 11, fontFamily: 'var(--font-mono)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: syncDot, flexShrink: 0,
              boxShadow: syncState === 'syncing' ? `0 0 6px ${syncDot}` : undefined,
            }} />
            <span style={{ color: 'var(--text-muted)' }}>
              {syncState === 'syncing' ? 'Syncing…' : `Last synced ${lastSynced}`}
            </span>
            <button onClick={handleSync} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <RefreshCw
                size={11}
                style={{ animation: syncState === 'syncing' ? 'spin 1s linear infinite' : undefined }}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Calendar — full width */}
        <CalendarView events={events} view={view} search={search} />

        {/* Semester overview — full width at the bottom */}
        <SemesterOverview events={events} />

      </main>

      {gameOpen && <GameModal onClose={() => setGameOpen(false)} />}
    </div>
  );
}