import { getRequiredEnv } from '../utils/env.js'
import { createServiceUnavailableError } from '../utils/errors.js'
import {
  normalizeObservation,
  normalizeSeriesMetadata,
} from '../utils/fred.js'

const fredApiBaseUrl = 'https://api.stlouisfed.org/fred'
const recentObservationLimit = 24
const defaultFrequency = 'a'

async function fetchFredJson(url, fallbackMessage) {
  let response

  try {
    response = await fetch(url)
  } catch (error) {
    throw createServiceUnavailableError('Unable to reach the FRED API.', {
      code: 'FRED_API_UNAVAILABLE',
      details: error.message,
    })
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw createServiceUnavailableError(fallbackMessage, {
      code: 'FRED_API_INVALID_RESPONSE',
    })
  }

  if (!response.ok) {
    throw new Error(data.error_message ?? fallbackMessage)
  }

  return data
}

export async function getFredSeriesMetadata(seriesId) {
  const url = new URL(`${fredApiBaseUrl}/series`)
  url.searchParams.set('api_key', getRequiredEnv('FRED_API_KEY'))
  url.searchParams.set('file_type', 'json')
  url.searchParams.set('series_id', seriesId)

  const data = await fetchFredJson(
    url,
    `Unable to fetch FRED metadata for ${seriesId}.`,
  )

  if (!Array.isArray(data.seriess) || !data.seriess[0]) {
    throw new Error(`FRED returned missing metadata for ${seriesId}.`)
  }

  return normalizeSeriesMetadata(data.seriess[0])
}

export async function getFredObservations(seriesId, options = {}) {
  const url = new URL(`${fredApiBaseUrl}/series/observations`)
  url.searchParams.set('api_key', getRequiredEnv('FRED_API_KEY'))
  url.searchParams.set('file_type', 'json')
  url.searchParams.set('series_id', seriesId)
  url.searchParams.set('frequency', options.frequency ?? defaultFrequency)
  url.searchParams.set('sort_order', 'desc')
  url.searchParams.set(
    'limit',
    String(options.limit ?? recentObservationLimit),
  )

  const data = await fetchFredJson(
    url,
    `Unable to fetch FRED series ${seriesId}.`,
  )

  if (!Array.isArray(data.observations)) {
    throw new Error(`FRED returned an unexpected response for ${seriesId}.`)
  }

  return data.observations
    .map(normalizeObservation)
    .filter(Boolean)
    .reverse()
}

export async function getFredSeriesWithObservations(series) {
  const results = await Promise.allSettled(
    series.map(async (item) => {
      const [metadata, observations] = await Promise.all([
        getFredSeriesMetadata(item.seriesId),
        getFredObservations(item.seriesId),
      ])

      return {
        ...item,
        title: metadata.title ?? item.title,
        units: metadata.units,
        observations,
      }
    }),
  )

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item) => item.observations.length > 0)
}
