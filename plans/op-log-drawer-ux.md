# Plan: Operation Log Drawer UX

## Summary

- 상단 전역 배너(`RebaseBanner`, `MoveChangesBanner`, `FetchBanner`)를 제거한다
- 작업 진행은 두 레이어로 나눈다
  - 전역 레이어: 툴바의 `Ops` status chip
  - 로컬 레이어: 대상 커밋 주변의 inline action panel
- 실행 결과와 되돌리기(`Restore`)는 오직 `op log drawer`에서 제공한다
- drawer는 자동으로 열지 않는다. 성공/실패 모두 사용자가 직접 연다

---

## Goals

- 상단 배너로 인한 layout shift를 제거한다
- 사용자가 작업 중에도 commit log를 계속 읽을 수 있게 한다
- rebase/move와 같은 그래프 조작은 그래프 근처에서 끝낼 수 있게 한다
- operation history와 restore 진입점을 한 곳으로 모은다

## Non-goals

- modal 기반의 전역 확인 UX로 돌아가지 않는다
- 실행 직후 toast나 success banner를 다시 추가하지 않는다
- `Undo`를 여러 위치에 중복 노출하지 않는다

---

## Design principles

### 1. Global status is tiny

전역 UI는 상태를 요약만 한다. 설명, 확인, 되돌리기는 전역에서 하지 않는다.

### 2. Decisions happen near the row

사용자의 다음 행동이 특정 커밋에 묶여 있다면, 그 안내와 액션은 그 커밋 근처에 둔다.

### 3. History is a separate tool

`op log`는 보조 메시지가 아니라, 작업 히스토리와 restore를 담당하는 독립 도구다.

### 4. No surprise movement

페이지 상단 구조는 작업 중에도 고정한다. 변화는 row 근처의 local expansion으로만 허용한다.

---

## Primary UI pieces

### 1. Toolbar `Ops` chip

위치:
- 기존 toolbar 우측 액션 영역

역할:
- 최근 operation 상태 요약
- drawer open trigger

상태:
- idle: `Ops`
- running: `Ops · Rebasing...`
- success with recent app op: `Ops · 1 recent`
- failure with recent app op: `Ops · Failed`

규칙:
- 항상 같은 자리에서 렌더링한다
- width가 크게 출렁이지 않도록 label 길이를 제한한다
- 클릭 시 우측 drawer를 연다
- 자동으로 열리지 않는다

### 2. Operation log drawer

위치:
- 우측 side drawer

역할:
- recent operations 목록
- operation 상세 정보
- restore action

규칙:
- overlay 위에 뜨되, 메인 log scroll position은 유지한다
- ESC 또는 backdrop click으로 닫는다
- 성공/실패 여부와 관계없이 자동 open하지 않는다

### 3. Inline action panel

위치:
- destination으로 선택된 commit row 바로 아래

역할:
- 현재 선택된 작업의 최종 확인
- 취소
- 실행 중 상태 표시

적용 대상:
- rebase
- move changes
- split/squash/discard처럼 row 근처에서 맥락이 중요한 작업 전반

---

## Screen specs

### A. Default screen

```text
+----------------------------------------------------------------------------------+
| visual-jj — /repo/path                                    [Remote refs] [Fetch] [Ops] |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  @  zyx  working-copy                                            2m              |
|  ○  def  feature work                                            8m              |
|  ○  abc  base commit                                             1h              |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

규칙:
- 상단 배너 없음
- `Ops` chip은 중립 상태

### B. Rebase source selected

```text
+----------------------------------------------------------------------------------+
| visual-jj — /repo/path                                    [Remote refs] [Fetch] [Ops · Rebasing...] |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  @  zyx  working-copy                                            2m              |
|  ○  def  feature work            <- source                        8m              |
|  ○  ghi  child commit            <- descendant                    6m              |
|  ○  abc  base commit             <- valid destination             1h              |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

행 스타일:
- source: 가장 강한 강조
- descendants: 약한 강조
- valid destination: hover 가능
- invalid destination: 흐리게 표시

규칙:
- 전역 안내 문구는 두지 않는다
- "destination을 클릭하라"는 문맥은 row 스타일과 cursor state로 전달한다

