import { embedText } from '../clients/embedding.js'
import { withDatabaseClient } from '../clients/database.js'
import { createServiceUnavailableError } from '../utils/errors.js'

const defaultSeriesLimit = 4
const defaultCandidateLimit = 20

function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`
}

function normalizeVectorResult(row) {
  return {
    seriesId: row.series_id,
    title: row.title,
    similarity: 1 - Number(row.distance),
    popularity: row.popularity,
  }
}

function calculateRerankScore(result) {
  const popularity = Number(result.popularity) || 0
  return result.similarity + Math.log1p(popularity) * 0.01
}

function selectDiverseSeries(results, limit) {
  const selected = []
  const normalizedTitlePrefixes = new Set()

  for (const result of results) {
    const titlePrefix = result.title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .slice(0, 5)
      .join(' ')

    if (normalizedTitlePrefixes.has(titlePrefix) && selected.length > 0) {
      continue
    }

    selected.push(result)
    normalizedTitlePrefixes.add(titlePrefix)

    if (selected.length === limit) {
      break
    }
  }

  return selected
}

export async function getFredSeriesForQuery(query, options = {}) {
  const limit = options.limit ?? defaultSeriesLimit
  const candidateLimit = Math.max(options.candidateLimit ?? defaultCandidateLimit, limit)
  let embedding

  try {
    embedding = await embedText(query)
  } catch (error) {
    throw createServiceUnavailableError(
      'Unable to load the local embedding model. Try again after setup completes.',
      {
        code: 'EMBEDDING_MODEL_UNAVAILABLE',
        details: error.message,
      },
    )
  }

  const vector = toVectorLiteral(embedding)

  try {
    return await withDatabaseClient(async (client) => {
      const { rows } = await client.query(
        `
          SELECT
            series_id,
            title,
            popularity,
            embedding <=> $1::vector AS distance
          FROM fred_series
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector
          LIMIT $2
        `,
        [vector, candidateLimit],
      )

      const rankedResults = rows
        .map(normalizeVectorResult)
        .sort((left, right) => calculateRerankScore(right) - calculateRerankScore(left))

      return selectDiverseSeries(rankedResults, limit)
    })
  } catch (error) {
    throw createServiceUnavailableError(
      'The local FRED vector database is unavailable. Start Docker and the pipeline database, then try again.',
      {
        code: 'VECTOR_DATABASE_UNAVAILABLE',
        details: error.message,
      },
    )
  }
}
