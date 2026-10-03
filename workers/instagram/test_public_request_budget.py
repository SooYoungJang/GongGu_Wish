import random
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from public_cooldown import load_cooldown
from public_main import (
    PublicCollectionBudgetExceeded,
    PublicCollectionBlocked,
    PublicCollectionError,
    PublicInstagramCollector,
    PublicInstagramWorker,
    RandomDiscoveryConfig,
    load_random_discovery_config,
)
from public_pacing import RequestPacer
from test_public_main import (
    FakeBrowserContext,
    FakeDiscoveryApi,
    FakeDiscoveryCollector,
    FallbackCollectionPage,
    StaticPage,
)


class DelayedProfilePage(FallbackCollectionPage):
    def __init__(self):
        super().__init__('<main><a href="/p/rendered123/">post</a></main>')
        self.elapsed_ms = 0
        self.navigations = []

    def goto(self, url, **kwargs):
        self.navigations.append(url)
        return super().goto(url, **kwargs)

    def wait_for_timeout(self, milliseconds):
        self.elapsed_ms += milliseconds

    def content(self):
        if "/p/" not in self.url and self.elapsed_ms < 2_000:
            return "<main></main>"
        return super().content()


class RegistryApi(FakeDiscoveryApi):
    def __init__(self):
        super().__init__(candidate_accounts={"second"})
        self.watchlist_calls = 0

    def watchlist(self):
        self.watchlist_calls += 1
        return [
            {"id": "1", "instagramUsername": "first"},
            {"id": "2", "instagramUsername": "second"},
            {"id": "3", "instagramUsername": "third"},
        ]


