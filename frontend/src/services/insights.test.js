import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFredSeriesForQuery, getInsightsForSeries } from './insights.js'

function mockJsonResponse(body, options = {}) {
  return {
    ok: options.ok ?? true,
    json: vi.fn().mockResolvedValue(body),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getFredSeriesForQuery', () => {
  it('normalizes retrieved series from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          series: [
            { seriesId: 'CPIAUCSL', title: 'Consumer Price Index' },
            { seriesId: 'UNRATE' },
            {},
          ],
        }),
      ),
    )

    await expect(getFredSeriesForQuery('inflation')).resolves.toEqual([
      { seriesId: 'CPIAUCSL', title: 'Consumer Price Index' },
      { seriesId: 'UNRATE', title: 'UNRATE' },
    ])
  })

  it('uses the backend error message when retrieval fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(
          { error: 'No matching FRED indicators were found.' },
          { ok: false },
        ),
      ),
    )

    await expect(getFredSeriesForQuery('stocks')).rejects.toThrow(
      'No matching FRED indicators were found.',
    )
  })

  it('reports when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(getFredSeriesForQuery('inflation')).rejects.toThrow(
      'Unable to reach the backend.',
    )
  })
})

describe('getInsightsForSeries', () => {
  it('returns valid insight payloads', async () => {
    const payload = {
      query: 'inflation',
      summary: 'Inflation has changed over the selected period.',
      series: [
        {
          seriesId: 'CPIAUCSL',
          title: 'Consumer Price Index',
          observations: [{ date: '2024-01-01', year: '2024', value: 313.689 }],
          insight: {
            summary: 'Prices rose.',
            keyTakeaways: ['Latest value increased'],
          },
        },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse(payload)))

    await expect(
      getInsightsForSeries('inflation', [{ seriesId: 'CPIAUCSL' }]),
    ).resolves.toEqual(payload)
  })

  it('rejects unexpected backend response shapes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          query: 'inflation',
          summary: 'Missing series.',
        }),
      ),
    )

    await expect(getInsightsForSeries('inflation', [])).rejects.toThrow(
      'Backend returned an unexpected response format.',
    )
  })
})
