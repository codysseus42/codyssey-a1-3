import os
import sys

_API_DIR = os.path.dirname(__file__)
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)

from http.server import BaseHTTPRequestHandler
import json
import time

from dotenv import load_dotenv

from cities import CITIES
import tour
import gemini

load_dotenv(
    os.path.join(os.path.dirname(__file__), "..", ".env"),
    override=False,
)

TIME_BUDGET = 45.0
MAX_WISH_LEN = 500
ENV_KEYS = ("GEMINI_API_KEY", "TEXT_MODEL", "TEXT_MODEL_FALLBACK", "TOUR_API_KEY")

MSG_TOUR_FAILED = "관광 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
MSG_AI_FAILED = "여행 계획을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        start = time.monotonic()
        body, message = self._read_json_body()
        if message is not None:
            self._respond(400, _fail("bad_request", message))
            return

        city_key, wish, message = _validate_request(body)
        if message is not None:
            self._respond(400, _fail("bad_request", message))
            return

        try:
            status_code, payload = self._process(start, city_key, wish)
        except Exception as exc:
            print(f"[plan] unexpected_error type={type(exc).__name__}")
            status_code, payload = 200, _fail("ai_failed", MSG_AI_FAILED)

        self._respond(status_code, payload)

    def _process(self, start, city_key, wish):
        env = _load_env()
        if env is None:
            print("[plan] ai_failed cause=env_missing")
            return 200, _fail("ai_failed", MSG_AI_FAILED)

        deadline = start + TIME_BUDGET
        city_name = CITIES[city_key]["name"]

        places, error = tour.get_places(city_key, env["TOUR_API_KEY"], deadline)
        if error is not None:
            print(f"[plan] tour_api_failed cause={error}")
            return 200, _fail("tour_api_failed", MSG_TOUR_FAILED)

        result, error = gemini.get_ai_plan(
            city_name, wish, places,
            env["GEMINI_API_KEY"], env["TEXT_MODEL"], env["TEXT_MODEL_FALLBACK"],
            deadline,
        )
        if error is not None:
            print(f"[plan] ai_failed cause={error}")
            return 200, _fail("ai_failed", MSG_AI_FAILED)

        if result["status"] == "E":
            return 200, _fail("invalid_wish", result["content"])

        return 200, _build_success(city_name, result, places)

    def _read_json_body(self):
        """본문을 읽어 dict로 반환. 실패 시 (None, 한국어 메시지)."""
        try:
            length = int(self.headers.get("Content-Length", ""))
        except (TypeError, ValueError):
            return None, "요청 본문 길이를 확인할 수 없습니다."
        if length <= 0:
            return None, "요청 본문이 비어 있습니다."
        try:
            raw = self.rfile.read(length)
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "요청 본문을 해석할 수 없습니다."
        if not isinstance(body, dict):
            return None, "요청 형식이 올바르지 않습니다."
        return body, None

    def _respond(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)


def _validate_request(body):
    """(city_key, wish, 오류메시지) 반환. 성공 시 오류메시지는 None."""
    city_key = body.get("city")
    if not isinstance(city_key, str) or city_key not in CITIES:
        return None, None, "city 값이 올바르지 않습니다."

    wish = body.get("wish")
    if not isinstance(wish, str) or not (1 <= len(wish) <= MAX_WISH_LEN):
        return None, None, "wish는 1자 이상 500자 이하로 입력해 주세요."

    return city_key, wish, None


def _load_env():
    env = {key: os.environ.get(key, "") for key in ENV_KEYS}
    if any(not value for value in env.values()):
        return None
    return env


def _fail(reason, message):
    return {"ok": False, "reason": reason, "message": message}


def _build_success(city_name, result, places):
    places_by_n = {p["n"]: p for p in places}
    out_places = []
    for order, pick in enumerate(result["picks"], start=1):
        place = places_by_n[pick["n"]]
        out_places.append({
            "contentid": place["contentid"],
            "title": place["title"],
            "addr": place["addr"],
            "category": place["category"],
            "kind": place["kind"],
            "mapx": place["mapx"],
            "mapy": place["mapy"],
            "image": place["image"],
            "reason": pick["reason"],
            "order": order,
        })
    return {
        "ok": True,
        "city": city_name,
        "summary": result["content"],
        "places": out_places,
    }