### C. Destination selected

```text
+----------------------------------------------------------------------------------+
| visual-jj — /repo/path                                    [Remote refs] [Fetch] [Ops · Rebasing...] |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  @  zyx  working-copy                                            2m              |
|  ○  def  feature work            <- source                        8m              |
|  ○  ghi  child commit            <- descendant                    6m              |
|  ○  abc  base commit             <- destination selected          1h              |
|      ┌───────────────────────────────────────────────────────────────┐            |
|      | Rebase 2 commits onto abc                                    |            |
|      | source: def "feature work"                                   |            |
|      | destination: abc "base commit"                               |            |
|      |                                     [Cancel] [Rebase]        |            |
|      └───────────────────────────────────────────────────────────────┘            |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

규칙:
- confirm panel은 destination row 아래에 붙는다
- panel은 log 내부에서만 local expansion을 일으킨다
- source row 아래가 아니라 destination row 아래에 렌더링한다

### D. Executing

```text
+----------------------------------------------------------------------------------+
| visual-jj — /repo/path                                    [Remote refs] [Fetch] [Ops · Rebasing...] |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  ○  abc  base commit             <- destination selected          1h              |
|      ┌───────────────────────────────────────────────────────────────┐            |
|      | Rebasing 2 commits...                                         |            |
|      |                                     [Cancel disabled]         |            |
|      └───────────────────────────────────────────────────────────────┘            |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

규칙:
- 실행 중에는 panel을 progress 상태로 잠근다
- 추가 전역 배너는 띄우지 않는다
- 완료되면 panel은 즉시 사라진다

### E. Completed, drawer closed

