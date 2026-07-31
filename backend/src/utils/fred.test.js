import { describe, expect, it } from 'vitest'
import { normalizeObservation, normalizeSeriesMetadata } from './fred.js'

describe('normalizeObservation', () => {
  it('normalizes numeric FRED observations', () => {
    expect(normalizeObservation({ date: '2024-01-01', value: '313.689' })).toEqual({
      date: '2024-01-01',
      year: '2024',
      value: 313.689,
    })
  })

  it('skips missing or non-numeric observation values', () => {
    expect(normalizeObservation({ date: '2024-01-01', value: '.' })).toBeNull()
    expect(normalizeObservation({ date: '2024-01-01', value: 'not-a-number' })).toBeNull()
  })
})

describe('normalizeSeriesMetadata', () => {
  it('normalizes optional title and units fields', () => {
    expect(normalizeSeriesMetadata({ title: 'GDP', units: 'Billions of Dollars' })).toEqual({
      title: 'GDP',
      units: 'Billions of Dollars',
    })

    expect(normalizeSeriesMetadata({})).toEqual({
      title: undefined,
      units: '',
    })
  })
})
