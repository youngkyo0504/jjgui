# PRD: SVG 기반 커밋 그래프 렌더링 + Chevron 펼침/접힘

## Problem Statement

현재 visual-jj-webview의 커밋 그래프는 jj CLI의 텍스트 출력(│○◆@ 등 Unicode box-drawing 문자)을 `<span>` 태그로 그대로 렌더링하고 있다. 이 방식은:

- 커밋 간 연결선이 시각적으로 끊겨 보여 그래프 흐름을 파악하기 어렵다
- 브랜치 분기/병합 시 곡선 표현이 불가능하다
- 커밋 노드가 텍스트 문자(○, ◆, @)로 표현되어 가시성이 낮다
- 커밋의 변경 파일 목록을 보려면 별도 클릭/패널이 필요하다

GG, GitKraken 등 다른 VCS GUI처럼 연속된 세로 라인, 원형 노드, 곡선 분기선, 인라인 파일 목록 펼침이 필요하다.

## Solution

기존 텍스트 기반 `GraphLine` 컴포넌트를 SVG 기반 렌더러로 교체한다.

- jj가 이미 제공하는 `graphChars`와 `laneColors` 데이터를 파싱하여 SVG 렌더링 데이터(활성 레인, 노드 타입, 연결 정보)로 변환
- 각 행마다 고정 높이의 SVG 셀을 렌더링: `<line>`으로 세로 연결선, `<circle>`/`<path>`로 노드, cubic Bezier `<path>`로 분기/병합 곡선
- 커밋 행에 chevron 토글을 추가하여 변경 파일 목록을 인라인으로 펼침/접힘

## User Stories

1. As a 개발자, I want 커밋 간 연속된 세로 라인을 보고 싶다, so that 브랜치의 흐름을 한눈에 파악할 수 있다
2. As a 개발자, I want 커밋 노드가 채워진 원형(filled circle)으로 표시되길 원한다, so that 커밋 위치를 명확히 식별할 수 있다
3. As a 개발자, I want working copy 커밋이 초록색 노드 + "You are here" 배지로 표시되길 원한다, so that 현재 작업 위치를 즉시 알 수 있다
4. As a 개발자, I want immutable 커밋이 다이아몬드(◆) 형태로 구분되길 원한다, so that 수정 불가능한 커밋을 시각적으로 구분할 수 있다
5. As a 개발자, I want 브랜치 분기 시 부드러운 곡선으로 연결선이 그려지길 원한다, so that 어떤 커밋에서 분기되었는지 직관적으로 알 수 있다
6. As a 개발자, I want 브랜치 병합 시 곡선으로 합류하는 연결선을 보고 싶다, so that 병합 관계를 쉽게 파악할 수 있다
7. As a 개발자, I want 각 레인(브랜치)이 고유한 색상을 유지하길 원한다, so that 여러 브랜치를 색상으로 구분할 수 있다
8. As a 개발자, I want 커밋 행의 chevron(▸/▾)을 클릭하여 변경 파일 목록을 펼치고 싶다, so that 각 커밋의 변경 내용을 빠르게 확인할 수 있다
9. As a 개발자, I want 펼친 파일 목록이 커밋 행 바로 아래에 인라인으로 표시되길 원한다, so that 그래프 컨텍스트를 유지하면서 파일을 볼 수 있다
10. As a 개발자, I want 파일 목록 펼침 시에도 그래프 세로 라인이 끊기지 않길 원한다, so that 그래프 연속성이 유지된다
11. As a 개발자, I want elided(생략된) 행도 SVG로 표현되길 원한다, so that 전체 그래프가 일관된 스타일로 보인다
12. As a 개발자, I want edge(연결) 행도 SVG 세로선으로 표현되길 원한다, so that 커밋 사이 빈 공간에서도 라인이 이어진다
13. As a 개발자, I want rebase 모드에서도 SVG 그래프가 정상 동작하길 원한다, so that 기존 rebase 워크플로우가 깨지지 않는다
14. As a 개발자, I want 그래프가 다크/라이트 테마 모두에서 잘 보이길 원한다, so that 어떤 테마에서든 사용할 수 있다

## Implementation Decisions

### 모듈 구조

1. **GraphCharParser (새 모듈)**
   - `graphChars` 문자열 + `laneColors` 배열을 입력받아 구조화된 렌더링 데이터로 변환
   - 출력: 각 컬럼별 `{ type: 'line' | 'node' | 'curve-left' | 'curve-right' | 'empty', color: string, nodeType?: 'normal' | 'working-copy' | 'immutable' | 'elided' }`
   - 문자 매핑: `│` → line, `○@` → node(normal/working-copy), `◆` → node(immutable), `╮╭` → curve, `─` → horizontal, `~` → elided 등
   - 클라이언트에서 파싱 (서버 변경 최소화)

