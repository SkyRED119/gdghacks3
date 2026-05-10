# Academia Quest — Chrome Extension

Automatic Brightspace assignment sync for the Academia Quest gamification platform.

---

## Quick Install (Dev Mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `academia-quest-extension/` folder
5. Pin the extension from the puzzle-piece icon

That's it. Open Brightspace and it syncs automatically.

---

## What it does

| Layer | What happens |
|-------|-------------|
| **Network interceptor** | Injects into page context, wraps `fetch` + `XHR` to capture D2L API responses in real-time |
| **DOM scraper** | Parses the rendered HTML of Dropbox / Grades / Home pages as a fallback |
| **Background worker** | Deduplicates, computes priority scores, updates XP/streak, syncs to backend |
| **Popup** | Shows your level, XP bar, streak, GPA estimate, and top upcoming quests |

---

## Brightspace Pages Handled

| Page URL pattern | Data extracted |
|-----------------|---------------|
| `/d2l/lms/dropbox/` | Assignment titles, due dates, submission status |
| `/d2l/lms/grades/` | Grade items, points, percentages |
| `/d2l/home` | Upcoming work widget |
| `/d2l/le/calendar` | Calendar events (via API intercept) |
| Any D2L API call | `calendar`, `dropbox`, `grade` endpoints intercepted |

---

## Priority Formula

```
priority = weight × urgency × difficulty
urgency  = min(10 / daysLeft, 10)
difficulty: exam/final=3.0, report/project=2.5, lab/assignment=1.5
weight: 1.0 (uniform — extend with course weights later)
```

---

## XP Table

| Action | XP |
|--------|----|
| Complete early (>24h before due) | +150 |
| Complete on time | +100 |
| Complete late | +40 |
| Daily streak | +25 × streakDays |
| Assignment synced (new) | +5 |
| Grade A (≥80%) | +200 |
| Grade B (65–79%) | +100 |
| Grade C (<65%) | +50 |

---

## Backend API Contract

The extension POSTs to `http://localhost:8000` (configurable in `background.js`).

### `POST /api/sync`
Full state dump — used by periodic alarm every 30 min.
```json
{
  "userId": "...",
  "assignments": [...],
  "grades": [...],
  "state": { "xp": 420, "level": 3, "streak": 5 }
}
```

### `POST /api/assignments/sync`
```json
{ "assignments": [{ "id", "course", "title", "dueDate", "status", "priority" }] }
```

### `POST /api/assignments/complete`
```json
{ "assignmentId": "assign_12345_assignment_2" }
```

### `POST /api/grades/sync`
```json
{ "grades": [{ "id", "course", "title", "grade", "maxGrade", "percentage" }] }
```

---

## Storage Layout (chrome.storage.local)

| Key | Value |
|-----|-------|
| `assignments` | `{ [id]: Assignment }` |
| `grades` | `{ [id]: Grade }` |
| `state` | `{ xp, level, streak, lastActiveDate, userName }` |
| `xpEvents` | `[{ reason, amount, ts }]` (last 200) |

---

## Developing

Edit files → go to `chrome://extensions` → click the **↺ reload** button on the Academia Quest card.

Check logs:
- **Content script**: DevTools on any brightspace.com tab → Console (filter `[AQ]`)
- **Background worker**: `chrome://extensions` → Academia Quest → **Inspect views: service worker**
- **Popup**: Right-click the extension icon → Inspect popup

---

## Files

```
academia-quest-extension/
├── manifest.json       Manifest V3 config
├── content.js          Runs on Brightspace — scrapes + listens
├── interceptor.js      Injected into page context — wraps fetch/XHR
├── background.js       Service worker — storage, XP, backend sync
├── popup.html          Extension popup
├── popup.css           Dark gamification UI
├── popup.js            Popup data rendering
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## University of Guelph (Courselink)

Default "Open Brightspace" button links to `courselink.uoguelph.ca`.
To change it, edit line in `popup.js`:
```js
chrome.tabs.create({ url: "https://courselink.uoguelph.ca/d2l/home" });
```
