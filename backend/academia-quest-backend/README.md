# Academia Quest — Backend

FastAPI backend. Matches exactly what `background.js` sends.

## Run locally (30 seconds)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API is live at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`

The extension already points to `localhost:8000` — no changes needed for local dev.

---

## Deploy to GCP Cloud Run (free tier, ~2 min)

### 1. Prerequisites
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### 2. Deploy (SQLite — fine for hackathon)
```bash
chmod +x deploy.sh
./deploy.sh
```

### 3. Update the extension
In `background.js`, change:
```js
API_BASE: "http://localhost:8000",
```
to your Cloud Run URL:
```js
API_BASE: "https://academia-quest-backend-xxxx-uc.a.run.app",
```

Also add the Cloud Run domain to `manifest.json` host_permissions:
```json
"host_permissions": [
  "*://*.brightspace.com/*",
  "https://academia-quest-backend-xxxx-uc.a.run.app/*"
]
```

---

## Optional: Cloud SQL (if you want data to persist between redeploys)

```bash
# Create a postgres instance
gcloud sql instances create academia-quest \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create DB + user
gcloud sql databases create academia_quest --instance=academia-quest
gcloud sql users set-password postgres --instance=academia-quest --password=yourpassword

# Get connection string
# postgresql://postgres:yourpassword@/academia_quest?host=/cloudsql/PROJECT:us-central1:academia-quest

# Deploy with DATABASE_URL set
DATABASE_URL="postgresql://..." ./deploy.sh
```

Uncomment `psycopg2-binary` in `requirements.txt` first.

---

## Endpoints (matches background.js exactly)

| Method | Path | Called by |
|--------|------|-----------|
| POST | `/api/assignments/sync` | Every scrape |
| POST | `/api/grades/sync` | Every grade scrape |
| POST | `/api/assignments/complete` | User marks done |
| POST | `/api/sync` | 30-min alarm |
| GET | `/api/assignments` | Frontend dashboard |
| GET | `/api/grades` | Frontend dashboard |
| GET | `/api/state/{user_id}` | Frontend dashboard |
