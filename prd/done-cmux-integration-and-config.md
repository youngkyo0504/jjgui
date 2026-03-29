# PRD: cmux 내장 브라우저 연동 및 설정 시스템

## Problem Statement

현재 jjgui는 항상 macOS `open` 명령으로 시스템 기본 브라우저를 열어 GUI를 표시한다. cmux(Ghostty 기반 터미널 앱) 사용자는 터미널 안에서 내장 브라우저로 jjgui를 열고 싶지만, 이를 지원하는 옵션이 없다. 또한 설정 파일 시스템 자체가 없어서 포트, 열기 방식 등 사용자 환경에 맞는 기본값을 지정할 방법이 없다.

## Solution

설정 파일 시스템(`~/.jjgui/config.toml`)을 도입하고, 브라우저 열기 방식을 선택할 수 있는 `opener` 설정을 추가한다.

- `opener = "auto"` (기본값): `CMUX_SURFACE_ID` 환경변수가 있으면 cmux 내장 브라우저로, 없으면 시스템 브라우저로 연다.
- `opener = "browser"`: 항상 시스템 기본 브라우저로 연다 (현재 동작).
- `opener = "cmux"`: 항상 cmux 내장 브라우저로 연다.
- CLI 플래그 `--opener=<value>`로 설정 파일을 오버라이드할 수 있다.

cmux 연동 시 `cmux browser surface:<id> tab new <url>` 명령으로 내장 브라우저 탭을 연다.

## User Stories

1. As a cmux 사용자, I want to jjgui가 cmux 내장 브라우저에서 자동으로 열리게, so that 터미널을 떠나지 않고 jj GUI를 사용할 수 있다.
2. As a cmux 사용자, I want to cmux 내부에서 jjgui를 실행하면 자동으로 cmux 브라우저가 선택되게, so that 별도 설정 없이 바로 사용할 수 있다.
3. As a jjgui 사용자, I want to `~/.jjgui/config.toml` 파일로 기본 설정을 지정할 수 있게, so that 매번 CLI 플래그를 입력하지 않아도 된다.
4. As a jjgui 사용자, I want to `--opener` CLI 플래그로 설정 파일을 일시적으로 오버라이드할 수 있게, so that 상황에 따라 다른 열기 방식을 선택할 수 있다.
5. As a jjgui 사용자, I want to opener를 "browser"로 고정할 수 있게, so that cmux 내부에서도 시스템 브라우저를 사용할 수 있다.
6. As a jjgui 사용자, I want to cmux 설정에서 열기 모드(tab/split)와 split 방향(right/down)을 지정할 수 있게, so that 내 워크플로우에 맞게 레이아웃을 조정할 수 있다.
7. As a jjgui 사용자, I want to 설정 파일이 없어도 기본값으로 정상 동작하게, so that 설정 없이도 기존처럼 사용할 수 있다.
8. As a jjgui 사용자, I want to 잘못된 설정 파일이 있을 때 명확한 에러 메시지를 보게, so that 설정 문제를 빠르게 해결할 수 있다.
9. As a cmux 사용자, I want to cmux가 설치되지 않은 환경에서 opener="cmux"로 실행하면 명확한 에러가 나오게, so that 문제 원인을 바로 알 수 있다.
10. As a jjgui 사용자, I want to 설정 우선순위가 CLI 플래그 > 설정 파일 > 환경변수 자동감지 > 기본값 순서로 적용되게, so that 예측 가능한 동작을 기대할 수 있다.

## Implementation Decisions

### 설정 시스템

- 설정 파일 위치: `~/.jjgui/config.toml`
- 포맷: TOML (jj 자체 설정과 일관성, 주석 지원)
- 설정 파일이 없으면 모든 항목에 기본값 적용 (에러 아님)
- TOML 파싱 라이브러리 필요 (예: `@iarna/toml` 또는 Bun 호환 TOML 파서)

### 설정 항목

```toml
# 브라우저 열기 방식: "auto" | "browser" | "cmux"
opener = "auto"

[cmux]
# cmux에서 열기 모드: "tab" | "split"
openMode = "tab"
# cmux split 방향 (openMode = "split"일 때만 적용): "right" | "down"
splitDirection = "right"
```

### 설정 우선순위 (높은 것이 우선)

