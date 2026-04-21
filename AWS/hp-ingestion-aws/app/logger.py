import json
import sys
from datetime import datetime, timezone


def _emit(level: str, message: str, **kwargs) -> None:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
        **kwargs,
    }
    print(json.dumps(record, ensure_ascii=False), file=sys.stdout, flush=True)


def info(message: str, **kwargs) -> None:
    _emit("INFO", message, **kwargs)


def warn(message: str, **kwargs) -> None:
    _emit("WARN", message, **kwargs)


def error(message: str, **kwargs) -> None:
    _emit("ERROR", message, **kwargs)
