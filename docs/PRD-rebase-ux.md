# PRD: visual-jj Rebase UX

## 배경

visual-jj-webview는 jj(Jujutsu) VCS의 커밋 그래프를 웹 기반 GUI로 보여주는 도구다. 현재 커밋 로그 조회, 파일 변경 조회, `jj edit`(working copy 전환)을 지원한다. 사용자가 터미널 없이 GUI에서 직접 rebase를 수행할 수 있는 기능이 필요하다.

## 문제

jj rebase는 강력하지만 옵션 조합이 복잡하다(`-r`/`-s`/`-b` × `-d`/`--insert-after`/`--insert-before`). 특히 "특정 스택을 다른 커밋 위로 이동"하는 가장 흔한 사용 패턴을 GUI에서 시각적으로 수행할 수 있으면, 사용자가 커밋 그래프를 보면서 직관적으로 rebase할 수 있다.

## 목표

- 커밋 그래프에서 2-click으로 스택 rebase를 수행할 수 있다
- rebase 전 이동 범위를 시각적으로 확인할 수 있다
- 실수 시 즉시 되돌릴 수 있다

## 비목표

- `-r` (단일 커밋 이동), `-b` (브랜치 rebase), `--insert-after/before` (삽입) 모드는 이번 범위에 포함하지 않는다 (향후 UI 확장으로 대응)
- conflict 해결 UI는 제공하지 않는다 (conflict 표시만)
- 드래그 앤 드롭 인터랙션은 이번 범위에 포함하지 않는다

---

## 기능 명세

### 1. Rebase 모드 진입

- 커밋 행에 "Rebase" 버튼 또는 우클릭 컨텍스트 메뉴를 통해 rebase 모드에 진입한다
- rebase 모드에 진입하면 클릭한 커밋이 source(이동할 스택의 루트)로 선택된다

### 2. 서브트리 하이라이트

- source 커밋이 선택되면, 해당 커밋과 모든 descendants를 시각적으로 하이라이트한다
- 하이라이트를 통해 사용자는 "이만큼이 이동됩니다"를 확인할 수 있다
- immutable 커밋은 source로 선택할 수 없다 (선택 시 에러 메시지 표시)

### 3. Destination 선택

- 서브트리 하이라이트 상태에서, 그래프의 다른 커밋을 클릭하면 destination으로 선택된다
- destination으로 선택 불가능한 커밋 (source 서브트리 내부의 커밋)은 비활성화 표시
- destination 선택 시 확인 다이얼로그를 표시한다:
  - source 커밋의 changeId와 description
  - destination 커밋의 changeId와 description
  - 이동되는 커밋 수
  - "Rebase" / "Cancel" 버튼

### 4. Rebase 실행

- 확인 시 `jj rebase -s <source_changeId> -d <destination_changeId>` 실행
- 실행 후 그래프를 자동 새로고침한다
- rebase 성공 시 toast/알림으로 결과를 표시한다
- conflict가 발생한 커밋이 있으면 conflict 뱃지로 표시한다 (해결은 터미널에서)

### 5. Undo

- rebase 실행 직후 "Undo" 버튼을 표시한다
- 클릭 시 `jj undo` 실행 후 그래프를 새로고침한다
- undo 버튼은 다른 작업을 수행하기 전까지 유지된다

### 6. 모드 취소

- rebase 모드 중 ESC 키 또는 "Cancel" 버튼으로 모드를 취소할 수 있다
- 취소 시 하이라이트가 해제되고 일반 모드로 돌아간다

---

## 상태 머신

```
[일반 모드]
    │
    ├─ (커밋에서 Rebase 클릭) ──→ [소스 선택됨 / 서브트리 하이라이트]
    │                                    │
    │                                    ├─ (다른 커밋 클릭) ──→ [확인 다이얼로그]
    │                                    │                           │
    │                                    │                           ├─ (Rebase 확인) ──→ [실행 중] ──→ [완료 + Undo 표시]
    │                                    │                           │                                       │
    │                                    │                           └─ (Cancel) ──→ [소스 선택됨]            └─ (Undo 클릭) ──→ [일반 모드]
    │                                    │
    │                                    └─ (ESC / Cancel) ──→ [일반 모드]
    │
    └─ (일반 클릭) ──→ 기존 동작 (expand/collapse)
```

