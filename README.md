![InsightIQ](frontend/insightiq-image.png)

# InsightIQ: Economy Insight Assistant

InsightIQ: Economy Insight Assistant is a React and Node app for generating dashboard-ready economic insights from FRED data. It uses a local RAG-style retrieval pipeline to find real FRED series IDs before asking Gemini to explain the retrieved data.

The app flow is:

1. User enters an economic question.
2. Backend searches the local pgvector FRED catalog for relevant series IDs.
3. Backend fetches annual FRED observations and series units.
4. Backend asks Gemini for an overall summary and an explanation for each series.
5. Frontend renders the overall summary, charts, and the latest 10 completed queries in browser history.

## Architecture

```mermaid
flowchart TD
  user[User] --> frontend[React Frontend]
  frontend -->|Natural-language query| backend[Express Backend]

  backend -->|Embed query| embedder[Xenova Transformers]
  embedder --> queryVector[Query Vector]
  queryVector --> vectorSearch[pgvector Semantic Search]
  vectorSearch --> postgres[(PostgreSQL FRED Catalog)]
  postgres -->|Real FRED series IDs| backend

  backend -->|Series IDs| fredApi[FRED API]
  fredApi -->|Annual observations and metadata| backend

  backend -->|Retrieved data only| gemini[Gemini API]
  gemini -->|Overall summary and chart explanations| backend

  backend -->|Summary, charts, insights| frontend
  frontend --> history[(Browser localStorage)]

  fredApi -.offline sync.-> pipeline[Pipeline Jobs]
  pipeline -->|Metadata, tags, embeddings, index| postgres
```

## Project Structure

- `frontend/`: Vite React client with React Router and Recharts.
- `backend/`: Express API server for vector search, Gemini explanations, and FRED calls.
- `pipeline/`: Offline FRED catalog ingestion, tagging, embedding, and pgvector indexing jobs.
  It also includes a retrieval evaluation script for measuring Recall@5,
  valid series rate, and average response time.

## Prerequisites

- Node.js 20 or newer
- Docker Desktop for the local Postgres/pgvector database
- A Gemini API key
- A FRED API key

## Backend Setup

The backend depends on the local pgvector database created by the pipeline. Run
the pipeline setup at least once before using the dashboard, otherwise vector
search will not have embedded FRED series to retrieve.

```bash
cd backend
npm.cmd install
```

Create `backend/.env` from `backend/.env.template`:

```bash
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key_here
FRED_API_KEY=your_fred_api_key_here
DATABASE_URL=postgres://insightiq:insightiq@localhost:15432/insightiq_vector
EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
```

Start the local vector database and make sure the pipeline has synced and
embedded FRED series:

```bash
cd ../pipeline
npm.cmd install
docker compose up -d
npm.cmd run db:setup
npm.cmd run db:sync:fred
npm.cmd run db:sync:fred-tags -- --limit 5000 --concurrency 12
npm.cmd run db:prepare:tagged-embeddings -- --missing-only
npm.cmd run db:embed:fred -- --tagged-only --limit 5000 --batch-size 50
npm.cmd run db:index:fred
```

For an existing database that is already synced and embedded, only
`docker compose up -d` is needed before starting the backend.

The first embedding or vector-search run downloads the configured local
embedding model, so the machine needs internet access for initial setup.

## One-Command Docker App Stack

After `backend/.env` exists and the vector database has been populated by the
pipeline at least once, start Postgres, the backend, and the frontend together
from the repository root:

```bash
docker compose up --build
```

Then open:

```txt
http://localhost:5173
```

The root Compose stack uses the same Postgres volume name as the pipeline
database, but it does not run the long FRED sync, tag sync, embedding, or
indexing jobs. Run those pipeline commands manually when setting up data for the
first time or when refreshing the retrieval index.

Only one Compose stack should bind Postgres to port `15432` at a time. If the
pipeline-only database is already running, stop it before starting the root app
stack:

```bash
cd pipeline
docker compose down
cd ..
docker compose up --build
```

Start the backend:

```bash
cd ../backend
npm.cmd run dev
```

The backend runs at:

```txt
http://localhost:3001
```

## Frontend Setup

In a second terminal:

```bash
cd frontend
npm.cmd install
```

Create `frontend/.env` from `frontend/.env.template`:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

Start the frontend:

```bash
npm.cmd run dev
```

Open the local Vite URL shown in the terminal, usually:

```txt
http://localhost:5173
```

## Available Pages

- `/`: Generate a new economic insight dashboard.
- `/history`: View the latest 10 saved queries.
- `/history/:id`: View a saved query result without calling Gemini or FRED again.

History is stored in browser `localStorage`, so it is local to the user and browser.

## Backend Endpoints

### `GET /health`

Health check endpoint.

### `POST /api/series-ids`

Uses local embeddings and pgvector search over the indexed `fred_series` table.
Gemini is not used for series ID selection.

Request:

```json
{
  "query": "What is happening with inflation?"
}
```

Response:

```json
{
  "series": [
    {
      "seriesId": "CPIAUCSL",
      "title": "Consumer Price Index for All Urban Consumers"
    }
  ]
}
```

### `POST /api/insights`

Request:

```json
{
  "query": "What is happening with inflation?",
  "series": [
    {
      "seriesId": "CPIAUCSL",
      "title": "Consumer Price Index for All Urban Consumers"
    }
  ]
}
```

Response:

```json
{
  "query": "What is happening with inflation?",
  "summary": "Plain-English overview across the selected FRED series.",
  "series": [
    {
      "seriesId": "CPIAUCSL",
      "title": "Consumer Price Index for All Urban Consumers",
      "units": "Index 1982-1984=100",
      "observations": [
        {
          "date": "2024-01-01",
          "year": "2024",
          "value": 313.689
        }
      ],
      "insight": {
        "summary": "Plain-English explanation for this series.",
        "keyTakeaways": ["Short takeaway"]
      }
    }
  ]
}
```

The backend skips FRED series IDs that do not exist. If none of the requested series can be fetched, `/api/insights` returns an error. Gemini is only used after series retrieval, so it does not invent FRED series IDs.

## Validation

GitHub Actions runs CI on pushes to `main` and on pull requests. The workflow
installs dependencies, checks backend and pipeline syntax, runs backend and
frontend tests, lints the frontend, and builds the frontend without calling
Gemini, FRED, or the local vector database.

Frontend:

```bash
cd frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Backend:

```bash
cd ..
node --check backend/src/server.js
node --check backend/src/services/vectorFred.js
node --check backend/src/services/geminiInsights.js
cd backend
npm.cmd test
```

Retrieval evaluation:

```bash
cd ../pipeline
npm.cmd run eval:retrieval
```
