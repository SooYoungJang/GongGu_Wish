"""Shared pacing for browser navigation and scrolls; no access-limit bypass."""

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import logging
import random
import time
from typing import Any, Callable


logger = logging.getLogger("instagram-public-worker")


def retry_after_seconds(value: str | None, now: datetime) -> float | None:
    if not value:
        return None
    value = value.strip()
    if value.isascii() and value.isdigit():
        return float(value)
    try:
        retry_at = parsedate_to_datetime(value)
        if retry_at.tzinfo is None:
            retry_at = retry_at.replace(tzinfo=timezone.utc)
        return max(0, (retry_at - now).total_seconds())
    except (TypeError, ValueError, OverflowError):
        return None


class RequestPacer:
    def __init__(
        self,
        *,
        min_interval_seconds: float = 10,
        max_interval_seconds: float = 20,
        break_every: int = 12,
        min_break_seconds: float = 60,
        max_break_seconds: float = 120,
        monotonic: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        rng: random.Random | Any = random,
    ) -> None:
        self.min_interval_seconds = max(0, min_interval_seconds)
        self.max_interval_seconds = max(self.min_interval_seconds, max_interval_seconds)
        self.break_every = max(1, break_every)
        self.min_break_seconds = max(0, min_break_seconds)
        self.max_break_seconds = max(self.min_break_seconds, max_break_seconds)
        self.monotonic = monotonic
        self.sleep = sleep
        self.rng = rng
        self.deadline: float | None = None
        self._next_allowed_at = 0.0
        self._reserved_delay = 0.0
        self._actions = 0

    def wait(self, should_continue: Callable[[], bool] = lambda: True) -> bool:
        while True:
            now = self.monotonic()
            if (self.deadline is not None and now >= self.deadline) or not should_continue():
                return False
            remaining = self._next_allowed_at - now
            if remaining <= 0:
                break
            if self.deadline is not None:
                remaining = min(remaining, self.deadline - now)
            self.sleep(min(1, remaining))

        self._actions += 1
        self._reserved_delay = self.rng.uniform(
            self.min_interval_seconds, self.max_interval_seconds,
        )
        if self._actions % self.break_every == 0:
            pause = self.rng.uniform(self.min_break_seconds, self.max_break_seconds)
            self._reserved_delay += pause
            logger.info("Instagram 요청 %d회 후 %.1f초 휴식", self._actions, pause)
        self._next_allowed_at = self.monotonic() + self._reserved_delay
        return True

    def completed(self) -> None:
        # Page load time also counts as activity. Preserve a gap after it finishes.
        self._next_allowed_at = self.monotonic() + self._reserved_delay
