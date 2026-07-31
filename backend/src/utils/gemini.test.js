import { describe, expect, it } from 'vitest'
import { parseGeminiJson } from './gemini.js'

describe('parseGeminiJson', () => {
  it('parses plain JSON', () => {
    expect(parseGeminiJson('{"summary":"ok"}')).toEqual({ summary: 'ok' })
  })

  it('parses JSON wrapped in a markdown code block', () => {
    expect(parseGeminiJson('```json\n{"summary":"ok"}\n```')).toEqual({
      summary: 'ok',
    })
  })

  it('throws when Gemini text is not valid JSON', () => {
    expect(() => parseGeminiJson('not json')).toThrow()
  })
})
