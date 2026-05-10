import { Coins, TrendingUp, BookOpen, CheckSquare } from 'lucide-react';
import type { PlayerState, CourseEvent } from '../types';

interface Props {
  player: PlayerState;
  events: CourseEvent[];
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-week)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function PlayerSidebar({ player, events }: Props) {
  const graded = events.filter(e => e.grade != null);
  const totalWeight = events.reduce((s, e) => s + e.weight, 0);
  const completedWeight = graded.reduce((s, e) => s + e.weight, 0);
  const weightPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  const avgGrade = graded.length > 0
    ? Math.round(graded.reduce((s, e) => s + (e.grade ?? 0), 0) / graded.length)
    : null;

  const upcoming = events
    .filter(e => !e.grade)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .slice(0, 4);

  const typeColors: Record<string, string> = {
    assignment: '#7c3aed',
    midterm:    '#f59e0b',
    exam:       '#ef4444',
    quiz:       '#3b82f6',
    lab:        '#10b981',
    important:  '#c026d3',
  };

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Academic summary ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 13, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2,
        }}>
          SEMESTER OVERVIEW
        </h3>

        <StatCard
          icon={<BookOpen size={16} color="#a78bfa" />}
          label="TOTAL ITEMS"
          value={events.length}
          sub="across all courses"
        />
        <StatCard
          icon={<CheckSquare size={16} color="#10b981" />}
          label="GRADED SO FAR"
          value={graded.length}
          sub={`${weightPercent}% of weight assessed`}
        />
        <StatCard
          icon={<TrendingUp size={16} color="#f59e0b" />}
          label="CURRENT AVG"
          value={avgGrade != null ? `${avgGrade}%` : '—'}
          sub={avgGrade != null ? (avgGrade >= 80 ? 'Great work!' : avgGrade >= 65 ? 'Keep pushing' : 'Needs focus') : 'No grades yet'}
        />
        <StatCard
          icon={<Coins size={16} color="#c026d3" />}
          label="WEIGHT TOTAL"
          value={`${totalWeight}%`}
          sub="tracked from outlines"
        />
      </div>

      {/* ── Upcoming deadlines ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 13, letterSpacing: '0.08em', color: 'var(--text-muted)',
        }}>
          UP NEXT
        </h3>

        {upcoming.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            All caught up!
          </p>
        ) : (
          upcoming.map(ev => (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8,
              background: 'var(--bg-week)', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
                background: typeColors[ev.type] ?? '#6b7280',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{ev.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {ev.courseCode} · {ev.date}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: typeColors[ev.type] ?? '#6b7280',
                background: `${typeColors[ev.type] ?? '#6b7280'}18`,
                padding: '2px 6px', borderRadius: 4, flexShrink: 0,
              }}>{ev.weight}%</span>
            </div>
          ))
        )}
      </div>

      {/* ── Extension sync ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 13, letterSpacing: '0.08em', color: 'var(--text-muted)',
        }}>
          EXTENSION SYNC
        </h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Install the Academia Quest Chrome extension and visit Brightspace to auto-sync grades.
        </p>
        <div style={{
          background: 'var(--bg-week)', borderRadius: 8, padding: '8px 10px',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-sub)', lineHeight: 1.7,
        }}>
          Extension → background.js<br />
          → POST /api/grades/sync<br />
          → Updates CourseEvent.grade
        </div>
      </div>

    </aside>
  );
}