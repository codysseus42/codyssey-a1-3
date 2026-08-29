import json
import os
import time
import requests

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
CALL_TIMEOUT = 20.0

TRANSIENT_STATUS = {
    429: "RESOURCE_EXHAUSTED",
    500: "INTERNAL",
    503: "UNAVAILABLE",
}

ERR_BUDGET = "budget_exceeded"
ERR_NETWORK = "network_error"
ERR_AUTH = "auth_error"
ERR_REQUEST_INVALID = "request_invalid"
ERR_MODEL_NOT_FOUND = "model_not_found"
ERR_OVERLOADED = "overloaded"
ERR_HTTP_STATUS = "http_status"
ERR_FORMAT = "format_error"

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "select_places.txt")
with open(_PROMPT_PATH, encoding="utf-8") as _f:
    _PROMPT_TEMPLATE = _f.read()


def get_ai_plan(city_name, wish, places, api_key, model, fallback_model, deadline):
    """AI를 호출해 후보 장소 중 일부를 선정한다.
    반환값: (result, error). 성공 시 (dict, None). 실패 시 (None, error_code)."""
    prompt = _build_prompt(city_name, wish, places)
    valid_ns = {p["n"] for p in places}

    result, error, transient = _call_model(prompt, api_key, model, valid_ns, deadline)
    if result is not None:
        return result, None
    if not transient:
        return None, error

    result, error, _ = _call_model(prompt, api_key, fallback_model, valid_ns, deadline)
    if result is not None:
        return result, None
    return None, error


def _build_prompt(city_name, wish, places):
    candidates = "\n".join(
        f"{p['n']}. {p['title']} | {p['kind']} | {p['category']} | {p['addr']} | {p['mapx']},{p['mapy']}"
        for p in places
    )
    prompt = _PROMPT_TEMPLATE.replace("{{도시명}}", city_name)
    prompt = prompt.replace("{{희망사항}}", wish)
    prompt = prompt.replace("{{후보목록}}", candidates)
    return prompt


def _call_model(prompt, api_key, model, valid_ns, deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        return None, ERR_BUDGET, False
    timeout = min(CALL_TIMEOUT, remaining)

    url = f"{BASE_URL}/{model}:generateContent"
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    try:
        resp = requests.post(url, headers=headers, json=body, timeout=timeout)
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        return None, ERR_NETWORK, True
    except requests.exceptions.RequestException:
        return None, ERR_NETWORK, False

    if resp.status_code == 200:
        result, error = _parse_response(resp, valid_ns)
        return result, error, False

    if resp.status_code in (401, 403):
        return None, ERR_AUTH, False
    if resp.status_code == 400:
        return None, ERR_REQUEST_INVALID, False
    if resp.status_code == 404:
        return None, ERR_MODEL_NOT_FOUND, False

    expected_status = TRANSIENT_STATUS.get(resp.status_code)
    if expected_status is not None:
        try:
            body_json = resp.json()
        except ValueError:
            body_json = {}
        error_status = (
            body_json.get("error", {}).get("status")
            if isinstance(body_json, dict) else None
        )
        if error_status == expected_status:
            return None, ERR_OVERLOADED, True

    return None, ERR_HTTP_STATUS, False


def _parse_response(resp, valid_ns):
    try:
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (ValueError, KeyError, TypeError, IndexError):
        return None, ERR_FORMAT

    try:
        parsed = json.loads(text.strip())
    except ValueError:
        return None, ERR_FORMAT

    if not isinstance(parsed, dict) or parsed.get("status") not in ("S", "E"):
        return None, ERR_FORMAT

    content = parsed.get("content")
    if not isinstance(content, str) or content == "":
        return None, ERR_FORMAT

    if parsed["status"] == "E":
        return {"status": "E", "content": content[:100]}, None

    picks = parsed.get("picks")
    if not isinstance(picks, list) or len(picks) == 0:
        return None, ERR_FORMAT

    valid_picks = []
    for pick in picks:
        if not isinstance(pick, dict):
            continue
        n = pick.get("n")
        reason = pick.get("reason")
        if n not in valid_ns or not isinstance(reason, str):
            continue
        valid_picks.append({"n": n, "reason": reason[:60]})

    if len(valid_picks) < 3:
        return None, ERR_FORMAT

    return {"status": "S", "content": content[:300], "picks": valid_picks}, None
