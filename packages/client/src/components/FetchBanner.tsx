import type { FetchState } from '../repo/types'

interface Props {
  fetchState: FetchState
  onUndo: () => void
  onDismiss: () => void
}

export default function FetchBanner({ fetchState, onUndo, onDismiss }: Props) {
  if (fetchState.phase === 'executing') {
    return (
      <div className="fetch-banner">
        <div className="fetch-banner-main">
          <span className="fetch-banner-text">Fetching all remotes...</span>
        </div>
      </div>
    )
  }

  if (!fetchState.results) return null

  if (fetchState.results.length === 0) {
    return (
      <div className="fetch-banner">
        <div className="fetch-banner-main">
          <span className="fetch-banner-text">No remotes configured.</span>
          <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onDismiss}>
            Close
          </button>
        </div>
      </div>
    )
  }

  const successCount = fetchState.results.filter((result) => result.ok).length
  const failureCount = fetchState.results.length - successCount
  const bannerClassName = failureCount === 0
    ? 'fetch-banner fetch-banner--success'
    : successCount === 0
      ? 'fetch-banner fetch-banner--error'
      : 'fetch-banner fetch-banner--partial'

  const summary = failureCount === 0
    ? `Fetch complete: ${successCount} remote${successCount === 1 ? '' : 's'} succeeded.`
    : successCount === 0
      ? `Fetch failed on all ${failureCount} remotes.`
      : `Fetch complete: ${successCount} succeeded, ${failureCount} failed.`

  return (
    <div className={bannerClassName}>
      <div className="fetch-banner-main">
        <span className="fetch-banner-text">{summary}</span>
        {fetchState.beforeOpId && (
          <button className="rebase-banner-btn rebase-banner-btn--undo" onClick={onUndo}>
            Undo
          </button>
        )}
        <button className="rebase-banner-btn rebase-banner-btn--cancel" onClick={onDismiss}>
          Close
        </button>
      </div>
      <div className="fetch-results">
        {fetchState.results.map((result) => (
          <div key={result.remote} className="fetch-result">
            <div className="fetch-result-header">
              <span className={`fetch-result-status fetch-result-status--${result.ok ? 'success' : 'error'}`}>
                {result.ok ? 'OK' : 'FAIL'}
              </span>
              <span className="fetch-result-remote">{result.remote}</span>
            </div>
            {result.output && (
              <details className="fetch-result-details">
                <summary>Details</summary>
                <pre className="fetch-result-output">{result.output}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
