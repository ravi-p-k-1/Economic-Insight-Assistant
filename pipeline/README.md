# InsightIQ Data Pipeline

This folder contains offline ingestion and indexing jobs for the local FRED
retrieval database. These scripts are separate from the backend API because
catalog generation, tag sync, embedding, and indexing can be long-running.

## Structure

- `scripts/`: Thin command-line entry points.
- `src/clients/`: External API clients, retries, and request throttling.
- `src/services/`: Catalog retrieval and transformation workflows.
- `src/config/`: FRED scopes and pipeline constants.
- `src/utils/`: Environment and rate limiting helpers.

## Setup

Install pipeline dependencies:

```bash
cd pipeline
npm.cmd install
```

Create `pipeline/.env` from `pipeline/.env.template`:

```bash
FRED_API_KEY=your_fred_api_key_here
FRED_REQUESTS_PER_MINUTE=120
DATABASE_URL=postgres://insightiq:insightiq@localhost:15432/insightiq_vector
EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
```

`FRED_REQUESTS_PER_MINUTE` controls the maximum request start rate. Requests
are evenly spaced to avoid bursts, and retries use the same scheduler. The
default of 120 matches FRED's documented request limit.

The backend uses the same `DATABASE_URL` and `EMBEDDING_MODEL` values when it
performs vector search for `/api/series-ids`, so keep backend and pipeline
configuration aligned.

## Local Vector Database

The pipeline uses Docker Compose to run a local PostgreSQL database with the
pgvector extension available:

```bash
cd pipeline
docker compose up -d
```

Connection string:

```bash
postgres://insightiq:insightiq@localhost:15432/insightiq_vector
```

Stop the database without deleting stored data:

```bash
docker compose down
```

Delete the database volume and start fresh:

```bash
docker compose down -v
```

## FRED National and State Catalog

The FRED catalog script retrieves all series matching these tag combinations:

- `usa;nation`
- `usa;state`

It verifies that FRED currently exposes the `nation` and `state` geography-type
tags, follows FRED's 1,000-record pagination limit, retries transient failures,
and upserts complete series metadata directly into Postgres.

## Sync FRED Series Directly to Postgres

Once Postgres is available, the preferred path is to fetch FRED pages and upsert
them directly into the `fred_series` table:

```bash
cd pipeline
docker compose up -d
npm.cmd run db:sync:fred
```

For a quick API-to-database test, pass a per-scope limit:

```bash
npm.cmd run db:sync:fred -- --limit 1000
```

The sync stores series metadata and an `embedding_text` field that will be used
by the next embedding job. The `embedding` column remains empty until the
embedding script is run.

## Sync FRED Series Tags

Fetch official FRED tags for series rows and store them in `fred_series.tags`,
`fred_series.tag_names`, and `fred_series.tag_group_ids`:

```bash
cd pipeline
npm.cmd run db:sync:fred-tags -- --limit 100
```

The command is resumable. It fetches rows where `tags_updated_at` is empty,
ordered by popularity, and respects `FRED_REQUESTS_PER_MINUTE`.

Use `--concurrency` to overlap slow network responses while still sending every
FRED request through the shared rate limiter:

```bash
npm.cmd run db:sync:fred-tags -- --limit 5000 --concurrency 8
```

To rebuild embeddings for the full tagged subset, prepare the table and then
run tagged-only embedding:

```bash
npm.cmd run db:prepare:tagged-embeddings
npm.cmd run db:embed:fred -- --tagged-only --limit 5000
```

The preparation command clears embeddings for untagged rows and rebuilds
`embedding_text` for tagged rows using series ID, title, tags, units, frequency,
seasonal adjustment, and scope.

To embed only newly tagged rows without clearing existing tagged embeddings, use
the missing-only preparation path:

```bash
npm.cmd run db:prepare:tagged-embeddings -- --missing-only
npm.cmd run db:embed:fred -- --tagged-only --limit 5000 --batch-size 50
```

## Embed FRED Series

Generate local embeddings from `fred_series.embedding_text` using Transformers.js
and the configured Xenova model:

```bash
cd pipeline
npm.cmd run db:embed:fred -- --limit 100
```

The default model is `Xenova/bge-small-en-v1.5`, which produces 384-dimensional
vectors matching the `fred_series.embedding vector(384)` column.

## Index FRED Embeddings

After embeddings are generated, create the pgvector HNSW index:

```bash
cd pipeline
npm.cmd run db:index:fred
```

This speeds up vector search over the `fred_series.embedding` column.

## Search FRED Series

Search embedded FRED series with the same local embedding model and pgvector
cosine distance:

```bash
cd pipeline
npm.cmd run db:search:fred -- "inflation and unemployment since 2020"
```

Pass a custom result count with `--limit`:

```bash
npm.cmd run db:search:fred -- --limit 20 "housing prices in California"
```

The backend uses the same retrieval path for `/api/series-ids`, then sends the
retrieved series and observations to Gemini for the overall dashboard summary
and individual chart explanations.

## Evaluate Retrieval

Run the local retrieval benchmark without calling Gemini or FRED:

```bash
cd pipeline
docker compose up -d
npm.cmd run eval:retrieval
```

The default question set lives in `pipeline/evaluation/questions.json` and
contains natural-language economic questions with expected relevant FRED series.
The evaluation reports:

- `Recall@5`
- valid FRED-series rate
- average response time

Pass a different top-k value or question file when needed:

```bash
npm.cmd run eval:retrieval -- --limit 10 --questions evaluation/questions.json
```