```text
+----------------------------------------------------------------------------------+
| visual-jj — /repo/path                                    [Remote refs] [Fetch] [Ops · 1 recent] |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  @  ... updated log ...                                                          |
|  ○  ...                                                                          |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

규칙:
- success banner 없음
- inline panel 없음
- restore는 drawer에서만 가능

### F. Drawer open

```text
+------------------------------------------------------+---------------------------+
| main log                                             | Operations                |
|                                                      |---------------------------|
|  @  ...                                              | [Running] Rebase subtree  |
|  ○  ...                                              | def -> abc                |
|  ○  ...                                              | just now                  |
|                                                      |                           |
|                                                      | [Done] Move 3 files       |
|                                                      | ghi -> xyz                |
|                                                      | 2m ago          [Restore] |
|                                                      |                           |
|                                                      | [Failed] Fetch origin     |
|                                                      | 3m ago          [Details] |
+------------------------------------------------------+---------------------------+
```

규칙:
- 최근 항목이 위에 온다
- card 전체를 눌러 details를 펼칠 수 있다
- `Restore`는 가능한 항목에만 노출한다

---

## Drawer information architecture

### Drawer header

- 제목: `Operations`
- 보조 액션: `Close`

### Operation list item

각 item은 아래 정보를 가진다:
- status
- action label
- 대상 요약
- relative timestamp
- optional details toggle
- optional `Restore` button

### Suggested labels

- `Rebase subtree`
- `Move 3 files`
- `Split commit`
- `Squash into parent`
- `Discard file changes`
- `Fetch all remotes`

### Details content

성공:
- source / destination / file count 같은 요약

실패:
- jj stderr/stdout 요약
- 실패 원인

fetch:
- remote별 성공/실패 목록

---

## Interaction rules

### Rebase

1. 컨텍스트 메뉴에서 `Rebase this subtree`
2. source + descendants 하이라이트
3. destination 클릭
4. destination row 아래 confirm panel 표시
5. `Rebase` 클릭
6. panel은 executing 상태로 전환
7. 완료 후 panel 제거, chip 상태 갱신
8. 필요 시 사용자가 drawer를 열어 restore

### Move changes

1. 컨텍스트 메뉴에서 `Move changes from here`
2. 파일 선택 modal
3. destination 클릭
4. destination row 아래 confirm panel 표시
5. 완료 후 drawer에서만 restore 가능

### Fetch

1. toolbar `Fetch`
2. chip만 `Ops · Fetching...`로 변경
3. 완료 후 chip 상태 갱신
4. 상세 결과는 drawer에서 확인

---

## Component-level spec

### Toolbar

추가 요소:
- `OpsChip`

props:
- `status`: `idle | running | success | failed`
- `label`: string
- `onClick()`
- `hasRecentOperations`: boolean

### CommitRow

추가 가능 상태:
- `isSource`
- `isDescendant`
- `isDestination`
- `inlinePanel`

`inlinePanel` variants:
- `rebase-confirm`
- `move-confirm`
- `executing`

### OperationDrawer

신규 컴포넌트:
- `isOpen`
- `operations`
- `onClose()`
- `onRestore(operationId)`
- `onToggleDetails(operationId)`

### Operation item model

```ts
interface OperationItem {
  id: string
  kind: 'rebase' | 'move-changes' | 'split' | 'squash' | 'discard-file' | 'fetch' | 'unknown'
  status: 'running' | 'success' | 'failed'
  title: string
  summary: string
  timestamp: string
  details?: string
  restoreOperationId?: string | null
  sourceChangeId?: string
  destinationChangeId?: string
}
```

---

## Behavior rules

### Restore policy

- restore는 drawer에서만 제공한다
- 기본 라벨은 `Restore`
- 앱이 기록한 undoable operation에만 활성화한다
- 앱 외부에서 생성된 일반 `jj op log` 항목은 일단 읽기 전용으로 보여줄 수 있다

### Failure policy

- 실패해도 drawer를 자동 open하지 않는다
- chip만 `Failed` 상태로 바뀐다
- 상세 원인은 drawer 안에서 본다

### Discoverability policy

- `Ops` chip은 항상 같은 위치에 유지한다
- recent operation이 없어도 중립 상태로 노출해 drawer의 존재를 학습시킨다

---

## Responsive behavior

### Wide layout

- 우측 drawer 폭 360px ~ 420px

### Narrow layout

- drawer를 full-height overlay panel로 사용
- main log는 뒤에 유지

---

## Accessibility

- `Ops` chip은 keyboard focus 가능해야 한다
- drawer는 focus trap을 가진다
- ESC로 drawer 닫기 지원
- executing panel은 `aria-live="polite"` 수준의 상태 갱신을 고려한다

---

## Copy guide

짧고 동사 중심으로 쓴다.

예시:
- `Ops`
- `Ops · Rebasing...`
- `Ops · 1 recent`
- `Ops · Failed`
- `Rebase 2 commits onto abc`
- `Move 3 files into xyz`
- `Restore`

피해야 하는 것:
- 긴 설명형 배너 문장
- 전역에서만 이해 가능한 추상 메시지

---

## Implementation outline

### Phase 1. Drawer foundation

- `Ops` chip 추가
- drawer shell 추가
- operation list를 위한 서버 API 추가

### Phase 2. Banner removal

- 기존 상단 banner 컴포넌트 제거
- fetch 결과를 drawer 중심으로 이전

### Phase 3. Inline action panels

- rebase destination confirm panel
- move changes confirm panel
- executing 상태 panel

### Phase 4. Restore policy

- drawer에서만 restore 가능하게 정리
- 기존 success undo affordance 제거

---

## Acceptance criteria

- [ ] rebase/move/fetch 수행 시 상단 layout shift가 발생하지 않는다
- [ ] 사용자는 배너 없이도 rebase destination 선택과 실행을 완료할 수 있다
- [ ] 실행 결과는 `Ops` chip + drawer에서 확인할 수 있다
- [ ] restore는 drawer에서만 가능하다
- [ ] 실패 시 drawer가 자동으로 열리지 않는다
- [ ] destination 선택 후 confirm panel은 destination row 바로 아래에 보인다

---

## Open questions

- `Ops` chip에 숫자 badge를 붙일지, 텍스트만 유지할지
- drawer 목록을 전체 `jj op log`로 시작할지, 앱 작업 중심 recent list로 시작할지
- fetch의 remote별 상세 결과를 카드 확장으로만 보여줄지 별도 detail panel을 둘지
