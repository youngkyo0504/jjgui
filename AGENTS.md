# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# 개발 (서버 watch 모드, port 7777)
bun run dev

# 클라이언트 개발 (Vite dev server, /api → localhost:7777 프록시)
bun run --cwd packages/client dev

# 프로덕션 빌드 (클라이언트 → packages/client/dist)
bun run build

# CLI 실행 (서버 데몬 기동 + 브라우저 오픈)
bun run start [path]
bun run bin/jjgui.ts stop
```

테스트 프레임워크는 아직 없음.

## Architecture

Jujutsu(jj) 버전 관리 시스템의 웹 GUI. Bun 모노레포 (`packages/*` workspaces).

### Client (`packages/client`)
- React 18 + Vite SPA
- `App.tsx`가 전체 상태 관리 — rows(커밋 그래프), error, rebase 상태머신
- Rebase 워크플로우: `idle → source-selected → confirming → executing` (RebaseState 타입)
- `utils/graph.ts`에서 BFS로 descendants 계산하여 rebase 대상 검증
- SSE(`EventSource`)로 서버의 `refresh` 이벤트 수신 → 자동 fetchLog

### Server (`packages/server`)
- Bun.serve HTTP 서버 (port 7777)
- `jj.ts`: jj CLI 래퍼. Bun `$` 셸로 jj 명령 실행. 커스텀 template(`\x1f` 구분자)으로 로그 파싱
- `routes.ts`: API 핸들러 + cwd별 SSE 클라이언트 관리
- `index.ts`: 서버 부트, cwd별 fs.watch(recursive), static 파일 서빙 + SPA fallback
- PID 파일: `/tmp/jjgui.pid`

### CLI (`bin/jjgui.ts`)
- 데몬 매니저: health check → 없으면 detached subprocess로 서버 스폰 → 브라우저 오픈

### Data Flow
1. 클라이언트가 `?cwd=` 쿼리로 저장소 경로 전달
2. 서버가 해당 cwd로 jj 명령 실행, 결과를 GraphRow[] 형태로 반환
3. 파일 변경 시 fs.watch → SSE `refresh` → 클라이언트 자동 갱신

### Key Types
- `GraphRow`: `{ type: 'commit' | 'edge' | 'elided', graphChars, indent, laneColors, commit? }`
- `CommitInfo`: changeId, commitId, parents, bookmarks, workspaces, isWorkingCopy, isImmutable 등
- 그래프 문자: `○` = 일반 커밋, `◆` = immutable, `@` = working copy

### API
- `GET /api/log` — 커밋 그래프
- `GET /api/show/:changeId` — 변경 파일 목록
- `POST /api/edit`, `/api/new`, `/api/rebase`, `/api/undo` — 커밋 조작
- `GET /api/events` — SSE 스트림
- 모든 API는 `?cwd=` 필수
