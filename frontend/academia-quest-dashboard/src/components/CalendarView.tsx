import { useMemo } from 'react';
import { CalendarDays, FileText, AlertTriangle } from 'lucide-react';
import type { CourseEvent, ViewMode } from '../types';
import { EventCard } from './EventCard';
import { SEMESTER_MONTHS, weeksForMonth } from '../data';

interface Props {
  events: CourseEvent[];
  view: ViewMode;
  search: string;
}

export function CalendarView({ events, view, search }: Props) {
  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const t = search.toLowerCase();
    return events.filter(e =>
      e.title.toLowerCase().includes(t) ||
      e.courseCode.toLowerCase().includes(t) ||
      e.courseName.toLowerCase().includes(t) ||
      e.type.toLowerCase().includes(t)
    );
  }, [events, search]);

  if (events.length === 0) return <EmptyState />;

  if (view === 'semester') return <SemesterView events={filtered} />;
  if (view === 'month')    return <MonthView events={filtered} />;
  return <WeekView events={filtered} />;
}

// ─── Semester View ────────────────────────────────────────────────────────────
// 4 months in a 2×2 grid, each month split into 4 vertical week columns

function SemesterView({ events }: { events: CourseEvent[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {SEMESTER_MONTHS.map((month, mi) => (
        <MonthBlock key={month} month={month} monthIndex={mi} events={events} />
      ))}
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
// Full-width months stacked, each with 4 week columns

function MonthView({ events }: { events: CourseEvent[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {SEMESTER_MONTHS.map((month, mi) => (
        <MonthBlock key={month} month={month} monthIndex={mi} events={events} expanded />
      ))}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
// Show the current week (or first week with events) in expanded detail

function WeekView({ events }: { events: CourseEvent[] }) {
  // Find the current week (approx) or default to first week with events
  const today = new Date();
  const semesterStart = new Date('2026-01-05');
  const diff = Math.floor((today.getTime() - semesterStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const currentWeek = Math.max(1, Math.min(16, diff + 1));

  const weeks = [currentWeek, currentWeek + 1, currentWeek + 2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background: 'var(--bg-month)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={15} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '0.04em' }}>
            UPCOMING WEEKS
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: 6 }}>
            week {currentWeek}–{currentWeek + 2}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {weeks.map(wk => {
            const wkEvents = events.filter(e => e.week === wk);
            return (
              <WeekColumn
                key={wk}
                weekNumber={wk}
                events={wkEvents}
                highlight={wk === currentWeek}
                large
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Shared blocks ────────────────────────────────────────────────────────────

interface MonthBlockProps {
  month: string;
  monthIndex: number;
  events: CourseEvent[];
  expanded?: boolean;
}

function MonthBlock({ month, monthIndex, events, expanded = false }: MonthBlockProps) {
  const weeks = weeksForMonth(monthIndex);
  const monthEvents = events.filter(e => e.month === month);
  const style: React.CSSProperties = {
    background: 'var(--bg-month)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 14,
    animationDelay: `${monthIndex * 60}ms`,
  };

  return (
    <div className="fade-up" style={style}>
      {/* Month header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: expanded ? 20 : 16, letterSpacing: '0.05em' }}>
            {month.toUpperCase()}
          </h3>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            {monthEvents.length} quest{monthEvents.length !== 1 ? 's' : ''} this month
          </p>
        </div>
        <div style={{
          padding: '3px 10px',
          borderRadius: 6,
          background: 'rgba(124,58,237,0.18)',
          border: '1px solid rgba(124,58,237,0.3)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: '#a78bfa',
          fontWeight: 700,
        }}>
          M{monthIndex + 1}
        </div>
      </div>

      {/* 4 week columns side by side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {weeks.map(wk => (
          <WeekColumn
            key={wk}
            weekNumber={wk}
            events={events.filter(e => e.week === wk)}
            large={expanded}
          />
        ))}
      </div>
    </div>
  );
}

interface WeekColumnProps {
  weekNumber: number;
  events: CourseEvent[];
  highlight?: boolean;
  large?: boolean;
}

function WeekColumn({ weekNumber, events, highlight = false, large = false }: WeekColumnProps) {
  return (
    <div style={{
      background: 'var(--bg-week)',
      border: `1px solid ${highlight ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: large ? 12 : 10,
      minHeight: large ? 300 : 220,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Week label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 10,
          color: highlight ? '#a78bfa' : 'var(--text-sub)',
          letterSpacing: '0.06em',
        }}>W{weekNumber}</span>
        {events.length > 0 && (
          <span style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            background: 'var(--bg-month)',
            padding: '1px 5px',
            borderRadius: 4,
          }}>{events.length}</span>
        )}
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          fontSize: 10,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
          padding: 8,
        }}>
          no quests
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map(ev => (
            <EventCard key={ev.id} event={ev} large={large} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      background: 'var(--bg-month)',
      border: '1px dashed var(--border-strong)',
      borderRadius: 20,
      padding: 48,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(124,58,237,0.12)',
        border: '1px solid rgba(124,58,237,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CalendarDays size={30} color="var(--accent)" />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '0.04em' }}>
        NO COURSE DATA YET
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 480, lineHeight: 1.6 }}>
        The schedule stays empty until the backend parses your course outline PDFs and returns assignments, deadlines, and weights.
      </p>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 18,
        maxWidth: 500,
        width: '100%',
        textAlign: 'left',
        marginTop: 8,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <FileText size={13} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em' }}>
            EXPECTED FROM BACKEND
          </span>
        </div>
        <pre style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-sub)',
          lineHeight: 1.7,
          overflow: 'auto',
        }}>{`GET /api/schedule → CourseEvent[]
{
  id, title, courseCode, type,
  week (1–16), weight, grade?,
  date, isoDate, confidence
}`}</pre>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <AlertTriangle size={12} color="#f59e0b" />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          data/data.ts → MOCK_EVENTS controls demo data
        </span>
      </div>
    </div>
  );
}
