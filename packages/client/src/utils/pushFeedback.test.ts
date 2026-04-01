import { describe, expect, test } from 'bun:test'
import { extractReviewUrl, interpretSuccessfulPush } from './pushFeedback'

describe('interpretSuccessfulPush', () => {
  test('plain success without urls keeps review link empty', () => {
    expect(interpretSuccessfulPush('Changes to push to origin:\n  Add bookmark feature\n')).toEqual({
      isUpToDate: false,
      reviewUrl: null,
    })
  })

  test('gitlab merge request link is extracted from success output', () => {
    const output = [
      'remote:',
      'remote: To create a merge request for feature-x, visit:',
      'remote:   https://gitlab.example.com/group/repo/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature-x',
    ].join('\n')

    expect(interpretSuccessfulPush(output)).toEqual({
      isUpToDate: false,
      reviewUrl: 'https://gitlab.example.com/group/repo/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature-x',
    })
  })

  test('ansi colored output still yields the review link', () => {
    const output = '\u001B[32mremote:\u001B[0m Create pull request:\n\u001B[36mhttps://example.com/org/repo/pull/new/feature-x\u001B[0m'

    expect(interpretSuccessfulPush(output)).toEqual({
      isUpToDate: false,
      reviewUrl: 'https://example.com/org/repo/pull/new/feature-x',
    })
  })

  test('already up to date result does not surface review link', () => {
    const output = 'Nothing changed.\nremote: https://example.com/org/repo/pull/new/feature-x'

    expect(interpretSuccessfulPush(output)).toEqual({
      isUpToDate: true,
      reviewUrl: null,
    })
  })
})

describe('extractReviewUrl', () => {
  test('prefers review-like link over generic repository url', () => {
    const output = [
      'remote: Repository: https://example.com/org/repo',
      'remote: Open a review: https://example.com/org/repo/compare/main...feature-x?expand=1',
    ].join('\n')

    expect(extractReviewUrl(output)).toBe('https://example.com/org/repo/compare/main...feature-x?expand=1')
  })

  test('falls back to first url when no review-specific hint exists', () => {
    const output = 'remote: Details at https://example.com/org/repo/activity'

    expect(extractReviewUrl(output)).toBe('https://example.com/org/repo/activity')
  })
})
