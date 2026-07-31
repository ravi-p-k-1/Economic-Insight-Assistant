import { describe, expect, it } from 'vitest'
import { isValidFredSeriesId, normalizeSelectedSeries } from './series.js'

describe('isValidFredSeriesId', () => {
  it('accepts alphanumeric FRED series IDs up to 25 characters', () => {
    expect(isValidFredSeriesId('CPIAUCSL')).toBe(true)
    expect(isValidFredSeriesId('A'.repeat(25))).toBe(true)
  })

  it('rejects empty, punctuated, or overly long series IDs', () => {
    expect(isValidFredSeriesId('')).toBe(false)
    expect(isValidFredSeriesId('CPI-AUCSL')).toBe(false)
    expect(isValidFredSeriesId('A'.repeat(26))).toBe(false)
  })
})

describe('normalizeSelectedSeries', () => {
  it('keeps valid series and falls back to the ID as title', () => {
    expect(
      normalizeSelectedSeries([
        { seriesId: 'CPIAUCSL', title: 'Consumer Price Index' },
        { seriesId: 'UNRATE' },
      ]),
    ).toEqual([
      { seriesId: 'CPIAUCSL', title: 'Consumer Price Index' },
      { seriesId: 'UNRATE', title: 'UNRATE' },
    ])
  })

  it('filters invalid or missing series IDs', () => {
    expect(
      normalizeSelectedSeries([
        null,
        {},
        { seriesId: 'BAD-ID' },
        { seriesId: 'GDP' },
      ]),
    ).toEqual([{ seriesId: 'GDP', title: 'GDP' }])
  })
})
