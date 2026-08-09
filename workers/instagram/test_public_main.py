import random
import unittest
from datetime import datetime, timezone

from public_main import (
    PublicInstagramWorker,
    SupabaseCollectorApi,
    bounded_next_run,
    latest_posts,
)


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


class FakeResponse:
    ok = True
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self):
        self.headers = {}
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return FakeResponse({"items": []})


class PublicMainTest(unittest.TestCase):
    def test_latest_posts_returns_only_the_three_newest_known_posts(self):
        posts = [
            {"instagramPostId": "old", "takenAt": "2026-08-01T00:00:00+00:00"},
            {"instagramPostId": "newest", "takenAt": "2026-08-08T00:00:00+00:00"},
            {"instagramPostId": "middle", "takenAt": "2026-08-05T00:00:00+00:00"},
            {"instagramPostId": "unknown", "takenAt": None},
        ]

        selected = latest_posts(posts, limit=3)

        self.assertEqual(
            [post["instagramPostId"] for post in selected],
            ["newest", "middle", "old"],
        )

    def test_latest_posts_caps_the_requested_limit_at_three(self):
        posts = [
            {"instagramPostId": str(index), "takenAt": f"2026-08-{index + 1:02d}T00:00:00+00:00"}
            for index in range(5)
        ]

        selected = latest_posts(posts, limit=10)

        self.assertEqual(len(selected), 3)
        self.assertEqual(
            [post["instagramPostId"] for post in selected],
            ["4", "3", "2"],
        )

    def test_supabase_collector_api_uses_action_contract_and_token(self):
        session = FakeSession()
        api = SupabaseCollectorApi(
            "https://preview.example/functions/v1/instagram-public-collector",
            "collector-secret",
            session=session,
        )

        self.assertEqual(api.watchlist(), [])
        api.collect_post({"instagramPostId": "post-1"})
        api.update_status(
            "influencer-1",
            status="SUCCESS",
            attempt_at=datetime(2026, 8, 8, tzinfo=timezone.utc),
            next_run_at=datetime(2026, 8, 8, 0, 15, tzinfo=timezone.utc),
        )

        self.assertEqual(session.headers["X-Collector-Token"], "collector-secret")
        self.assertEqual(
            [call[2]["json"]["action"] for call in session.calls],
            ["watchlist", "collect", "status"],
        )
        self.assertEqual(
            session.calls[1][2]["json"]["post"],
            {"instagramPostId": "post-1"},
        )
        self.assertEqual(session.calls[2][2]["json"]["influencerId"], "influencer-1")

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
