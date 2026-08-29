# AI 코딩 작업 로그

## 2026-08-29

### 0. 빈 배포 확인
- Application Preset을 Python으로 지정 → "No python entrypoint found" 오류
- Python 프리셋은 단일 진입점 앱(FastAPI 등)용.
  정적 파일 + api/ 서버리스 함수 구조는 Other 프리셋을 써야 함
- Other로 변경 후 배포 성공. /.env 404 확인
- Function Max Duration 30초 확인 → 시간 예산 45초를 위해 300으로 상향

### 1. `service/api/cities.py` 작성

- `ARCHITECTURE.md` 3절(도시 표)과 4-3절(LCLS 매핑)만 담아 작성.
- `CITIES` 딕셔너리(키별 `name`, `lDongRegnCd`, `lDongSignguCd`, `addr_prefix`)와
  `LCLS` 딕셔너리(카테고리 코드 → 한글 라벨)만 포함, 검증 로직이나 핸들러는
  넣지 않음.
- `yeosu`의 주소 접두어는 표에 적힌 "전남광주특별시 여수시"를 원문 그대로
  옮김(표기 오류로 보이나 스펙 원문을 그대로 반영).

### 2. `service/api/tour.py` 계획 수립 (Plan mode)

`ARCHITECTURE.md` 4절(관광 정보 API 요청/응답 검증/정규화) 기반으로 계획 모드에서
설계를 진행함. **이 세션에서는 파일이 아직 작성되지 않았고, 계획 단계에서 중단됨.**

**조사한 내용**
- `service/requirements.txt`: `python-dotenv`만 있고 `requests` 없음(버전 고정 없음).
- `service/.env.example`: `TOUR_API_KEY`, `TOUR_BASE_URL` 등 존재. 단
  `ARCHITECTURE.md` 9절은 4개 환경변수만 정의하고 "엔드포인트 주소는 소스의
  상수로 둔다"고 명시 → `TOUR_BASE_URL`은 쓰지 않기로 결정.
- `service/api/hello.py`만 기존 진입점 예시로 존재, `plan.py`/`gemini.py`는
  아직 없음. `api/` 디렉토리에 `__init__.py` 없음 → 형제 모듈 간 flat import
  (`from cities import CITIES, LCLS`) 채택.

**설계 결정**
- 시간 예산은 절대 `time.monotonic()` 마감 시각(`deadline`)을 `plan.py` →
  `tour.py`로 그대로 전달하는 방식 채택(초 단위 budget 값 대신).
- 매 HTTP 시도(최초 + 재시도 1회)마다 `timeout = min(8, deadline - now)`를
  다시 계산.
- 재시도 대상은 연결 실패·타임아웃·5xx만(스펙 4-2절 명시), 그 외 실패는 즉시
  중단하고 재시도하지 않음.
- `mapx`/`mapy` 소수점 셋째 자리 절단은 부동소수점 오차를 피하기 위해 문자열
  슬라이싱으로 처리.
- `requests` 신규 의존성 추가에 따라 `requirements.txt`에 버전 고정(`requests==2.32.3`)
  하여 함께 갱신하기로 함(신규 기능 파일이 아닌 매니페스트 갱신이라 "한 파일씩"
  규칙의 예외로 판단).

**사용자 반려 및 수정 요구 이력**

| 차수 | 사용자 요청 내용 | 반영 결과 |
|---|---|---|
| 1차 | "지금 상관 없겠지만 architecture.md의 saved.html 화면과 관련된 내용들을 list.html로 변경했다" — 계획 승인 전 참고 정보 통보 | `architecture.md` 재확인, 이미 `list.html`로 반영되어 있음을 확인. `tour.py`와는 무관해 계획 변경 없음. |
| 2차 | 부분 승인 + 3가지 반영 요구: ① JSON 파싱 실패와 `resultCode` 불일치를 서로 다른 반환값으로 구분(호출부가 원인 구별 가능해야 함) ② 작성 후 `.env` 로드해 `gyeongju`로 실제 API 호출 테스트하고 결과 건수·첫 3개 항목을 보여줄 것 ③ `architecture.md`의 오류 세분화 관련 변경분을 참고할 것 | `architecture.md` 재조회 결과 4-2절에 "해당 오류로 중단시 세부 내역은 공개하지 않고 `tour_api_failed`로 처리" 문구가 추가된 것을 확인(외부 계약은 그대로 `tour_api_failed` 하나, 세분화는 내부 전용). 계획을 `(places, error)` 튜플 반환 구조로 재설계하고 `ERR_BUDGET` / `ERR_NETWORK` / `ERR_HTTP_STATUS` / `ERR_PARSE` / `ERR_RESULT_CODE` / `ERR_EMPTY` / `ERR_ITEMS` 오류 코드를 추가. 계획에 실호출 테스트 절차(스크래치패드에서 임시 스크립트로 실행 후 삭제, 저장소에 남기지 않음) 추가. |
| 3차 | "승인 실호출 테스트 결과를 보여" — 계획 자체는 승인하되, 실제 호출 테스트 결과를 확인하기 전까지는 완료로 보지 않겠다는 의사 | 계획 승인은 확보되었으나, 이 로그 작성 요청으로 세션이 전환되어 **실호출 테스트는 아직 수행되지 않음**. |

