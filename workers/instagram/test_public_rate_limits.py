import json
import random
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from public_main import (
    PublicCollectionBlocked,
    PublicCollectionError,
    PublicInstagramWorker,
    RandomDiscoveryConfig,
)


class MutableClock:
    def __init__(self):
        self.current = datetime(2026, 10, 3, tzinfo=timezone.utc)

    def __call__(self):
        return self.current


class FakeApi:
    def __init__(self, usernames):
        self.accounts = [
            {
                "id": str(index),
                "instagramUsername": username,
                "playwrightFailureCount": 0,
            }
            for index, username in enumerate(usernames, start=1)
        ]
        self.posts = []
        self.statuses = []

    def watchlist(self):
        return self.accounts

    def collect_post(self, payload):
        self.posts.append(payload)
        return {"reviewCandidateCreated": False}

    def update_status(self, influencer_id, **kwargs):
        self.statuses.append((influencer_id, kwargs))


class FakeCollector:
    def __init__(self, discovered_accounts=()):
        self.discovered_accounts = list(discovered_accounts)
        self.accounts = []
        self.blocked_accounts = {}
        self.discovery_error = None
        self.discovery_runs = 0
        self.excluded_usernames = set()

    def collect_account(self, username):
        self.accounts.append(username)
        if username in self.blocked_accounts:
            raise self.blocked_accounts[username]
        return [
            {
                "instagramPostId": f"p:{username}",
                "influencerUsername": username,
            }
        ]

    def iter_discovered_accounts(
        self,
        *,
        hashtags,
        scroll_passes,
        rng,
        excluded_usernames,
        should_continue=None,
    ):
        self.discovery_runs += 1
        self.excluded_usernames = set(excluded_usernames)
        if self.discovery_error is not None:
            raise self.discovery_error
        for username in self.discovered_accounts:
            if username not in excluded_usernames:
                yield username


