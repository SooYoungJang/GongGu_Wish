import random
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from public_main import PublicCollectionBlocked, PublicInstagramCollector
from public_pacing import RequestPacer, retry_after_seconds
from public_parser import ProfilePostLink


class FakeTime:
    def __init__(self):
        self.seconds = 0.0

    def monotonic(self):
        return self.seconds

    def sleep(self, seconds):
        self.seconds += seconds

    def pacer(self, **overrides):
        config = dict(
            min_interval_seconds=10,
            max_interval_seconds=10,
            break_every=12,
            min_break_seconds=30,
            max_break_seconds=30,
            monotonic=self.monotonic,
            sleep=self.sleep,
            rng=random.Random(1),
        )
        config.update(overrides)
        return RequestPacer(**config)


class RecordingPage:
    def __init__(self, clock, navigations):
        self.clock = clock
        self.navigations = navigations
        self.url = ""

    def goto(self, url, **kwargs):
        self.url = url
        self.navigations.append((url, self.clock.monotonic()))
        return type("Response", (), {"status": 200})()

    def locator(self, selector):
        return self

    def inner_text(self, **kwargs):
        return ""

    def content(self):
        return "<main></main>"

    def close(self):
        pass


class RecordingContext:
    def __init__(self, clock):
        self.clock = clock
        self.navigations = []
        self.listeners = {}

    def on(self, event, callback):
        self.listeners[event] = callback

    def new_page(self):
        return RecordingPage(self.clock, self.navigations)


class PublicPacingTest(unittest.TestCase):
    def test_new_pages_and_discovery_share_navigation_spacing(self):
        clock = FakeTime()
        context = RecordingContext(clock)
        collector = PublicInstagramCollector(context, pacer=clock.pacer())

        collector.collect_account("first")
        collector.collect_account("second")
        collector._load_discovered_username(
            context.new_page(),
            ProfilePostLink("p:seed", "https://www.instagram.com/p/seed/", None),
            should_continue=lambda: True,
        )

        self.assertEqual([stamp for _, stamp in context.navigations], [0, 10, 20])

    def test_periodic_break_prevents_a_continuous_burst(self):
        clock = FakeTime()
        pacer = clock.pacer(break_every=2)
        starts = []
        for _ in range(4):
            self.assertTrue(pacer.wait())
            starts.append(clock.monotonic())
        self.assertEqual(starts, [0, 10, 50, 60])

    def test_jitter_stays_within_configured_limits_and_varies(self):
        clock = FakeTime()
        pacer = clock.pacer(max_interval_seconds=20, break_every=100)
        starts = []
        for _ in range(6):
            self.assertTrue(pacer.wait())
            starts.append(clock.monotonic())
        gaps = [end - start for start, end in zip(starts, starts[1:])]
        self.assertTrue(all(10 <= gap <= 20 for gap in gaps))
        self.assertGreater(len(set(round(gap, 2) for gap in gaps)), 1)

    def test_expired_budget_prevents_navigation_after_a_wait(self):
        clock = FakeTime()
        context = RecordingContext(clock)
        collector = PublicInstagramCollector(context, pacer=clock.pacer())
        collector.start_run(5)
        collector.collect_account("first")

        from public_main import PublicCollectionBudgetExceeded

        with self.assertRaises(PublicCollectionBudgetExceeded):
            collector.collect_account("second")
        self.assertEqual(len(context.navigations), 1)
        self.assertLessEqual(clock.monotonic(), 5)

    def test_discovery_deadline_is_rechecked_during_pacing(self):
        clock = FakeTime()
        context = RecordingContext(clock)
        collector = PublicInstagramCollector(context, pacer=clock.pacer())
        collector.collect_account("first")

        username = collector._load_discovered_username(
            context.new_page(),
            ProfilePostLink("p:seed", "https://www.instagram.com/p/seed/", None),
            should_continue=lambda: clock.monotonic() < 2,
        )

        self.assertIsNone(username)
        self.assertEqual(len(context.navigations), 1)
        self.assertEqual(clock.monotonic(), 2)

    def test_retry_after_accepts_seconds_and_http_date(self):
        now = datetime(2026, 10, 3, tzinfo=timezone.utc)
        self.assertEqual(retry_after_seconds("7200", now), 7200)
        self.assertEqual(retry_after_seconds("Sat, 03 Oct 2026 08:00:00 GMT", now), 28800)
        self.assertEqual(retry_after_seconds("Fri, 02 Oct 2026 23:00:00 GMT", now), 0)
        for value in (None, "", "-1", "invalid", "1.5"):
            with self.subTest(value=value):
                self.assertIsNone(retry_after_seconds(value, now))

    def test_background_instagram_429_stops_navigation_and_preserves_retry_after(self):
        clock = FakeTime()
        context = RecordingContext(clock)
        collector = PublicInstagramCollector(context, pacer=clock.pacer())
        collector.collect_account("first")
        response = type("Response", (), {
            "status": 429,
            "url": "https://www.instagram.com/api/v1/feed/user/123/",
            "header_value": lambda self, name: "28800",
        })()
        context.listeners["response"](response)

        with self.assertRaises(PublicCollectionBlocked) as blocked:
            collector.collect_account("second")
        self.assertEqual(blocked.exception.code, "HTTP_429")
        self.assertEqual(blocked.exception.retry_after_seconds, 28800)
        self.assertEqual(len(context.navigations), 1)

    def test_slow_page_load_is_followed_by_the_full_pause(self):
        clock = FakeTime()
        pacer = clock.pacer()
        self.assertTrue(pacer.wait())
        clock.sleep(3)
        pacer.completed()
        self.assertTrue(pacer.wait())
        self.assertEqual(clock.monotonic(), 13)

    def test_browser_events_are_processed_while_waiting_between_pages(self):
        clock = FakeTime()
        context = RecordingContext(clock)
        response = type("Response", (), {
            "status": 429,
            "url": "https://www.instagram.com/api/v1/feed/user/123/",
            "header_value": lambda self, name: "28800",
        })()

        class EventPage(RecordingPage):
            def wait_for_timeout(self, milliseconds):
                clock.sleep(milliseconds / 1000)
                if clock.monotonic() >= 2:
                    context.listeners["response"](response)

        context.new_page = lambda: EventPage(clock, context.navigations)

        def virtual_pacer(**kwargs):
            return clock.pacer(**kwargs)

        with patch("public_main.RequestPacer", side_effect=virtual_pacer):
            collector = PublicInstagramCollector(context)
        # Rendering waits now dispatch responses, so the first profile stops sooner.
        with self.assertRaises(PublicCollectionBlocked):
            collector.collect_account("first")
        with self.assertRaises(PublicCollectionBlocked):
            collector.collect_account("second")
        self.assertEqual(len(context.navigations), 1)
        self.assertEqual(clock.monotonic(), 2)


if __name__ == "__main__":
    unittest.main()
