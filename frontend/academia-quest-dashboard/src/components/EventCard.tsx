import type { CourseEvent, EventType } from '../types';

const TYPE_COLORS: Record<EventType, { bar: string; badge: string; label: string }> = {
  assignment: { bar: '#7c3aed', badge: 'rgba(124,58,237,0.15)', label: '#a78bfa' },
  midterm:    { bar: '#f59e0b', badge: 'rgba(245,158,11,0.15)', label: '#fcd34d' },
  exam:       { bar: '#ef4444', badge: 'rgba(239,68,68,0.15)',  label: '#fca5a5' },
  quiz:       { bar: '#3b82f6', badge: 'rgba(59,130,246,0.15)', label: '#93c5fd' },
  lab:        { bar: '#10b981', badge: 'rgba(16,185,129,0.15)', label: '#6ee7b7' },
  important:  { bar: '#c026d3', badge: 'rgba(192,38,211,0.15)', label: '#e879f9' },
};

function getRarity(weight: number) {
  if (weight >= 35) return { label: 'LEGENDARY', color: '#f59e0b' };
  if (weight >= 20) return { label: 'EPIC',      color: '#c026d3' };
  if (weight >= 10) return { label: 'RARE',      color: '#3b82f6' };
  if (weight > 0)   return { label: 'COMMON',    color: '#6b7280' };
  return                   { label: 'INFO',      color: '#6b7280' };
}

interface Props {
  event: CourseEvent;
  large?: boolean;
}

export function EventCard({ event, large = false }: Props) {
  const colors = TYPE_COLORS[event.type];
  const rarity = getRarity(event.weight);
  const graded = event.grade != null;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${colors.bar}`,
      borderRadius: 10,
      padding: large ? '12px 14px' : '9px 11px',
      minHeight: large ? 130 : undefined,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      transition: 'border-color 0.15s, transform 0.15s',
      cursor: 'default',
    }}
    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
    onMouseLeave={e => (e.currentTarget.style.transform = '')}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: large ? 15 : 13,
            lineHeight: 1.2,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{event.title}</p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {event.courseCode} · {event.date}
          </p>
        </div>
        {event.weight > 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            color: colors.bar,
            background: colors.badge,
            padding: '2px 6px',
            borderRadius: 5,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>{event.weight}%</span>
        )}
      </div>

      {/* Tag row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: colors.label,
          background: colors.badge,
          padding: '2px 7px',
          borderRadius: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>{event.type}</span>

        <span style={{
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: rarity.color,
          background: `${rarity.color}18`,
          padding: '2px 7px',
          borderRadius: 4,
          letterSpacing: '0.05em',
        }}>{rarity.label}</span>

        {graded ? (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: event.grade! >= 80 ? '#10b981' : event.grade! >= 65 ? '#f59e0b' : '#ef4444',
            background: event.grade! >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            padding: '2px 7px',
            borderRadius: 4,
          }}>{event.grade}%</span>
        ) : (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            ~{event.confidence}% conf
          </span>
        )}
      </div>

      {/* Source */}
      <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
        src: {event.source}
        {event.submittedOnTime && (
          <span style={{ color: '#10b981', marginLeft: 6 }}>✓ on-time</span>
        )}
      </p>
    </div>
  );
}
