# Flowestra

Flowestra is a gamified academic planner that automatically turns course deadlines into quests. It helps students stay organized by syncing work from Brightspace, prioritizing upcoming assignments, and rewarding progress with XP, levels, streaks, and in-game progression.

Built during the **Google Developer Groups 24-hour Hackathon 2026**, where our team placed **4th out of 49 teams**.

[Watch the video demo](https://youtu.be/MNFMywtRoWg)

## What it does

- Syncs assignments, grades, and calendar events from Brightspace
- Converts coursework into prioritized quests
- Rewards completed work with XP and level progression
- Tracks streaks, grades, upcoming deadlines, and completion status
- Includes a game-inspired dashboard and interactive battle experience
- Uses a Chrome extension to capture academic data automatically

## How it works

Flowestra is split into three main parts:

1. **React dashboard** — displays quests, progress, grades, and the interactive game experience.
2. **Chrome extension** — reads supported Brightspace pages and API responses, then syncs assignments and grades.
3. **FastAPI backend** — stores academic state, calculates progress, and exposes the application API.

## Technology stack

- React
- TypeScript
- Vite
- CSS
- JavaScript
- Python
- FastAPI
- SQLAlchemy
- Chrome Extension Manifest V3

## Repository structure

```text
gdghacks3/
├── vite-project/                         React and TypeScript dashboard
├── backend/academia-quest-backend/       FastAPI backend
├── extension/academia-quest-extension/   Brightspace Chrome extension
└── README.md
```

The `Academia Quest` directory names are retained from the original hackathon prototype.

## Run locally

### 1. Start the backend

```bash
cd backend/academia-quest-backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`, with interactive documentation at `http://localhost:8000/docs`.

### 2. Start the dashboard

In a second terminal:

```bash
cd vite-project
npm install
npm run dev
```

Open the local URL shown by Vite.

### 3. Load the Chrome extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `extension/academia-quest-extension`.
5. Open Brightspace to sync supported course data.

## Hackathon result

Flowestra earned **4th place out of 49 teams** at the Google Developer Groups 24-hour Hackathon 2026.