class PublicRateLimitsTest(unittest.TestCase):
    def discovery_config(self):
        return RandomDiscoveryConfig(
            enabled=True,
            target_group_buys=3,
            hashtags=("공구",),
            scroll_passes=1,
            time_budget_seconds=900,
            emergency_max_accounts=None,
        )

    def worker(self, api, collector, clock, **kwargs):
        return PublicInstagramWorker(
            api,
            collector,
            jitter_seconds=0,
            clock=clock,
            rng=random.Random(1),
            discovery=self.discovery_config(),
            monotonic=lambda: 0,
            **kwargs,
        )

    def test_watchlist_block_marks_current_account_and_stops_the_entire_cycle(self):
        api = FakeApi(["first", "blocked", "remaining"])
        collector = FakeCollector(["random_account"])
        collector.blocked_accounts["blocked"] = PublicCollectionBlocked(
            "HTTP_429", "Instagram rate limit"
        )
        worker = self.worker(api, collector, MutableClock())

        submitted = worker.run_once()

        blocked_status = api.statuses[1]
        self.assertEqual(blocked_status[0], "2")
        self.assertEqual(blocked_status[1]["status"], "BLOCKED")
        self.assertEqual(blocked_status[1]["error_code"], "HTTP_429")
        self.assertEqual(collector.accounts, ["first", "blocked"])
        self.assertEqual(collector.discovery_runs, 0)
        self.assertEqual(submitted, 1)
        self.assertEqual(len(api.statuses), 2)

    def test_watchlist_block_skips_polls_until_six_hours_and_resumes_at_boundary(self):
        clock = MutableClock()
        blocked_at = clock.current
        api = FakeApi(["blocked"])
        collector = FakeCollector(["random_account"])
        collector.blocked_accounts["blocked"] = PublicCollectionBlocked(
            "HTTP_429", "Instagram rate limit"
        )
        worker = self.worker(api, collector, clock)
        worker.run_once()
        attempted_accounts = list(collector.accounts)
        submitted_posts = list(api.posts)
        collector.blocked_accounts.clear()

        for offset in (timedelta(minutes=15), timedelta(hours=6, seconds=-1)):
            with self.subTest(offset=offset):
                clock.current = blocked_at + offset
                self.assertEqual(worker.run_once(), 0)
                self.assertEqual(collector.accounts, attempted_accounts)
                self.assertEqual(api.posts, submitted_posts)

        clock.current = blocked_at + timedelta(hours=6)
        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(collector.accounts[len(attempted_accounts):], [
            "blocked", "random_account"
        ])
        self.assertEqual(api.statuses[-1][1]["status"], "SUCCESS")

    def test_random_account_429_blocks_the_next_cycle_and_resumes_after_cooldown(self):
        clock = MutableClock()
        blocked_at = clock.current
        api = FakeApi([])
        collector = FakeCollector(["blocked", "remaining"])
        collector.blocked_accounts["blocked"] = PublicCollectionBlocked(
            "HTTP_429", "Instagram rate limit"
        )
        worker = self.worker(api, collector, clock, watchlist_enabled=False)
        self.assertEqual(worker.run_once(), 0)
        self.assertEqual(collector.accounts, ["blocked"])
        collector.blocked_accounts.clear()

        clock.current = blocked_at + timedelta(minutes=15)
        self.assertEqual(worker.run_once(), 0)
        self.assertEqual(collector.accounts, ["blocked"])
        self.assertEqual(collector.discovery_runs, 1)

        clock.current = blocked_at + timedelta(hours=6)
        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(collector.accounts, ["blocked", "blocked", "remaining"])

    def test_discovery_source_429_blocks_the_next_cycle(self):
        clock = MutableClock()
        api = FakeApi([])
        collector = FakeCollector(["random_account"])
        collector.discovery_error = PublicCollectionBlocked(
            "HTTP_429", "Instagram discovery rate limit"
        )
        worker = self.worker(api, collector, clock, watchlist_enabled=False)
        self.assertEqual(worker.run_once(), 0)
        collector.discovery_error = None

        clock.current += timedelta(minutes=15)
        self.assertEqual(worker.run_once(), 0)
        self.assertEqual(collector.discovery_runs, 1)
        self.assertEqual(collector.accounts, [])

    def test_retry_after_longer_than_default_cooldown_controls_resume_time(self):
        clock = MutableClock()
        blocked_at = clock.current
        api = FakeApi(["blocked"])
        collector = FakeCollector()
        collector.blocked_accounts["blocked"] = PublicCollectionBlocked(
            "HTTP_429", "Instagram rate limit", retry_after_seconds=8 * 60 * 60
        )
        worker = self.worker(api, collector, clock)
        self.assertEqual(worker.run_once(), 0)
        self.assertEqual(api.statuses[0][1]["next_run_at"],
                         blocked_at + timedelta(hours=8))
        collector.blocked_accounts.clear()

        for offset in (timedelta(hours=6), timedelta(hours=8, seconds=-1)):
            with self.subTest(offset=offset):
                clock.current = blocked_at + offset
                self.assertEqual(worker.run_once(), 0)
                self.assertEqual(collector.accounts, ["blocked"])

        clock.current = blocked_at + timedelta(hours=8)
        self.assertEqual(worker.run_once(), 1)
        self.assertEqual(collector.accounts, ["blocked", "blocked"])

    def test_watchlist_batch_cap_preserves_order_and_excludes_all_watchlist_from_discovery(self):
        watchlist = ["oldest_due", "next_due", "later_due", "newest_due"]
        api = FakeApi(watchlist)
        collector = FakeCollector(watchlist + ["random_account"])
        worker = self.worker(api, collector, MutableClock(), watchlist_max_accounts=2)

        self.assertEqual(worker.run_once(), 3)
        self.assertEqual(collector.accounts, ["oldest_due", "next_due", "random_account"])
        self.assertEqual([status[0] for status in api.statuses], ["1", "2"])
        self.assertEqual(collector.excluded_usernames, set(watchlist))

    def test_saved_cooldown_survives_new_workers_until_the_six_hour_boundary(self):
        clock = MutableClock()
        blocked_at = clock.current
        api = FakeApi(["blocked"])
        blocked_collector = FakeCollector(["random_account"])
        blocked_collector.blocked_accounts["blocked"] = PublicCollectionBlocked(
            "HTTP_429", "Instagram rate limit"
        )

        with tempfile.TemporaryDirectory() as directory:
            cooldown_file = Path(directory) / "cooldown.json"
            blocked_worker = self.worker(
                api, blocked_collector, clock, cooldown_file=cooldown_file
            )
            self.assertEqual(blocked_worker.run_once(), 0)
            saved_state = json.loads(cooldown_file.read_text(encoding="utf-8"))
            self.assertEqual(set(saved_state), {"cooldownUntil"})
            self.assertEqual(
                datetime.fromisoformat(saved_state["cooldownUntil"]),
                blocked_at + timedelta(hours=6),
            )

            for offset in (timedelta(seconds=1), timedelta(hours=6, seconds=-1)):
                with self.subTest(offset=offset):
                    clock.current = blocked_at + offset
                    collector = FakeCollector(["random_account"])
                    restarted_worker = self.worker(
                        api, collector, clock, cooldown_file=cooldown_file
                    )
                    self.assertEqual(restarted_worker.run_once(), 0)
                    self.assertEqual(collector.accounts, [])
                    self.assertEqual(collector.discovery_runs, 0)

            clock.current = blocked_at + timedelta(hours=6)
            collector = FakeCollector(["random_account"])
            resumed_worker = self.worker(
                api, collector, clock, cooldown_file=cooldown_file
            )
            self.assertEqual(resumed_worker.run_once(), 2)
            self.assertEqual(collector.accounts, ["blocked", "random_account"])

    def test_invalid_saved_cooldown_fails_closed_without_collecting(self):
        api = FakeApi(["first"])
        collector = FakeCollector(["random_account"])

        with tempfile.TemporaryDirectory() as directory:
            cooldown_file = Path(directory) / "cooldown.json"
            cooldown_file.write_text("{invalid-json", encoding="utf-8")

            with self.assertRaises(PublicCollectionError) as raised:
                worker = self.worker(
                    api, collector, MutableClock(), cooldown_file=cooldown_file
                )
                worker.run_once()

            self.assertEqual(raised.exception.code, "INVALID_COOLDOWN_STATE")
            self.assertEqual(collector.accounts, [])
            self.assertEqual(collector.discovery_runs, 0)
            self.assertEqual(api.posts, [])
            self.assertEqual(api.statuses, [])


if __name__ == "__main__":
    unittest.main()
