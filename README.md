# Agent Responses Dashboard

Dashboard Vue con API Node para centralizar metricas de respuestas guardadas por usuarios cuando interactuan con agentes.

## Fuente de datos

El dashboard lee Postgres via `DATABASE_URL` desde el backend del mismo servicio. No expone credenciales en el frontend.

Consultas incluidas:

- `business.onboarding_voice_sessions`: respuestas JSONB por usuario, progreso, estado y bloques.
- `business.ia_conversations`: conversaciones JSONB historicas si existen.
- `business.ai_recommendation_events`: feedback de recomendaciones generado por agentes ElevenLabs.

## Desarrollo local

```bash
cp .env.example .env
npm install
npm run dev
```

Web local: `http://localhost:5174`

API local: `http://localhost:8080/api/health`

## Cloud Run

Variables necesarias:

```bash
DATABASE_URL='postgresql://user:password@host:5432/database'
PGSSL=true
```

Deploy manual:

```bash
gcloud run deploy agent-responses-dashboard \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars PGSSL=true \
  --set-secrets DATABASE_URL=DATABASE_URL:latest
```
