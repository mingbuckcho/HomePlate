import random
import time
import requests
from .config import DEFAULT_UA, DEFAULT_MIN_DELAY, DEFAULT_MAX_DELAY, DEFAULT_TIMEOUT


def polite_sleep(min_sec: float = None, max_sec: float = None):
    """
    다음 요청 전에 랜덤하게 기다린다.

    고정 간격으로 요청하면 크롤러로 탐지될 수 있다.
    예: 정확히 2초마다 요청 → 봇으로 인식될 가능성 높음
    랜덤하게 기다리면 사람처럼 보인다.

    min_sec/max_sec가 None이면 config의 기본값을 사용한다.
    크롤러에서 소스별 딜레이를 넘겨주면 그 값을 사용한다.
    """
    lo = DEFAULT_MIN_DELAY if min_sec is None else float(min_sec)
    hi = DEFAULT_MAX_DELAY if max_sec is None else float(max_sec)
    sleep_time = random.uniform(lo, hi)
    time.sleep(sleep_time)


def build_session(ua: str = None) -> requests.Session:
    """
    HTTP 요청에 사용할 세션 객체를 만든다.

    Session을 사용하는 이유:
        Session을 재사용하면 TCP 연결을 유지(keep-alive)해서
        매 요청마다 새로운 TCP handshake를 하지 않아도 된다.
        같은 도메인에 여러 번 요청할 때 더 빠르고 효율적이다.

    ua: User-Agent 문자열 (None이면 config의 기본값 사용)
    """
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


def fetch_html(
    session: requests.Session, url: str, retries: int = 2, timeout: int = None
) -> str:
    """
    주어진 URL에서 HTML을 가져온다.

    Args:
        session:  build_session()으로 만든 세션 객체
        url:      가져올 페이지 URL
        retries:  실패 시 재시도 횟수 (기본 2회 → 최대 3번 시도)
        timeout:  요청 제한 시간 (초), None이면 config 기본값

    Raises:
        RuntimeError: 모든 재시도 실패 시 발생

    재시도 로직:
        네트워크는 일시적으로 불안정할 수 있다.
        한 번 실패했다고 바로 에러를 내지 않고
        잠깐 기다렸다가 다시 시도한다.
    """
    t = DEFAULT_TIMEOUT if timeout is None else int(timeout)
    last_err = None

    for attempt in range(retries + 1):
        try:
            resp = session.get(url, timeout=t)
            resp.raise_for_status()
            # 인코딩을 자동으로 감지한다
            # apparent_encoding: 응답 본문을 분석해서 인코딩을 추측한다
            # 잘못된 인코딩으로 한글이 깨지는 문제를 방지한다
            resp.encoding = resp.apparent_encoding or "utf-8"
            return resp.text

        except Exception as e:
            last_err = e
            if attempt < retries:
                print(f"[http_fetch] 재시도 {attempt + 1}/{retries}: {url} / {e}")
                polite_sleep()

    raise RuntimeError(
        f"HTML 가져오기 실패 (시도 {retries + 1}회): url={url} / {last_err}"
    )


def fetch_json(
    session: requests.Session,
    url: str,
    params: dict = None,
    retries: int = 2,
    timeout: int = None,
) -> dict:
    """
    주어진 URL에서 JSON 응답을 가져온다.

    Args:
        params: URL 쿼리 파라미터 (예: {"page": 1, "pageSize": 40})
                requests가 자동으로 URL에 붙여준다
                예: url?page=1&pageSize=40

    Raises:
        RuntimeError: 모든 재시도 실패 시 발생
    """
    t = DEFAULT_TIMEOUT if timeout is None else int(timeout)
    last_err = None

    for attempt in range(retries + 1):
        try:
            resp = session.get(url, params=params, timeout=t)
            resp.raise_for_status()
            return resp.json()

        except Exception as e:
            last_err = e
            if attempt < retries:
                print(f"[http_fetch] 재시도 {attempt + 1}/{retries}: {url} / {e}")
                polite_sleep()

    raise RuntimeError(
        f"JSON 가져오기 실패 (시도 {retries + 1}회): url={url} / {last_err}"
    )
