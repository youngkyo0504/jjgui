# PRD: Push Review Link Surface

## Problem Statement

현재 visual-jj-webview에서는 bookmark를 단건 push한 뒤 성공/실패 여부만 토스트로 보여준다. 하지만 GitLab, GitHub Enterprise, Gitea, 혹은 서버 훅이 설정된 환경에서는 `git push` 성공 직후 merge request 또는 pull request 생성 링크를 출력하는 경우가 있다.

이 링크는 사용자의 다음 액션과 직접 연결되는 정보인데, 현재 UI에서는 버려지고 있다. 사용자는 다시 터미널 출력으로 돌아가거나 브라우저에서 수동으로 저장소 페이지를 찾아가야 해서, push 직후의 자연스러운 리뷰 생성 흐름이 끊긴다.

## Solution

단일 bookmark push가 성공했을 때, 기존 성공 토스트 안에 provider가 출력한 review 생성 링크를 클릭 가능한 형태로 함께 보여준다. 링크는 remote 정보로 새로 합성하지 않고, `jj git push`가 반환한 raw output에서 직접 추출한다.

초기 범위에서는 단일 bookmark push에만 적용한다. subtree push, 여러 ref를 포함한 push, 실패 출력, 인증 에러 출력은 기존 토스트 동작을 유지한다. 링크가 없으면 현재와 같은 성공 메시지만 보여준다.

## User Stories

1. As a jj user, I want to see a review creation link in the success toast after a single bookmark push, so that I can open the next step immediately.
2. As a jj user, I want the UI to use the exact link emitted by the push command, so that provider-specific behavior keeps working without custom configuration.
3. As a jj user, I want the existing success toast to remain readable when no link is available, so that this feature feels additive instead of disruptive.
4. As a jj user, I want subtree push to keep its current result behavior, so that a broader push action does not suddenly show ambiguous links.
5. As a jj user, I want the feature to work with GitLab merge request links, so that common self-hosted workflows are supported.
6. As a jj user, I want the feature to work with pull request style links from other providers when they appear in push output, so that the UI is not hard-coded to one host.
7. As a jj user, I want the link to be clickable directly from the toast, so that I do not need to copy and paste terminal output.
8. As a jj user, I want the success message and the link to appear together, so that I understand both that the push succeeded and what I can do next.
9. As a jj user, I want outputs without any URL to still be treated as normal push success, so that harmless provider differences do not create false errors.
10. As a jj user, I want ANSI-colored or noisy command output to still produce the right link when possible, so that CLI formatting does not break the UI.
11. As a maintainer, I want the parsing logic to live in a small pure module, so that link extraction rules can be tested without rendering the whole app.
12. As a maintainer, I want the parsing logic to rank likely review links ahead of generic URLs, so that the toast usually surfaces the most useful destination first.
13. As a maintainer, I want the feature to avoid remote-host introspection in the first version, so that implementation stays simple and resilient to provider differences.
14. As a maintainer, I want the API contract changes to stay minimal or unnecessary, so that this UI enhancement can ship without refactoring the push backend.
15. As a maintainer, I want failure-mode behavior to remain unchanged, so that this feature does not accidentally hide important push errors behind new parsing rules.

## Implementation Decisions

- Push result interpretation will continue to start from the raw command output already returned by the push flow. The first version will not synthesize links from remote URLs, bookmark names, or branch naming conventions.
- A new pure push-feedback interpreter module will encapsulate output normalization, ANSI stripping, URL extraction, up-to-date classification, and review-link selection. This module is the primary deep module for the feature because it hides provider-specific output parsing behind a stable interface.
- The client push flow will keep the current success/error/info toast model, but the success variant will gain an optional single clickable link field.
- The feature applies only when the push scope is a single bookmark. Subtree push and other broader push scopes will explicitly skip link rendering even if their raw output contains URLs.
- URL extraction will scan successful output for HTTP(S) links. Link ranking will prefer URLs whose path or query strongly suggests review creation, such as merge-request, pull-request, or compare/create-review patterns. If no review-like URL is found, the interpreter may fall back to the first extracted URL.
- The toast will render at most one primary review link in the first version. If multiple candidate URLs are present, the highest-ranked one wins and the rest are ignored.
- Existing success classification such as "already up to date" will continue to work. Informational success without an actual push should not surface a review link.
- Failure responses will keep using the existing error toast path. The initial version will not parse or surface documentation/authentication URLs from failed pushes.
- The UI label for the clickable action should stay generic enough to fit multiple providers, for example "Open review link", rather than baking GitLab-only wording into the component contract.
- The feature should be implemented so that toast rendering remains independent from command execution details. The app should receive a small interpreted result object instead of scattering regexes through event handlers.

## Testing Decisions

- A good test for this feature validates externally observable parsing behavior from representative push outputs to the final interpreted toast model. It should not assert internal regex structure, React state sequencing, or component implementation details.
- Automated tests will focus on the pure push-feedback interpreter module. This is the highest-value surface because it contains the provider/output variability and is easy to exercise with fixtures.
- Test cases should cover at least: a plain success with no URL, a success with a GitLab-style merge request URL, a success with a pull-request style URL, ANSI-colored output, an "already up to date" result, and output containing multiple URLs where only one review link should be selected.
- Toast rendering and click behavior will be verified manually in the browser for the initial version. The goal is to confirm that the existing toast layout remains usable when a link is present.
- Prior art should follow the repository's current lightweight utility-test style: small Bun-based tests around pure functions, similar in spirit to the existing graph parser tests.

## Out of Scope

- Synthesizing merge request or pull request URLs from git remote metadata
- Persisting the extracted link on the commit row, bookmark badge, or history panels
- Showing links for subtree push, batch push, or any multi-target push flow
- Parsing and surfacing URLs from failed push output
- Provider-specific branding, icons, or custom CTA text per forge
- A full push output viewer or terminal transcript UI

## Further Notes

- This PRD assumes the desired UX is a one-shot next-step hint in the success toast, not a durable piece of commit metadata.
- This PRD also assumes "single push" means a normal single bookmark push path, not subtree push.
- If future demand appears for more reliable provider-specific handling, a later phase can move interpretation behind the API boundary or add explicit forge adapters. That is intentionally deferred for this version.
