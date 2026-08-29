import time
import requests

from cities import CITIES, LCLS

BASE_URL = "http://apis.data.go.kr/B551011/KorService2/areaBasedList2"
CALL_TIMEOUT = 8.0
MAX_ATTEMPTS = 2

CONTENT_TYPE_ATTRACTION = "12"
CONTENT_TYPE_RESTAURANT = "39"
NUM_ROWS_ATTRACTION = 50
NUM_ROWS_RESTAURANT = 30
KIND_ATTRACTION = "관광지"
KIND_RESTAURANT = "음식점"

ERR_BUDGET = "budget_exceeded"
ERR_NETWORK = "network_error"
ERR_HTTP_STATUS = "http_status"
ERR_PARSE = "parse_error"
ERR_RESULT_CODE = "result_code"
ERR_EMPTY = "empty_result"
ERR_ITEMS = "items_missing"


def get_places(city_key, api_key, deadline):
    """관광지·음식점을 조회해 정규화된 리스트로 반환한다.
    반환값: (places, error). 성공 시 (list[dict], None).
    관광지 조회가 실패하면 (None, error_code)."""
    city = CITIES[city_key]

    attractions, error = _request_items(
        api_key, CONTENT_TYPE_ATTRACTION, NUM_ROWS_ATTRACTION, city, deadline
    )
    if error is not None:
        return None, error

    restaurants, _ = _request_items(
        api_key, CONTENT_TYPE_RESTAURANT, NUM_ROWS_RESTAURANT, city, deadline
    )

    places = [
        {"n": i, **_normalize(raw, KIND_ATTRACTION, city)}
        for i, raw in enumerate(attractions, start=1)
    ]
    if restaurants:
        offset = len(places)
        places += [
            {"n": offset + i, **_normalize(raw, KIND_RESTAURANT, city)}
            for i, raw in enumerate(restaurants, start=1)
        ]
    return places, None


def _request_items(api_key, content_type_id, num_of_rows, city, deadline):
    params = {
        "serviceKey": api_key,
        "MobileOS": "WEB",
        "MobileApp": "TripPlanner",
        "_type": "json",
        "arrange": "Q",
        "pageNo": 1,
        "numOfRows": num_of_rows,
        "contentTypeId": content_type_id,
        "lDongRegnCd": city["lDongRegnCd"],
        "lDongSignguCd": city["lDongSignguCd"],
    }
    for _ in range(MAX_ATTEMPTS):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None, ERR_BUDGET
        timeout = min(CALL_TIMEOUT, remaining)
        try:
            resp = requests.get(BASE_URL, params=params, timeout=timeout)
            print(resp.json())
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            continue
        except requests.exceptions.RequestException:
            return None, ERR_NETWORK

        if 500 <= resp.status_code < 600:
            continue
        if resp.status_code != 200:
            return None, ERR_HTTP_STATUS

        try:
            data = resp.json()
        except ValueError:
            return None, ERR_PARSE

        try:
            header = data["response"]["header"]
            body = data["response"]["body"]
        except (KeyError, TypeError):
            return None, ERR_PARSE

        if header.get("resultCode") != "0000":
            return None, ERR_RESULT_CODE

        try:
            total_count = int(body.get("totalCount", 0))
        except (TypeError, ValueError):
            return None, ERR_EMPTY
        if total_count <= 0:
            return None, ERR_EMPTY

        try:
            items = body["items"]["item"]
        except (KeyError, TypeError):
            return None, ERR_ITEMS
        if items is None:
            return None, ERR_ITEMS
        if not isinstance(items, list):
            items = [items]
        return items, None

    return None, ERR_NETWORK


def _normalize(raw, kind, city):
    contentid = raw.get("contentid")
    return {
        "contentid": str(contentid) if contentid is not None else "",
        "title": raw.get("title") or "",
        "addr": _clean_addr(raw.get("addr1") or "", city["addr_prefix"]),
        "category": LCLS.get(raw.get("lclsSystm1") or "", "기타"),
        "mapx": _clip3(raw.get("mapx")),
        "mapy": _clip3(raw.get("mapy")),
        "image": raw.get("firstimage") or "",
        "kind": kind,
    }


def _clean_addr(addr1, prefix):
    addr1 = addr1.strip()
    if prefix and addr1.startswith(prefix):
        addr1 = addr1[len(prefix):]
    return addr1.strip()


def _clip3(value):
    if value in (None, ""):
        return ""
    s = str(value)
    if "." not in s:
        return s
    whole, frac = s.split(".", 1)
    return f"{whole}.{frac[:3]}" if frac[:3] else whole