1. CLI 플래그 (`--opener=cmux`)
2. 설정 파일 (`~/.jjgui/config.toml`)
3. 환경변수 자동감지 (`opener = "auto"`일 때 `CMUX_SURFACE_ID` 확인)
4. 기본값 (`opener = "auto"`, `cmux.openMode = "tab"`, `cmux.splitDirection = "right"`)

### CLI 수정

- `bin/jjgui.ts`에 `--opener=<value>` 플래그 파싱 추가
- 기존 `process.argv` 직접 접근 방식 유지 (별도 파서 라이브러리 불필요)
- 사용법: `jjgui [--opener=browser|cmux|auto] [path]`, `jjgui stop`

### cmux 연동 로직

- `CMUX_SURFACE_ID` 환경변수로 cmux 내부 실행 여부 판단
- cmux 내장 브라우저 열기:
  - `openMode = "tab"`: `cmux browser surface:<CMUX_SURFACE_ID> tab new <url>`
  - `openMode = "split"`: cmux split 명령으로 브라우저 패널 생성 (구체적 명령은 cmux API 확정 후 결정)
- cmux CLI가 없거나 실행 실패 시 에러 메시지 출력 후 시스템 브라우저로 폴백

### 모듈 구조

- **config.ts** (신규): 설정 로드 모듈
  - `loadConfig()`: `~/.jjgui/config.toml` 읽기 + TOML 파싱 + 기본값 병합
  - `resolveOpener(cliFlag?, config)`: CLI 플래그, 설정 파일, 환경변수를 종합하여 최종 opener 결정
  - 타입: `JjguiConfig { opener, cmux: { openMode, splitDirection } }`
- **opener.ts** (신규): 브라우저 열기 모듈
  - `openBrowser(url)`: macOS `open` 명령으로 시스템 브라우저 열기 (기존 로직 추출)
  - `openCmux(url, config)`: cmux CLI로 내장 브라우저 열기
  - `open(url, opener, config)`: resolver 결과에 따라 분기
- **bin/jjgui.ts** 수정
  - `--opener` 플래그 파싱
  - config 로드 → opener resolve → open 호출

### 에러 처리

- 설정 파일 TOML 파싱 실패: stderr에 에러 메시지 출력, 기본값으로 폴백
- cmux CLI 없음: "cmux command not found. Falling back to system browser." 출력 후 시스템 브라우저로 폴백
- cmux 명령 실행 실패: stderr 메시지 출력 후 시스템 브라우저로 폴백
- 잘못된 opener 값: "Invalid opener value: <value>. Use 'auto', 'browser', or 'cmux'." 출력 후 종료

## Testing Decisions

- 현재 프로젝트에 테스트 프레임워크가 없으므로 이번 PRD에서는 테스트를 scope 밖으로 둔다.
- 추후 테스트 프레임워크 도입 시:
  - 좋은 테스트란 구현 세부사항이 아닌 외부 동작만 검증하는 것
  - `config.ts`의 `loadConfig()`와 `resolveOpener()`가 우선 테스트 대상
  - 다양한 설정 조합(CLI 플래그 + 설정 파일 + 환경변수)에 대한 우선순위 검증

## Out of Scope

- 프로젝트별 설정 파일 (`.jjgui.toml` in project root)
- 서버 포트 설정 (현재 7777 하드코딩 유지)
- PID/로그 파일 경로 설정
- cmux 소켓 API 직접 연동 (CLI 명령만 사용)
- Linux/Windows 지원 (현재 macOS `open` 명령 기반)
- 테스트 프레임워크 세팅 및 테스트 작성

## Further Notes

- `opener = "auto"`를 기본값으로 하여, cmux 사용자는 설정 파일 없이도 자동으로 내장 브라우저가 열리게 한다. 기존 사용자는 동작 변화 없음.
- cmux의 브라우저 관련 CLI API가 아직 발전 중이므로, opener.ts 모듈을 별도로 분리하여 cmux API 변경에 유연하게 대응한다.
- TOML 파서 의존성이 추가되므로, Bun 호환성을 확인해야 한다.
- 향후 프로젝트별 설정 파일을 추가할 때는 글로벌 설정 위에 오버라이드하는 방식으로 확장 가능하다.