**현재 상태 (계획 단계 기준, 아래 3번 항목에서 완료됨)**
- `service/api/tour.py`: 미작성.
- `service/requirements.txt`: 미수정(`requests` 미추가).
- 계획 파일: `~/.claude/plans/architecture-md-4-api-tour-py-cozy-piglet.md`
  (오류 코드 세분화, 실호출 테스트 절차까지 반영된 최신 버전).
- 다음 단계: 계획대로 `tour.py` 작성 → `requirements.txt`에 `requests` 버전
  고정 추가 → `.env` 로드 후 `gyeongju`로 실제 호출 테스트, 결과 건수와
  앞 3개 항목 확인.

### 3. `service/api/tour.py` 구현 완료 + 실호출 테스트

이전 항목(2번)에서 승인된 계획대로 `tour.py`를 작성하고 `requirements.txt`를
갱신함.

- `requirements.txt`에 `requests==2.32.3` 추가(이후 사용자가 직접
  `requests==2.34.2`로 재확정).
- `get_places(city_key, api_key, deadline)` 구현: 관광지(50건)→음식점(30건)
  순차 호출, 연속 번호(`n`) 정규화, `ERR_BUDGET`/`ERR_NETWORK`/
  `ERR_HTTP_STATUS`/`ERR_PARSE`/`ERR_RESULT_CODE`/`ERR_EMPTY`/`ERR_ITEMS`
  오류 코드 세분화 반영.
- **실호출 테스트 결과**(`gyeongju`, `.env`의 `TOUR_API_KEY` 사용): 총 80건
  (관광지 50 + 음식점 30). 앞 3개 항목 예:
  1. 경주 풍력발전(바람의언덕) · 체험 · 문무대왕면 불국로 1056-185 · (129.364, 35.749)
  2. 경주 양동마을 [유네스코 세계유산] · 역사 · 강동면 양동마을길 93 · (129.253, 35.996)
  3. 경주 문무대왕릉 · 역사 · 문무대왕면 봉길리 · (129.486, 35.738)
- 테스트 스크립트는 스크래치패드에서 실행 후 삭제(저장소에 남기지 않음).
- 커밋하지 않음.

### 4. `service/api/gemini.py` 작성 (Plan mode → 승인 → 구현)

`ARCHITECTURE.md` 5절(AI 호출)이 갱신되어(모델 호출 실패 분류표, `content`/
`summary` 필드, 9단계 검증으로 확장) 이를 기준으로 계획을 새로 세우고 승인받아
구현함.

**조사한 내용**
- `service/api/prompts/select_places.txt`: `{{도시명}}`, `{{희망사항}}`,
  `{{후보목록}}` 플레이스홀더 확인, few-shot 예시 3개 포함.
- `service/.env`: `TEXT_MODEL=gemini-3.6-flash`,
  `TEXT_MODEL_FALLBACK=gemini-3.5-flash` 확인(키 값은 조회하지 않음).
  `GEMINI_BASE_URL` 없음 → 엔드포인트를 소스 상수로 하드코딩.
- `requirements.txt`에 Gemini 전용 SDK 없음 → `tour.py`와 동일하게 `requests`로
  REST 직접 호출(신규 패키지 불필요).

**설계 결정**
- `get_ai_plan(city_name, wish, places, api_key, model, fallback_model,
  deadline)` → `(result, error)` 튜플 반환. `tour.py`와 동일한 패턴으로
  `ERR_BUDGET`/`ERR_NETWORK`/`ERR_AUTH`/`ERR_REQUEST_INVALID`/
  `ERR_MODEL_NOT_FOUND`/`ERR_OVERLOADED`/`ERR_HTTP_STATUS`/`ERR_FORMAT`
  내부 오류 코드 세분화(외부에는 `ai_failed` 하나로만 노출).
- 대체 모델은 "일시적 장애"(429/500/503 상태 코드 **+** 응답 본문의
  `error.status` 문자열이 모두 일치할 때, 또는 연결 실패·타임아웃)로 분류된
  경우에만 정확히 한 번 시도. 401/403/400/404/형식 검증 실패는 즉시
  `ai_failed`(대체 모델 시도 안 함).
- 429/500/503 판정을 상태 코드 단독이 아니라 상태 코드+`error.status` 둘 다
  일치할 때만 인정하는 **엄격한 해석**을 사용자에게 확인받고 그대로 채택.
