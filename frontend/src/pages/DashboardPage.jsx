import { useState } from 'react'
import PromptSearchBar from '../components/PromptSearchBar'
import OverallSummary from '../components/OverallSummary'
import ResultsGrid from '../components/ResultsGrid'
import { getFredSeriesForQuery, getInsightsForSeries } from '../services/insights'
import { saveHistoryItem } from '../services/history'

function DashboardPage() {
  const [series, setSeries] = useState([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [openGuidanceSections, setOpenGuidanceSections] = useState({})

  function toggleGuidanceSection(sectionId) {
    setOpenGuidanceSections((currentSections) => ({
      ...currentSections,
      [sectionId]: !currentSections[sectionId],
    }))
  }

  async function handlePromptSubmit(query) {
    setIsLoading(true)
    setError('')
    setSeries([])
    setSummary('')

    try {
      const selectedSeries = await getFredSeriesForQuery(query)

      if (selectedSeries.length === 0) {
        throw new Error(
          'No matching FRED indicators were found. Try a more specific economic question.',
        )
      }

      const result = await getInsightsForSeries(query, selectedSeries)
      setSummary(result.summary)
      setSeries(result.series)
      saveHistoryItem(query, result)
    } catch (currentError) {
      setError(currentError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <header className="dashboard__header">
        <h1>InsightIQ: Economy Insight Assistant</h1>
        <p>Enter a query to generate dashboard-ready economic insight modules.</p>
      </header>

      <section className="prompt-guidance" aria-label="Prompt guidance and limitations">
        <article className="prompt-guidance__section">
          <button
            className="prompt-guidance__trigger"
            type="button"
            aria-expanded={Boolean(openGuidanceSections.beforeStart)}
            aria-controls="guidance-before-start"
            onClick={() => toggleGuidanceSection('beforeStart')}
          >
            Key Tips
          </button>
          <div
            className="prompt-guidance__content"
            id="guidance-before-start"
            data-open={Boolean(openGuidanceSections.beforeStart)}
          >
            <div>
              <ul>
                <li>
                  <strong>Focus on economic indicators.</strong> InsightIQ is designed for
                  economic data available through FRED. Questions about stock prices,
                  cryptocurrencies, company financials, earnings reports, news events, or
                  general web research are outside the app's scope.
                </li>
                <li>
                  <strong>Be specific with your question.</strong> Requests such as
                  "Analyze inflation and unemployment since 2020" generally produce
                  better results than broad prompts like "Tell me about the economy."
                </li>
                <li>
                  <strong>Current data window is limited.</strong> InsightIQ currently
                  analyzes the most recent 24 annual observations available for each
                  indicator. Very long historical requests may not be fully reflected in
                  the results.
                </li>
                <li>
                  <strong>Annual data only.</strong> All series are currently converted to
                  annual frequency. Requests for monthly, quarterly, weekly, or daily
                  trends will be analyzed using annualized data.
                </li>
                <li>
                  <strong>Keep prompts concise.</strong> Short, focused questions help the
                  retrieval system identify the most relevant economic indicators. Very
                  long prompts may reduce selection accuracy.
                </li>
                <li>
                  <strong>Use economic concepts, not series IDs.</strong> InsightIQ now
                  searches its local FRED index for matching indicators, so prompts like
                  "inflation and unemployment since 2020" are preferred over manually
                  listing FRED series IDs.
                </li>
              </ul>
            </div>
          </div>
        </article>

        <article className="prompt-guidance__section">
          <button
            className="prompt-guidance__trigger"
            type="button"
            aria-expanded={Boolean(openGuidanceSections.results)}
            aria-controls="guidance-results"
            onClick={() => toggleGuidanceSection('results')}
          >
            Understanding Results
          </button>
          <div
            className="prompt-guidance__content"
            id="guidance-results"
            data-open={Boolean(openGuidanceSections.results)}
          >
            <div>
              <ul>
                <li>
                  <strong>Up to four indicators per request.</strong> To keep analyses
                  focused and readable, InsightIQ selects a maximum of four FRED series
                  for each query.
                </li>
                <li>
                  <strong>Only valid FRED data is used.</strong> If a suggested indicator
                  is unavailable or invalid, it will be excluded from the analysis.
                </li>
                <li>
                  <strong>Data availability varies.</strong> Some economic indicators may
                  not be available for certain geographies, time periods, or topics.
                  Missing series are automatically skipped.
                </li>
                <li>
                  <strong>Insights are data-driven.</strong> Explanations are generated
                  from the retrieved economic data only. InsightIQ does not intentionally
                  provide news analysis, policy recommendations, forecasts, or external
                  commentary.
                </li>
                <li>
                  <strong>Overall summaries combine selected charts.</strong> The summary
                  is generated from the retrieved series shown on the dashboard, not from
                  outside news or web research.
                </li>
                <li>
                  <strong>Indicator selection is automated.</strong> InsightIQ currently
                  uses vector search over its indexed FRED catalog to choose which
                  economic indicators to analyze. Manual selection of specific FRED
                  series is not yet supported.
                </li>
              </ul>
            </div>
          </div>
        </article>

        <article className="prompt-guidance__section">
          <button
            className="prompt-guidance__trigger"
            type="button"
            aria-expanded={Boolean(openGuidanceSections.history)}
            aria-controls="guidance-history"
            onClick={() => toggleGuidanceSection('history')}
          >
            Query History
          </button>
          <div
            className="prompt-guidance__content"
            id="guidance-history"
            data-open={Boolean(openGuidanceSections.history)}
          >
            <div>
              <ul>
                <li>
                  <strong>Recent history is stored locally.</strong> The app saves the 10
                  most recent completed queries in your browser for quick access.
                </li>
                <li>
                  <strong>History does not sync across devices.</strong> Saved queries
                  remain only on the browser where they were created and may be cleared
                  if browser storage is removed.
                </li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <PromptSearchBar isLoading={isLoading} onSubmit={handlePromptSubmit} />

      {error && <p className="dashboard__error">{error}</p>}

      <OverallSummary summary={summary} />
      <ResultsGrid series={series} />
    </>
  )
}

export default DashboardPage
