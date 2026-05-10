import { useEffect, useState } from 'react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

// ─── CSS (same tokens & grain as App.tsx) ────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

  :root {
    --font-display: 'DM Serif Display', Georgia, serif;
    --font-body: 'DM Sans', system-ui, sans-serif;
    --bg:            #efede9;
    --bg-card:       #fafaf8;
    --bg-surface:    #e4e2dc;
    --text:          #111110;
    --text-muted:    #6b6966;
    --text-faint:    #9e9c97;
    --border:        rgba(0,0,0,0.18);
    --border-strong: rgba(0,0,0,0.45);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08);
  }

  [data-theme="dark"] {
    --bg:            #111110;
    --bg-card:       #1c1c1b;
    --bg-surface:    #252523;
    --text:          #f0ede8;
    --text-muted:    #8a8880;
    --text-faint:    #555450;
    --border:        rgba(255,255,255,0.14);
    --border-strong: rgba(255,255,255,0.38);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.6);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: hidden; max-width: 100vw; height: 100%; }

  @keyframes fl-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes fl-popin  { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: none; } }

  .fl-login-shell {
    min-height: 100vh; width: 100%; max-width: 100vw; overflow-x: hidden;
    display: flex; flex-direction: column;
    background: var(--bg); color: var(--text); font-family: var(--font-body);
    transition: background 0.28s, color 0.28s;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.045'/%3E%3C/svg%3E");
    background-size: 220px;
  }

  .fl-header {
    position: sticky; top: 0; z-index: 100;
    background: var(--bg-card); border-bottom: 1px solid var(--border);
    padding: 0 20px; box-shadow: 0 1px 0 var(--border), var(--shadow-sm);
  }
  .fl-header-inner {
    max-width: 1100px; margin: 0 auto;
    height: 54px; display: flex; align-items: center; overflow: hidden;
  }
  .fl-wordmark {
    font-family: var(--font-display); font-size: 20px; color: var(--text);
    flex: 1; letter-spacing: 0.01em; font-style: italic; white-space: nowrap;
  }
  .fl-theme-toggle {
    background: none; border: 1px solid var(--border); cursor: pointer; color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 7px; flex-shrink: 0;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.25s;
  }
  .fl-theme-toggle:hover {
    background: var(--bg-surface); color: var(--text);
    border-color: var(--border-strong); transform: rotate(18deg);
  }
  .fl-theme-toggle svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.8; }

  .fl-login-main {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 40px 20px 60px;
  }

  .fl-login-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 16px; box-shadow: var(--shadow-lg);
    width: 100%; max-width: 420px; overflow: hidden;
    animation: fl-popin 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .fl-login-band {
    padding: 32px 36px 28px; border-bottom: 1px solid var(--border);
    position: relative; overflow: hidden;
  }
  .fl-login-band::before {
    content: ''; position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 23px, var(--border) 23px, var(--border) 24px
    );
    opacity: 0.4; pointer-events: none;
  }
  .fl-login-band-content { position: relative; z-index: 1; }
  .fl-login-eyebrow {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--text-faint); margin-bottom: 8px;
  }
  .fl-login-title {
    font-family: var(--font-display); font-size: 34px; font-style: italic;
    line-height: 1.08; color: var(--text);
  }
  .fl-login-subtitle {
    font-size: 13px; color: var(--text-muted); margin-top: 10px;
    line-height: 1.55; letter-spacing: 0.01em;
  }

  .fl-login-stats { display: flex; gap: 0; border-top: 1px solid var(--border); }
  .fl-login-stat {
    flex: 1; padding: 12px 16px;
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 2px;
  }
  .fl-login-stat:last-child { border-right: none; }
  .fl-login-stat-val {
    font-family: var(--font-display); font-size: 20px; color: var(--text);
    font-style: italic; line-height: 1;
  }
  .fl-login-stat-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint);
  }

  .fl-login-body {
    padding: 28px 36px 32px;
    display: flex; flex-direction: column; gap: 16px;
    animation: fl-fadein 0.35s ease 0.1s both;
  }
  .fl-login-section-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-faint); margin-bottom: -4px;
  }
  .fl-google-wrap { display: flex; flex-direction: column; gap: 10px; }

  .fl-login-divider {
    display: flex; align-items: center; gap: 12px;
    color: var(--text-faint); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }
  .fl-login-divider::before, .fl-login-divider::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  .fl-login-notice {
    font-size: 11px; color: var(--text-faint); text-align: center;
    line-height: 1.6; letter-spacing: 0.01em;
  }
  .fl-login-notice a { color: var(--text-muted); text-decoration: underline; text-underline-offset: 2px; }
  .fl-login-notice a:hover { color: var(--text); }

  .fl-login-footer {
    padding: 14px 36px 18px; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .fl-login-footer-left { font-size: 11px; color: var(--text-faint); letter-spacing: 0.03em; }
  .fl-login-footer-links { display: flex; gap: 14px; }
  .fl-login-footer-link {
    font-size: 11px; color: var(--text-faint); text-decoration: none;
    letter-spacing: 0.03em; transition: color 0.15s;
  }
  .fl-login-footer-link:hover { color: var(--text-muted); }
`;

function MoonIcon() {
  return <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

export function LoginPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const id = 'flowestra-login-css';
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
    el.textContent = CSS;
  }, []);

  return (
    <div data-theme={theme} className="fl-login-shell">

      <header className="fl-header">
        <div className="fl-header-inner">
          <span className="fl-wordmark">Flowestra</span>
          <button
            className="fl-theme-toggle"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className="fl-login-main">
        <div className="fl-login-card">

          <div className="fl-login-band">
            <div className="fl-login-band-content">
              <div className="fl-login-eyebrow">Academic planner</div>
              <h1 className="fl-login-title">Your semester,<br />organised.</h1>
              <p className="fl-login-subtitle">
                Track assignments, deadlines, and grades across every course — synced directly from Brightspace.
              </p>
            </div>
          </div>

          <div className="fl-login-stats">
            <div className="fl-login-stat">
              <span className="fl-login-stat-val">16</span>
              <span className="fl-login-stat-label">Weeks tracked</span>
            </div>
            <div className="fl-login-stat">
              <span className="fl-login-stat-val">∞</span>
              <span className="fl-login-stat-label">Courses</span>
            </div>
            <div className="fl-login-stat">
              <span className="fl-login-stat-val">3</span>
              <span className="fl-login-stat-label">Semesters</span>
            </div>
          </div>

          <div className="fl-login-body">
            <div className="fl-google-wrap">
              <div className="fl-login-section-label">Sign in with Google</div>
              <GoogleSignInButton />
            </div>

            <div className="fl-login-divider">secure · one click</div>

            <p className="fl-login-notice">
              By signing in you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </p>
          </div>

          <div className="fl-login-footer">
            <span className="fl-login-footer-left">© 2026 Flowestra</span>
            <nav className="fl-login-footer-links">
              <a href="#" className="fl-login-footer-link">Help</a>
              <a href="#" className="fl-login-footer-link">Privacy</a>
              <a href="#" className="fl-login-footer-link">Terms</a>
            </nav>
          </div>

        </div>
      </main>

    </div>
  );
}
