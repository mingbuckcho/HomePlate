import random
import time
import requests
from .config import DEFAULT_UA, DEFAULT_MIN_DELAY, DEFAULT_MAX_DELAY, DEFAULT_TIMEOUT
from . import logger


class HttpFetchError(RuntimeError):
    """
    HTTP 요청 실패 예외.

    status_code를 별도 필드로 가지는 이유:
        단순 RuntimeError("503 error")로 던지면 상위에서 원인을 알 수 없다.
        status_code를 필드로 노출하면 worker/exporter에서 구조화 로그에
        http_status 필드를 추가할 수 있어 CloudWatch Insights에서
        에러 유형별 집계(429 rate limit, 503 site down 등)가 가능하다.
    """

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def polite_sleep(min_sec: float = None, max_sec: float = None):
    lo = DEFAULT_MIN_DELAY if min_sec is None else float(min_sec)
    hi = DEFAULT_MAX_DELAY if max_sec is None else float(max_sec)
    time.sleep(random.uniform(lo, hi))


def build_session(ua: str = None) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": ua or DEFAULT_UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
            "Connection": "keep-alive",
        }
    )
    return s


def _extract_status(exc: Exception) -> int | None:
    """requests.HTTPError에서 HTTP 상태 코드를 추출한다."""
    resp = getattr(exc, "response", None)
    return resp.status_code if resp is not None else None


def fetch_html(
    session: requests.Session, url: str, retries: int = 2, timeout: int = None
) -> str:
    t = DEFAULT_TIMEOUT if timeout is None else int(timeout)
    last_err = None
    last_status = None

    for attempt in range(retries + 1):
        try:
            resp = session.get(url, timeout=t)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text

        except Exception as e:
            last_err = e
            last_status = _extract_status(e)
            if attempt < retries:
                logger.warn(
                    "http_fetch_retry",
                    url=url,
                    attempt=attempt + 1,
                    retries=retries,
                    http_status=last_status,
                    error=str(e),
                )
                polite_sleep()

    raise HttpFetchError(
        f"HTML 가져오기 실패 (시도 {retries + 1}회): url={url} / {last_err}",
        status_code=last_status,
    )


def fetch_json(
    session: requests.Session,
    url: str,
    params: dict = None,
    retries: int = 2,
    timeout: int = None,
) -> dict:
    t = DEFAULT_TIMEOUT if timeout is None else int(timeout)
    last_err = None
    last_status = None

    for attempt in range(retries + 1):
        try:
            resp = session.get(url, params=params, timeout=t)
            resp.raise_for_status()
            return resp.json()

        except Exception as e:
            last_err = e
            last_status = _extract_status(e)
            if attempt < retries:
                logger.warn(
                    "http_fetch_retry",
                    url=url,
                    attempt=attempt + 1,
                    retries=retries,
                    http_status=last_status,
                    error=str(e),
                )
                polite_sleep()

    raise HttpFetchError(
        f"JSON 가져오기 실패 (시도 {retries + 1}회): url={url} / {last_err}",
        status_code=last_status,
    )
