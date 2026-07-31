const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

async function parseApiResponse(response, fallbackMessage) {
  let data

  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (!response.ok) {
    throw new Error(data.error ?? fallbackMessage)
  }

  return data
}

async function fetchJson(url, options, fallbackMessage) {
  let response

  try {
    response = await fetch(url, options)
  } catch {
    throw new Error('Unable to reach the backend. Make sure the backend server is running.')
  }

  return parseApiResponse(response, fallbackMessage)
}

export async function getFredSeriesForQuery(query) {
  const data = await fetchJson(
    `${apiBaseUrl}/api/series-ids`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
    'Unable to fetch series IDs.',
  )

  if (!Array.isArray(data.series)) {
    throw new Error('Backend returned an unexpected series response format.')
  }

  return data.series
    .filter((item) => item?.seriesId)
    .map((item) => ({
      seriesId: String(item.seriesId),
      title: item.title ? String(item.title) : String(item.seriesId),
    }))
}

export async function getInsightsForSeries(query, series) {
  const data = await fetchJson(
    `${apiBaseUrl}/api/insights`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, series }),
    },
    'Unable to generate insights.',
  )

  if (
    typeof data.summary !== 'string' ||
    !Array.isArray(data.series) ||
    data.series.some(
      (item) =>
        !Array.isArray(item.observations) ||
        typeof item.insight?.summary !== 'string',
    )
  ) {
    throw new Error('Backend returned an unexpected response format.')
  }

  return data
}