- Gemini 키는 URL 쿼리 파라미터가 아니라 `x-goog-api-key` 헤더로 전달(요청
  URL 로그 유출 방지).
- 프롬프트 플레이스홀더 치환은 `str.replace()` 사용(`str.format()`은 프롬프트
  안의 JSON 예시 중괄호와 충돌하므로 배제).

**실호출 테스트 결과**(경주, "부모님과 조용히 쉬면서 유적도 보고 싶어요",
`tour.get_places` 결과 80건을 그대로 입력):
- `status: "S"`
- `content`: "부모님과 걷기 편한 평지 유적과 고즈넉한 한옥 쉼터를 모아 이동
  동선을 최소화했습니다. 경주 중심가에서 조용히 유적을 보며 쉬어가실 수
  있습니다."
- `picks` 4건: 경주 대릉원 일원, 경주 계림, 월정교, 1894사랑채 (각각 선정
  이유 포함).

테스트 스크립트는 스크래치패드에서 실행 후 삭제. `requirements.txt` 변경
없음(`requests`로 충분). 커밋하지 않음.

**이후 규칙**: 매 작업(파일 단위) 종료 시 이 로그에 자동으로 항목을
추가한다(사용자 지시, 2026-08-29).

### 5. `service/api/plan.py` 작성 (진입점, Plan mode → 승인 → 구현)

`ARCHITECTURE.md` 6절(API 계약)·7절(시간 예산)·9절(환경 변수)에 따라
`tour.py`/`gemini.py`를 순서대로 호출해 응답을 조립하는 진입점을 작성함.
사용자 지시: "tour.py와 gemini.py가 반환한 내부 오류 코드를 print로 서버
로그에 남긴다. 사용자 응답의 message에는 절대 넣지 않는다."

**설계 결정**
- 처리 순서: 요청 바디 파싱/검증(`bad_request`/400) → env 4종 존재 확인
  (하나라도 없으면 `ai_failed`/200, **`TOUR_API_KEY` 누락도 `tour_api_failed`가
  아니라 `ai_failed`** — 9절이 4개 변수를 구분하지 않고 일괄 처리하도록 명시)
  → `deadline = start + 45.0` → `tour.get_places` → `gemini.get_ai_plan` →
  `status:"E"`면 `invalid_wish`, `status:"S"`면 5-5절 원본 복원.
- `tour.py`/`gemini.py`의 내부 오류 코드는 `print(f"[plan] tour_api_failed
  cause={error}")` 식으로만 로그에 남기고 사용자 응답 `message`에는 절대
  포함하지 않음(고정 문구만 사용).
