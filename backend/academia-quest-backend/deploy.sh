#!/usr/bin/env bash
# deploy.sh — one command to push to Cloud Run
# Run once: gcloud auth login && gcloud config set project YOUR_PROJECT_ID

set -e

PROJECT_ID=$(gcloud config get-value project)
SERVICE="academia-quest-backend"
REGION="us-central1"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE"

echo "▶ Building image..."
gcloud builds submit --tag "$IMAGE"

echo "▶ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=${DATABASE_URL:-}" \
  --memory 512Mi \
  --port 8000

echo ""
echo "✅ Deployed! Your API URL:"
gcloud run services describe "$SERVICE" \
  --platform managed \
  --region "$REGION" \
  --format "value(status.url)"
