const ANSI_CSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g
const ANSI_OSC_PATTERN = /\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi

const REVIEW_HINT_PATTERNS = [
  /\/merge[_-]requests?\/new/i,
  /\/merge[_-]request\//i,
  /[?&]merge[_-]request/i,
  /create[_-]merge[_-]request/i,
  /\/pulls?\/new/i,
  /\/pull[_-]requests?\/new/i,
  /\/pull[_-]request\//i,
  /[?&]pull[_-]request/i,
  /create[_-]pull[_-]request/i,
  /\/compare\//i,
]

export interface PushFeedback {
  isUpToDate: boolean
  reviewUrl: string | null
}

export function stripAnsi(text: string): string {
  return text.replace(ANSI_OSC_PATTERN, '').replace(ANSI_CSI_PATTERN, '')
}

function normalizeUrlCandidate(candidate: string): string {
  return candidate
    .replace(/^[<(]+/, '')
    .replace(/[)\].,;:>]+$/, '')
}

export function extractUrls(text: string): string[] {
  const cleaned = stripAnsi(text)
  const matches = cleaned.match(URL_PATTERN) ?? []

  return matches
    .map(normalizeUrlCandidate)
    .filter(Boolean)
}

function scoreReviewUrl(candidate: string): number {
  const normalized = candidate.toLowerCase()
  let score = 0

  for (const pattern of REVIEW_HINT_PATTERNS) {
    if (pattern.test(normalized)) score += 10
  }

  if (normalized.includes('/merge_requests/new') || normalized.includes('/merge-requests/new')) {
    score += 50
  }

  if (normalized.includes('/pull/new') || normalized.includes('/pulls/new')) {
    score += 50
  }

  return score
}

export function extractReviewUrl(text: string): string | null {
  const urls = extractUrls(text)
  if (urls.length === 0) return null

  let bestUrl = urls[0]
  let bestScore = scoreReviewUrl(bestUrl)

  for (const url of urls.slice(1)) {
    const score = scoreReviewUrl(url)
    if (score > bestScore) {
      bestUrl = url
      bestScore = score
    }
  }

  return bestUrl
}

export function interpretSuccessfulPush(output: string): PushFeedback {
  const normalized = stripAnsi(output).toLowerCase()
  const isUpToDate = normalized.includes('nothing changed')
    || normalized.includes('already up to date')
    || normalized.includes('already up-to-date')

  if (isUpToDate) {
    return {
      isUpToDate: true,
      reviewUrl: null,
    }
  }

  return {
    isUpToDate: false,
    reviewUrl: extractReviewUrl(output),
  }
}