class PublicRequestBudgetTest(unittest.TestCase):
    def pacer(self):
        return RequestPacer(min_interval_seconds=0, max_interval_seconds=0,
                            min_break_seconds=0, max_break_seconds=0)

    def test_profile_waits_for_render_without_reloading_the_profile(self):
        page = DelayedProfilePage()
        collector = PublicInstagramCollector(FakeBrowserContext(page), pacer=self.pacer())

        posts = collector.collect_account("random.seller")

        self.assertEqual([post["instagramPostId"] for post in posts], ["p:rendered123"])
        self.assertEqual(page.navigations, [
            "https://www.instagram.com/random.seller/",
            "https://www.instagram.com/p/rendered123/",
        ])
        self.assertGreaterEqual(page.elapsed_ms, 2_000)

    def test_navigation_budget_is_shared_across_pages_and_discovery(self):
        collector = PublicInstagramCollector(None, pacer=self.pacer(), max_navigations=2)
        first, second = StaticPage(), StaticPage()
        collector.start_run(900)
        collector._navigate(first, "https://www.instagram.com/first/")
        collector._navigate(second, "https://www.instagram.com/second/")

        with self.assertRaises(PublicCollectionBudgetExceeded) as raised:
            collector._navigate(first, "https://www.instagram.com/explore/")

        self.assertEqual(raised.exception.code, "REQUEST_BUDGET")
        self.assertEqual(first.url, "https://www.instagram.com/first/")
        self.assertEqual(collector.navigation_count, 2)

    def test_navigation_budget_preserves_already_verified_posts(self):
        page = FallbackCollectionPage(
            '<main><a href="/p/first123/">one</a><a href="/p/second123/">two</a></main>'
        )
        collector = PublicInstagramCollector(FakeBrowserContext(page),
                                            pacer=self.pacer(), max_navigations=2)
        collector.start_run(900)

        posts = collector.collect_account("random.seller")

        self.assertEqual([post["instagramPostId"] for post in posts], ["p:first123"])
        self.assertTrue(collector.budget_exhausted)
        self.assertEqual(collector.budget_stop_reason, "REQUEST_BUDGET")
        self.assertEqual(collector.navigation_count, 2)

    def test_production_uses_registered_accounts_and_rejects_hashtag_override(self):
        with patch.dict("os.environ", {"INSTAGRAM_COLLECTION_TARGET": "production"}, clear=True):
            self.assertEqual(load_random_discovery_config().source, "registered")
        with patch.dict("os.environ", {
            "INSTAGRAM_COLLECTION_TARGET": "production", "INSTAGRAM_DISCOVERY_SOURCE": "hashtags",
        }, clear=True):
            with self.assertRaises(PublicCollectionError):
                load_random_discovery_config()

    def test_registered_source_can_run_without_hashtags(self):
        with patch.dict("os.environ", {
            "INSTAGRAM_DISCOVERY_SOURCE": "registered", "INSTAGRAM_DISCOVERY_HASHTAGS": "",
        }, clear=True):
            self.assertEqual(load_random_discovery_config().source, "registered")

    def test_registered_discovery_uses_one_registry_read_and_advances_status(self):
        api = RegistryApi()
        collector = FakeDiscoveryCollector(["unregistered"])
        worker = PublicInstagramWorker(
            api, collector, watchlist_enabled=False,
            discovery=RandomDiscoveryConfig(enabled=True, source="registered", target_group_buys=1),
            clock=lambda: datetime(2026, 10, 3, tzinfo=timezone.utc),
        )

        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(api.watchlist_calls, 1)
        self.assertEqual(collector.accounts, ["first", "second"])
        self.assertIsNone(collector.discovery_arguments)
        self.assertEqual([item[0] for item in api.statuses], ["1", "2"])
        self.assertTrue(all(item[1]["status"] == "SUCCESS" for item in api.statuses))

    def test_registered_both_mode_does_not_repeat_accounts_or_call_hashtags(self):
        api = RegistryApi()
        collector = FakeDiscoveryCollector(["unregistered"])
        worker = PublicInstagramWorker(
            api, collector, watchlist_max_accounts=1,
            discovery=RandomDiscoveryConfig(enabled=True, source="registered", target_group_buys=1),
        )
        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(collector.accounts, ["first", "second"])
        self.assertEqual(api.watchlist_calls, 1)
        self.assertIsNone(collector.discovery_arguments)

    def test_completed_run_persists_minimum_spacing_for_fresh_workers(self):
        clock = lambda: datetime(2026, 10, 3, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cooldown.json"
            api = RegistryApi()
            collector = FakeDiscoveryCollector([])
            collector.navigation_count = 1
            worker = PublicInstagramWorker(api, collector, clock=clock, cooldown_file=path)
            self.assertEqual(worker.run_once(), 3)
            self.assertGreaterEqual(load_cooldown(path), clock() + timedelta(hours=1))

            fresh = FakeDiscoveryCollector([])
            self.assertEqual(PublicInstagramWorker(api, fresh, clock=clock, cooldown_file=path).run_once(), 0)
            self.assertEqual(fresh.accounts, [])

    def test_minimum_run_spacing_preserves_a_longer_429_retry_after(self):
        clock = lambda: datetime(2026, 10, 3, tzinfo=timezone.utc)

        class BlockedCollector(FakeDiscoveryCollector):
            navigation_count = 1

            def collect_account(self, username):
                self.accounts.append(username)
                raise PublicCollectionBlocked("HTTP_429", "blocked", retry_after_seconds=28_800)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cooldown.json"
            api = RegistryApi()
            collector = BlockedCollector([])
            worker = PublicInstagramWorker(api, collector, clock=clock, cooldown_file=path,
                discovery=RandomDiscoveryConfig(enabled=True, source="registered"))
            self.assertEqual(worker.run_once(), 0)
            self.assertEqual(collector.accounts, ["first"])
            self.assertEqual(load_cooldown(path), clock() + timedelta(hours=8))
            self.assertEqual(api.statuses[0][1]["status"], "BLOCKED")

    def test_default_pacing_limits_short_bursts(self):
        seconds = 0.0
        starts = []

        def sleep(delay):
            nonlocal seconds
            seconds += delay

        pacer = RequestPacer(monotonic=lambda: seconds, sleep=sleep, rng=random.Random(1))
        for _ in range(5):
            self.assertTrue(pacer.wait())
            starts.append(seconds)
            pacer.completed()
        self.assertTrue(all(b - a >= 45 for a, b in zip(starts, starts[1:])))
        self.assertGreaterEqual(starts[-1] - starts[0], 4 * 45 + 120)


if __name__ == "__main__":
    unittest.main()
