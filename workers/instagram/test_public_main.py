import random
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from public_main import (
    PublicCollectionBlocked,
    PublicInstagramWorker,
    RandomDiscoveryConfig,
    SupabaseCollectorApi,
    bounded_next_run,
    latest_posts,
    load_random_discovery_config,
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
        return {}

    def update_status(self, influencer_id, **kwargs):
        self.statuses.append((influencer_id, kwargs))


class FakeCollector:
    def __init__(self):
        self.accounts = []

    def collect_account(self, username):
        self.accounts.append(username)
        return [{"instagramPostId": f"p:{username}"}]


class FakeDiscoveryApi(FakeApi):
    def __init__(self, candidate_accounts=(), duplicate_accounts=()):
        super().__init__()
        self.candidate_accounts = set(candidate_accounts)
        self.duplicate_accounts = set(duplicate_accounts)

    def watchlist(self):
        return []

    def collect_post(self, payload):
        self.posts.append(payload)
        username = payload["influencerUsername"]
        if username in self.duplicate_accounts:
            return {
                "created": False,
                "duplicate": True,
                "groupBuyId": f"existing:{username}",
            }
        if username in self.candidate_accounts:
            return {
                "created": True,
                "duplicate": False,
                "groupBuyId": f"new:{username}",
            }
        return {"created": True, "duplicate": False, "groupBuyId": None}


class FakeDiscoveryCollector(FakeCollector):
    def __init__(self, discovered_accounts, blocked_account=None):
        super().__init__()
        self.discovered_accounts = list(discovered_accounts)
        self.blocked_account = blocked_account
        self.discovery_arguments = None

    def iter_discovered_accounts(
        self,
        *,
        hashtags,
        scroll_passes,
        rng,
        excluded_usernames,
        should_continue=None,
    ):
        self.discovery_arguments = {
            "hashtags": hashtags,
            "scroll_passes": scroll_passes,
            "excluded_usernames": set(excluded_usernames),
        }
        for username in self.discovered_accounts:
            if username not in excluded_usernames:
                yield username

    def collect_account(self, username):
        self.accounts.append(username)
        if username == self.blocked_account:
            raise PublicCollectionBlocked("LOGIN_OR_CHALLENGE", "blocked")
        return [
            {
                "instagramPostId": f"p:{username}",
                "influencerUsername": username,
            }
        ]


class DeadlineAwareDiscoveryCollector(FakeDiscoveryCollector):
    def iter_discovered_accounts(
        self,
        *,
        hashtags,
        scroll_passes,
        rng,
        excluded_usernames,
        should_continue,
    ):
        if not should_continue():
            return
        if not should_continue():
            return
        yield "too-late"


class SequenceMonotonic:
    def __init__(self, *values):
        self.values = iter(values)

    def __call__(self):
        return next(self.values)


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
    def discovery_config(self, **overrides):
        values = {
            "enabled": True,
            "target_group_buys": 3,
            "hashtags": ("공구", "공동구매"),
            "scroll_passes": 2,
            "time_budget_seconds": 900,
            "emergency_max_accounts": None,
        }
        values.update(overrides)
        return RandomDiscoveryConfig(**values)

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

    def test_random_discovery_config_has_no_account_limit_unless_explicit(self):
        with patch.dict(
            "os.environ",
            {
                "INSTAGRAM_RANDOM_DISCOVERY_ENABLED": "true",
                "INSTAGRAM_DISCOVERY_TARGET_GROUP_BUYS": "4",
                "INSTAGRAM_DISCOVERY_TIME_BUDGET_SECONDS": "600",
                "INSTAGRAM_DISCOVERY_SCROLL_PASSES": "2",
                "INSTAGRAM_DISCOVERY_HASHTAGS": "#공구, 공동구매,공구",
            },
            clear=True,
        ):
            config = load_random_discovery_config()

        self.assertTrue(config.enabled)
        self.assertEqual(config.target_group_buys, 4)
        self.assertEqual(config.time_budget_seconds, 600)
        self.assertEqual(config.scroll_passes, 2)
        self.assertEqual(config.hashtags, ("공구", "공동구매"))
        self.assertIsNone(config.emergency_max_accounts)

        with patch.dict(
            "os.environ",
            {"INSTAGRAM_DISCOVERY_EMERGENCY_MAX_ACCOUNTS": "25"},
            clear=True,
        ):
            limited = load_random_discovery_config()
        self.assertEqual(limited.emergency_max_accounts, 25)

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

    def test_random_discovery_continues_past_ten_accounts_until_a_new_candidate(self):
        accounts = [f"random{index}" for index in range(15)]
        api = FakeDiscoveryApi(candidate_accounts={"random11"})
        collector = FakeDiscoveryCollector(accounts)
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(target_group_buys=1),
            monotonic=SequenceMonotonic(*([0] * 20)),
            rng=random.Random(1),
        )

        self.assertEqual(worker.run_once(), 12)
        self.assertEqual(collector.accounts, accounts[:12])

    def test_random_discovery_stops_after_three_new_group_buy_candidates(self):
        api = FakeDiscoveryApi(candidate_accounts={"seller0", "seller1", "seller2", "seller3"})
        collector = FakeDiscoveryCollector([f"seller{index}" for index in range(5)])
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(target_group_buys=3),
            monotonic=SequenceMonotonic(*([0] * 10)),
        )

        self.assertEqual(worker.run_once(), 3)
        self.assertEqual(collector.accounts, ["seller0", "seller1", "seller2"])

    def test_random_discovery_does_not_count_duplicate_group_buys(self):
        api = FakeDiscoveryApi(
            candidate_accounts={"newcandidate"},
            duplicate_accounts={"duplicate0", "duplicate1"},
        )
        collector = FakeDiscoveryCollector(["duplicate0", "duplicate1", "newcandidate"])
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(target_group_buys=1),
            monotonic=SequenceMonotonic(*([0] * 10)),
        )

        self.assertEqual(worker.run_once(), 3)
        self.assertEqual(collector.accounts, ["duplicate0", "duplicate1", "newcandidate"])

    def test_random_discovery_stops_when_time_budget_expires(self):
        api = FakeDiscoveryApi()
        collector = FakeDiscoveryCollector(["seller0", "seller1", "seller2"])
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(time_budget_seconds=10),
            monotonic=SequenceMonotonic(0, 0, 11),
        )

        self.assertEqual(worker.run_once(), 1)
        self.assertEqual(collector.accounts, ["seller0"])

    def test_random_discovery_time_budget_interrupts_slow_source_before_an_account(self):
        api = FakeDiscoveryApi()
        collector = DeadlineAwareDiscoveryCollector([])
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(time_budget_seconds=10),
            monotonic=SequenceMonotonic(0, 0, 11),
        )

        self.assertEqual(worker.run_once(), 0)
        self.assertEqual(collector.accounts, [])

    def test_random_discovery_stops_immediately_on_instagram_block(self):
        api = FakeDiscoveryApi()
        collector = FakeDiscoveryCollector(
            ["seller0", "blocked", "seller2"],
            blocked_account="blocked",
        )
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(),
            monotonic=SequenceMonotonic(*([0] * 10)),
        )

        self.assertEqual(worker.run_once(), 1)
        self.assertEqual(collector.accounts, ["seller0", "blocked"])

    def test_random_discovery_honors_only_an_explicit_emergency_account_limit(self):
        api = FakeDiscoveryApi()
        collector = FakeDiscoveryCollector([f"seller{index}" for index in range(5)])
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(emergency_max_accounts=2),
            monotonic=SequenceMonotonic(*([0] * 10)),
        )

        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(collector.accounts, ["seller0", "seller1"])


if __name__ == "__main__":
    unittest.main()