2. **SvgGraphCell (새 컴포넌트, GraphLine 대체)**
   - 파싱된 렌더링 데이터를 받아 고정 높이 SVG로 렌더링
   - 레인 너비: ~20px, 행 높이: 기존 row 높이와 동일
   - 세로선: `<line>` 또는 `<path>` (상단→하단, 레인 색상)
   - 노드: `<circle>` (filled, 레인 색상), working copy는 초록, immutable은 `<path>`로 다이아몬드
   - 분기/병합 곡선: cubic Bezier `<path>` (`C` command)
   - 수평선: `<line>` (레인 간 연결)

3. **CommitRow 수정**
   - `GraphLine` → `SvgGraphCell`로 교체
   - chevron 토글 버튼 추가 (커밋 설명 왼쪽)
   - 펼침 상태 관리: `expandedCommits: Set<string>` (changeId 기반)
   - 펼침 시 `/api/show/:changeId` 호출하여 파일 목록 표시
   - 파일 목록 영역에서도 세로 레인 라인 유지 (SvgGraphCell의 line-only 모드)

4. **EdgeRow, ElidedRow 수정**
   - `GraphLine` → `SvgGraphCell`로 교체

5. **App.tsx 상태 관리**
   - `expandedCommits` 상태 추가
   - 토글 핸들러: changeId로 Set에 추가/제거
   - 파일 목록 캐시: `Map<string, FileInfo[]>` (이미 로드한 데이터 재사용)

### 기술적 결정

- **외부 라이브러리 없음**: 커스텀 SVG + React로 구현. jj가 lane 할당을 이미 해주므로 별도 레이아웃 알고리즘 불필요
- **행 단위 SVG**: 전체 그래프를 하나의 SVG로 그리지 않고, 각 행마다 독립적인 SVG 셀 렌더링. 향후 가상 스크롤링 호환성 확보
- **graphChars 파싱은 클라이언트**: 서버 API 변경 없이 기존 `GraphRow` 인터페이스 유지. 파서만 추가
- **chevron 데이터**: 기존 `/api/show/:changeId` API 활용. lazy loading (펼칠 때만 fetch)
- **파일 목록 영역의 그래프 라인**: 펼쳐진 파일 목록 각 행에도 세로 레인 라인을 그려서 그래프 연속성 유지

### Bezier 곡선 계산

분기/병합 곡선의 control point 계산:
- 시작점: (sourceColumn * laneWidth, 0) — 행 상단
- 끝점: (targetColumn * laneWidth, rowHeight) — 행 하단
- Control points: 수직 방향으로 약 60-70% 지점에서 수평 전환 시작

## Testing Decisions

좋은 테스트란 외부 동작(입력 → 출력)만 검증하고, 내부 구현 세부사항에 의존하지 않는 테스트다.

### 테스트 대상 모듈

**GraphCharParser 유닛 테스트**
- 다양한 `graphChars` 입력에 대해 올바른 렌더링 데이터가 출력되는지 검증
- 테스트 케이스:
  - 단일 세로선 (`│`) → line 타입
  - 일반 커밋 (`○`) → node(normal) 타입
  - working copy (`@`) → node(working-copy) 타입
  - immutable (`◆`) → node(immutable) 타입
  - 분기 (`╮`, `╭`) → curve 타입
  - 복합 패턴 (`│ ○ │`) → 여러 컬럼의 올바른 파싱
  - 빈 공간 (` `) → empty 타입
  - elided (`~`) → elided 타입
- 테스트 프레임워크: bun test (Bun 내장 테스트 러너)

### 테스트 제외

- SVG 렌더링 컴포넌트 (시각적 출력은 수동 확인)
- chevron 펼침/접힘 (통합 테스트 범위, 현재 테스트 인프라 부재)
- API 호출 (기존 API 변경 없음)

## Out of Scope

- 가상 스크롤링 (대규모 저장소 성능 최적화)
- 커밋 노드 드래그 앤 드롭 (rebase UI 개선)
- 그래프 줌 인/아웃
- 서버 측 API 변경 (graphChars → 구조화 데이터 변환)
- 커밋 검색/필터링 UI
- 파일 diff 인라인 표시 (파일 목록만 표시, diff는 별도)
- 애니메이션/트랜지션 효과

## Further Notes

- vscode-git-graph의 `web/graph.ts`와 DoltHub의 블로그 포스트가 SVG 커밋 그래프 구현의 좋은 레퍼런스
- jj의 `graphChars`는 터미널 너비에 따라 문자 수가 달라질 수 있으므로, 파서는 가변 길이를 처리해야 함
- 기존 rebase 하이라이팅(source, descendant, target 색상)은 SVG 노드/라인에도 동일하게 적용되어야 함
- 향후 가상 스크롤링 도입 시, 행 단위 SVG 구조가 유리함