- 요청 파싱 단계(Content-Length, JSON 디코딩, dict 여부, city/wish 타입)는
  반드시 `bad_request`로만 귀결되도록 별도 처리하고, 그 이후 단계만 최상위
  `try/except Exception` 안전망으로 감싸 처리되지 않은 예외가 raw
  traceback으로 새는 것을 막음(로그에는 `type(exc).__name__`만 남기고
  `str(exc)`는 남기지 않음 — CLAUDE.md의 "로그에 스택 트레이스를 남기지
  않는다"가 서버 로그에도 적용된다고 해석).
- `load_dotenv()`는 모듈 최상단에서 1회만 호출(Vercel 콜드 스타트 기준).

**실호출 테스트 결과**(로컬 `HTTPServer`로 `plan.handler`를 실제로 띄워
`requests.post`로 호출):
- 정상 케이스(`gyeongju`, "부모님과 조용히 쉬면서 유적도 보고 싶어요"):
  HTTP 200, `ok: true`, `city: "경주"`, `summary`와 `places` 5건(대릉원 일원,
  계림, 교촌마을, 월정교, 1894사랑채) 정상 반환.
- `bad_request` 케이스(`city: "seoul"`): HTTP 400,
  `{"ok": false, "reason": "bad_request", "message": "city 값이 올바르지
  않습니다."}` 정상 반환.

테스트 스크립트는 스크래치패드에서 실행 후 삭제. 커밋하지 않음.

이로써 `architecture.md` 스펙의 백엔드 4개 파일(`cities.py`, `tour.py`,
`gemini.py`, `plan.py`)이 모두 작성됨. 프론트엔드(`index.html`, `plan.html`,
`list.html`, `css/`, `js/`)는 아직 미작성.

### 6. `service/index.html` + `service/css/style.css` 작성 (Plan mode → 승인 → 구현)

세 화면 중 소개 화면과, 세 화면이 공유할 공통 스타일시트를 작성함.
`service_plan.md`(기획서)의 문제 정의·대상 사용자·화면 구성·사용 방법을
반영. `plan.html`/`list.html`은 아직 없으므로 그 화면 전용 스타일(폼,
목록 카드 등)은 넣지 않고 색상 변수·네비게이션·버튼 상태 등 공통 기반만
작성.

- `style.css`: 8-6절 그대로 `--bg`/`--fg` 라이트·다크 기본값 정의 + 버튼/
  링크/카드용 추가 변수(`--accent`, `--border`, `--muted-fg` 등)를 같은
  패턴으로 확장. 색상 리터럴이 `:root`/`@media` 블록 밖에 없는지
  `grep -nE '#[0-9a-fA-F]{3,6}'`로 확인함(전부 변수 선언부에만 존재).
  링크·버튼에 hover/focus-visible/active 세 상태 모두 정의.
  `720px` 기준으로 사이드 네비게이션이 2컬럼(데스크톱/태블릿) ↔ 가로
  줄바꿈(모바일)으로 전환되는 반응형 레이아웃.
- `index.html`: 상단 네비게이션(가로)과 사이드 네비게이션(세로) 양쪽에
  소개/계획 만들기/내 여행 계획 세 링크(8-1절), 현재 페이지는
  `aria-current="page"`로 표시. 히어로 + 소개(문제/대상 사용자) + 화면
  구성(설계 재소개) + 사용 방법(6단계 + 하루 생성 횟수 제한 안내) 섹션.
  "시작하기"는 `<a href="plan.html">`로 JS 없이 이동(index 전용 JS 파일
  없음 — 2절 디렉토리 구조와 일치).
- `python3 -m html.parser`로 HTML 파싱 검증. 커밋하지 않음.
- 참고: 세션 시작 시점에 `service/index.html`과 `service/api/hello.py`가
  이미 작업 트리에서 삭제된 상태였음(직전 커밋엔 있었음, 내가 지운 게
  아님). 삭제 전 `index.html`은 실제 소개 콘텐츠가 아니라 배포 확인용
  임시 페이지(`<h1>배포 확인</h1>`, `/api/hello` 호출 버튼)였음 — 이번
  작업으로 실제 소개 콘텐츠로 대체되며 git 상태가 "삭제됨"에서
  "수정됨"으로 정상화됨.

### 7. `service/api/plan.py` — sys.path 자기 보강 (Plan mode → 승인 → 구현)

배포 환경(Vercel)에서 `plan.py`가 `cities`/`tour`/`gemini` 형제 모듈을
import하지 못할 위험을 막기 위해, 사용자 지시대로 다른 import보다 먼저
자기 디렉토리(`os.path.dirname(__file__)`)를 `sys.path`에 추가하되 이미
있으면 중복 추가하지 않도록 수정.

```python
import os
import sys

_API_DIR = os.path.dirname(__file__)
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)
```

기존에 3번째 줄에 있던 `import os`를 맨 위로 옮기고 `import sys`를 추가,
나머지 import(`http.server`, `json`, `time`, `dotenv`, `cities`, `tour`,
`gemini`)는 그 뒤로 유지.

**회귀 테스트**: 로컬 `HTTPServer`로 다시 구동해 `sys.path`에 `api` 디렉토리가
정확히 1번만 등장하는지(중복 방지 확인) + 정상 케이스(경주, 200, `places`
5건)와 `bad_request` 케이스(400) 모두 이전과 동일하게 통과함을 확인. 테스트
스크립트는 스크래치패드에서 실행 후 삭제. 커밋하지 않음.

### 8. 로그 점검(사용자 요청) — 누락분 보완

사용자가 "방금 대화를 포함해서 로그에 놓친 게 없는지" 확인을 요청해 4~7번
항목을 다시 검토하고 다음을 보완함:
- 6번 항목에 `index.html`/`hello.py`가 세션 시작 전부터 이미 삭제된 상태였다는
  맥락(배포 확인용 임시 페이지였음)을 추가.
- 아래에 파일별 현재 진행 상황을 정리해 추가.

**현재 진행 상황 (2026-08-29 기준)**
- 백엔드: `cities.py`, `tour.py`, `gemini.py`, `plan.py`(sys.path 보강 포함)
  모두 작성 완료, 각각 실호출/회귀 테스트 통과.
- 프론트엔드: `index.html` + `css/style.css` 작성 완료. `plan.html`,
  `list.html`, `js/storage.js`, `js/plan.js`, `js/list.js`는 아직 미작성.
  `images/` 디렉토리는 비어 있음.
- 참고: 4번(`gemini.py` 단독 테스트, "picks 4건")과 5번(`plan.py` 통합
  테스트, "places 5건")은 같은 도시·비슷한 희망사항으로 각각 별도로 실행한
  테스트라 AI 응답이 달라 선정 개수 차이(4개 vs 5개)가 남 — 둘 다 정상
  범위(스펙상 4~7개)이며 버그 아님.
- 커밋 이력 없음(모든 변경 사항은 작업 트리에만 존재, `CLAUDE.md` 규칙에
  따라 커밋하지 않음).
