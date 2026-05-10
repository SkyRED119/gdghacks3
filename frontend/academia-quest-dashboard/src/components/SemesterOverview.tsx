import { BookOpen, CheckSquare, TrendingUp, Weight } from 'lucide-react';
import type { CourseEvent } from '../types';

interface Props {
  events: CourseEvent[];
}

export function SemesterOverview({ events }: Props) {
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
    .slice(0, 5);

  const typeColors: Record<string, string> = {
    assignment: '#7c3aed',
    midterm:    '#f59e0b',
    exam:       '#ef4444',
    quiz:       '#3b82f6',
    lab:        '#10b981',
    important:  '#c026d3',
  };

  const stats = [
    {
      icon: <BookOpen size={18} color="#a78bfa" />,
      label: 'TOTAL ITEMS',
      value: events.length,
      sub: 'across all courses',
    },
    {
      icon: <CheckSquare size={18} color="#10b981" />,
      label: 'GRADED SO FAR',
      value: graded.length,
      sub: `${weightPercent}% of weight assessed`,
    },
    {
      icon: <TrendingUp size={18} color="#f59e0b" />,
      label: 'CURRENT AVG',
      value: avgGrade != null ? `${avgGrade}%` : '—',
      sub: avgGrade != null
        ? avgGrade >= 80 ? 'Great work!' : avgGrade >= 65 ? 'Keep pushing' : 'Needs focus'
        : 'No grades yet',
    },
    {
      icon: <Weight size={18} color="#c026d3" />,
      label: 'WEIGHT TRACKED',
      value: `${totalWeight}%`,
      sub: 'parsed from outlines',
    },
  ];

  return (
    <div style={{
      width: '100%',
      background: 'var(--bg-month)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: 13, letterSpacing: '0.08em', color: 'var(--text-muted)',
      }}>
        SEMESTER OVERVIEW
      </h3>

      {/* Stat cards row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}>
        {stats.map(({ icon, label, value, sub }) => (
          <div key={label} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {icon}
              </div>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {label}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: 'var(--text)', lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Up next row */}
      {upcoming.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)', letterSpacing: '0.06em',
          }}>
            UP NEXT
          </span>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${upcoming.length}, 1fr)`,
            gap: 10,
          }}>
            {upcoming.map(ev => (
              <div key={ev.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${typeColors[ev.type] ?? '#6b7280'}`,
                borderRadius: 10, padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {ev.courseCode} · {ev.date}
                </div>
                <div style={{
                  marginTop: 2,
                  fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: typeColors[ev.type] ?? '#6b7280',
                }}>
                  {ev.weight}% weight
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}