---

## 기술 설계

### 백엔드 (packages/server)

범용적으로 설계하여 향후 `-r`, `-b`, `--insert-after` 등을 추가할 수 있도록 한다.

#### API 엔드포인트

**POST `/api/rebase?cwd=...`**

```typescript
// Request body
interface RebaseRequest {
  sourceChangeId: string
  destinationChangeId: string
  mode: 'source' | 'revision' | 'branch'  // 현재는 'source'만 사용
}

// Response
{ ok: true }
// 또는
{ error: string }
```

**POST `/api/undo?cwd=...`**

```typescript
// Request body: 없음

// Response
{ ok: true }
// 또는
{ error: string }
```

#### jj.ts 추가 함수

```typescript
export async function rebaseCommit(
  cwd: string,
  sourceChangeId: string,
  destinationChangeId: string,
  mode: 'source' | 'revision' | 'branch' = 'source'
): Promise<void>

export async function undoLastOperation(cwd: string): Promise<void>
```

### 프론트엔드 (packages/client)

#### 데이터 구조 변경

커밋의 parent 정보는 이미 `CommitInfo.parents`에 있다. 서브트리 하이라이트를 위해 children 맵을 계산하는 유틸리티가 필요하다.

```typescript
// parent → children 역방향 맵 구축
function buildChildrenMap(rows: GraphRow[]): Map<string, string[]>

// 특정 커밋의 모든 descendants 계산
function getDescendants(changeId: string, childrenMap: Map<string, string[]>): Set<string>
```

#### App.tsx 상태 추가

```typescript
interface RebaseState {
  phase: 'idle' | 'source-selected' | 'confirming' | 'executing'
  sourceChangeId?: string
  destinationChangeId?: string
  descendants?: Set<string>  // 하이라이트 대상
  lastAction?: 'rebase'      // undo 가능 여부 판단
}
```

#### 컴포넌트 변경

- **CommitRow**: rebase 모드에 따라 다른 클릭 핸들러, 하이라이트 스타일, 비활성화 상태 적용
- **LogView**: rebase 상태를 CommitRow에 전달
- **RebaseConfirmDialog** (신규): 확인 다이얼로그 컴포넌트
- **UndoToast** (신규): undo 버튼이 포함된 toast 컴포넌트

#### 스타일 추가

```css
.graph-row--rebase-source { }      /* 소스 커밋 강조 */
.graph-row--rebase-descendant { }  /* 서브트리 하이라이트 */
.graph-row--rebase-target { }      /* destination 후보 hover */
.graph-row--rebase-disabled { }    /* 선택 불가 커밋 */
```

---

## 에러 처리

| 상황 | 처리 |
|---|---|
| immutable 커밋을 source로 선택 | 선택 차단 + "Immutable 커밋은 rebase할 수 없습니다" 메시지 |
| source 서브트리 내부를 destination으로 선택 | 선택 차단 (비활성화 표시) |
| jj rebase 명령 실패 | 에러 메시지 표시, 모드 초기화 |
| jj undo 명령 실패 | 에러 메시지 표시 |
| rebase 후 conflict 발생 | 그래프에서 conflict 뱃지 표시, "터미널에서 conflict를 해결하세요" 안내 |

---

## 구현 순서

1. 백엔드: `jj.ts`에 `rebaseCommit()`, `undoLastOperation()` 함수 추가
2. 백엔드: `routes.ts`에 `/api/rebase`, `/api/undo` 엔드포인트 추가
3. 프론트엔드: `buildChildrenMap()`, `getDescendants()` 유틸리티 구현
4. 프론트엔드: `App.tsx`에 rebase 상태 머신 추가
5. 프론트엔드: `CommitRow` 수정 — rebase 모드 UI (하이라이트, 비활성화, 클릭 핸들러)
6. 프론트엔드: `RebaseConfirmDialog` 컴포넌트 구현
7. 프론트엔드: `UndoToast` 컴포넌트 구현
8. 스타일링: rebase 관련 CSS 추가
