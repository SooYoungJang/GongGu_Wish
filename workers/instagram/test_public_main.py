import random
import unittest
from datetime import datetime, timezone

from public_main import PublicInstagramWorker, bounded_next_run


class FakeApi:
    def __init__(self):
        self.statuses = []
        self.posts = []

    def watchlist(self):
        return [
            {"id": "1", "instagramUsername": "first", "playwrightFailureCount": 0},
            {"id": "2", "instagramUsername": "second", "playwrightFailureCount": 1},
        ]

    def collect_post(self, payload):
        self.posts.append(payload)

    def update_status(self, influencer_id, **kwargs):
        self.statuses.append((influencer_id, kwargs))


class FakeCollector:
    def __init__(self):
        self.accounts = []

    def collect_account(self, username):
        self.accounts.append(username)
        return [{"instagramPostId": f"p:{username}"}]


class PublicMainTest(unittest.TestCase):
    def test_next_run_stays_inside_bounded_jitter_window(self):
        clock = lambda: datetime(2026, 8, 8, tzinfo=timezone.utc)
        next_run = bounded_next_run(900, 300, rng=random.Random(1), clock=clock)
        delay = (next_run - clock()).total_seconds()
        self.assertGreaterEqual(delay, 600)
        self.assertLessEqual(delay, 1200)

    def test_processes_watchlist_sequentially_and_updates_success(self):
        api = FakeApi()
        collector = FakeCollector()
        worker = PublicInstagramWorker(
            api,
            collector,
            poll_interval_seconds=900,
            jitter_seconds=0,
            clock=lambda: datetime(2026, 8, 8, tzinfo=timezone.utc),
            rng=random.Random(1),
        )

        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(collector.accounts, ["first", "second"])
        self.assertEqual([status[0] for status in api.statuses], ["1", "2"])
        self.assertTrue(all(status[1]["status"] == "SUCCESS" for status in api.statuses))


if __name__ == "__main__":
    unittest.main()
