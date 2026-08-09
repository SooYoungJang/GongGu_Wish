import random
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from public_main import (
    PublicCollectionBlocked,
    PublicInstagramCollector,
    PublicInstagramWorker,
    RandomDiscoveryConfig,
    SupabaseCollectorApi,
    bounded_next_run,
    latest_posts,
    load_random_discovery_config,
)
from public_parser import ProfilePostLink


class FakeBodyLocator:
    def inner_text(self, timeout):
        return ""


class FakeMouse:
    def wheel(self, delta_x, delta_y):
        return None


class DelayedDiscoveryPage:
    url = "https://www.instagram.com/explore/search/keyword/?q=%23%EA%B3%B5%EA%B5%AC"

    def __init__(self):
        self.elapsed_ms = 0
        self.mouse = FakeMouse()

    def goto(self, url, **kwargs):
        return type("Response", (), {"status": 200})()

    def locator(self, selector):
        return FakeBodyLocator()

    def wait_for_timeout(self, milliseconds):
        self.elapsed_ms += milliseconds

    def content(self):
        if self.elapsed_ms < 3_000:
            return "<html><body></body></html>"
        return '<html><body><a href="/p/delayed123/">post</a></body></html>'


class StaticPage:
    def __init__(self, html=""):
        self.html = html
        self.mouse = FakeMouse()
        self.url = ""

    def goto(self, url, **kwargs):
        self.url = url
        return type("Response", (), {"status": 200})()

    def locator(self, selector):
        return FakeBodyLocator()

    def content(self):
        return self.html

    def close(self):
        return None


class FallbackCollectionPage(StaticPage):
    def __init__(self, profile_html="<html><body></body></html>"):
        super().__init__()
        self.profile_html = profile_html

    def content(self):
        if "/p/" not in self.url and "/reel/" not in self.url:
            return self.profile_html
        username = "other.seller" if "unrelated999" in self.url else "random.seller"
        return f"""
        <html><head>
          <meta name="twitter:title"
                content="판매자 (@{username}) • Instagram 릴스">
        </head><body><main><a href="/{username}/">판매자</a></main></body></html>
        """


class FakeBrowserContext:
    def __init__(self, page):
        self.page = page

    def new_page(self):
        return self.page


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
    def __init__(self, candidate_accounts=(), duplicate_accounts=(), existing_campaign_accounts=()):
        super().__init__()
        self.candidate_accounts = set(candidate_accounts)
        self.duplicate_accounts = set(duplicate_accounts)
        self.existing_campaign_accounts = set(existing_campaign_accounts)

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
                "reviewCandidateCreated": False,
            }
        if username in self.existing_campaign_accounts:
            return {
                "created": True,
                "duplicate": False,
                "groupBuyId": f"existing-campaign:{username}",
                "reviewCandidateCreated": False,
            }
        if username in self.candidate_accounts:
            return {
                "created": True,
                "duplicate": False,
                "groupBuyId": f"new:{username}",
                "reviewCandidateCreated": True,
            }
        return {
            "created": True,
            "duplicate": False,
            "groupBuyId": None,
            "reviewCandidateCreated": False,
        }


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

    def test_discovery_waits_for_instagram_to_render_post_links(self):
        collector = PublicInstagramCollector(None)
        page = DelayedDiscoveryPage()

        links = collector._load_hashtag_post_links(
            page,
            "공구",
            scroll_passes=2,
            should_continue=lambda: True,
        )

        self.assertEqual([link.post_id for link in links], ["p:delayed123"])
        self.assertGreaterEqual(page.elapsed_ms, 3_000)

    def test_collect_account_falls_back_to_verified_discovery_post_links(self):
        collection_page = FallbackCollectionPage()
        collector = PublicInstagramCollector(
            FakeBrowserContext(collection_page),
            limit=3,
        )
        discovery_page = StaticPage(
            """
            <html><main>
              <a href="/random.seller/">판매자</a>
              <a href="/p/seed123/">원본</a>
              <a href="/p/unrelated999_1/">다른 계정 1</a>
              <a href="/p/unrelated999_2/">다른 계정 2</a>
              <a href="/p/unrelated999_3/">다른 계정 3</a>
              <a href="/p/unrelated999_4/">다른 계정 4</a>
              <a href="/p/unrelated999_5/">다른 계정 5</a>
              <a href="/p/unrelated999_6/">다른 계정 6</a>
              <a href="/p/unrelated999_7/">다른 계정 7</a>
              <a href="/p/unrelated999_8/">다른 계정 8</a>
              <a href="/reel/recent456_1/">같은 계정 1</a>
              <a href="/reel/recent456_2/">같은 계정 2</a>
              <a href="/reel/recent456_3/">같은 계정 3</a>
            </main></html>
            """
        )
        seed = ProfilePostLink(
            "p:seed123",
            "https://www.instagram.com/p/seed123/",
            None,
        )

        username = collector._load_discovered_username(
            discovery_page,
            seed,
            should_continue=lambda: True,
        )

        def parsed_post(html, post_url, image_url):
            kind = "reel" if "/reel/" in post_url else "p"
            post_id = post_url.rstrip("/").rsplit("/", 1)[-1]
            suffix = int(post_id.rsplit("_", 1)[-1]) if "_" in post_id else 0
            return SimpleNamespace(
                post_id=f"{kind}:{post_id}",
                caption="공구",
                post_url=post_url,
                image_url=image_url,
                taken_at=f"2026-08-{suffix + 1:02d}T00:00:00+00:00",
            )

        with patch("public_main.parse_post_html", side_effect=parsed_post):
            posts = collector.collect_account(username)

        self.assertEqual(username, "random.seller")
        self.assertEqual(
            [post["instagramPostId"] for post in posts],
            ["reel:recent456_3", "reel:recent456_2", "reel:recent456_1"],
        )

        with patch("public_main.parse_post_html", side_effect=parsed_post):
            repeated_posts = collector.collect_account(username)
        self.assertEqual(repeated_posts, [])

    def test_collect_account_verifies_nonempty_profile_links(self):
        collection_page = FallbackCollectionPage(
            '<html><main><a href="/p/unrelated999/">추천 게시물</a></main></html>'
        )
        collector = PublicInstagramCollector(
            FakeBrowserContext(collection_page),
            limit=3,
        )

        with patch("public_main.parse_post_html") as parse_post:
            posts = collector.collect_account("random.seller")

        self.assertEqual(posts, [])
        parse_post.assert_not_called()

    def test_new_discovery_attempt_discards_unconsumed_pending_links(self):
        collector = PublicInstagramCollector(
            FakeBrowserContext(FallbackCollectionPage()),
            limit=3,
        )
        first_seed = ProfilePostLink(
            "p:first",
            "https://www.instagram.com/p/first/",
            None,
        )
        second_seed = ProfilePostLink(
            "p:second",
            "https://www.instagram.com/p/second/",
            None,
        )
        first_username = collector._load_discovered_username(
            StaticPage('<main><a href="/random.seller/">판매자</a></main>'),
            first_seed,
            should_continue=lambda: True,
        )

        second_username = collector._load_discovered_username(
            StaticPage("<main></main>"),
            second_seed,
            should_continue=lambda: True,
        )
        posts = collector.collect_account(first_username)

        self.assertIsNone(second_username)
        self.assertEqual(posts, [])

    def test_closing_discovery_iterator_discards_unconsumed_pending_links(self):
        collector = PublicInstagramCollector(
            FakeBrowserContext(StaticPage()),
            limit=3,
        )
        seed = ProfilePostLink(
            "p:seed",
            "https://www.instagram.com/p/seed/",
            None,
        )

        def discovered_username(page, link, should_continue):
            collector._pending_discovery = ("random.seller", [seed])
            return "random.seller"

        with (
            patch.object(collector, "_load_hashtag_post_links", return_value=[seed]),
            patch.object(
                collector,
                "_load_discovered_username",
                side_effect=discovered_username,
            ),
        ):
            accounts = collector.iter_discovered_accounts(
                hashtags=("공구",),
                scroll_passes=0,
                rng=random.Random(1),
                excluded_usernames=set(),
                should_continue=lambda: True,
            )
            self.assertEqual(next(accounts), "random.seller")
            accounts.close()

        self.assertIsNone(collector._pending_discovery)

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

    def test_random_discovery_does_not_count_a_new_post_attached_to_an_existing_campaign(self):
        api = FakeDiscoveryApi(
            candidate_accounts={"newcandidate"},
            existing_campaign_accounts={"campaignupdate"},
        )
        collector = FakeDiscoveryCollector(["campaignupdate", "newcandidate"])
        worker = PublicInstagramWorker(
            api,
            collector,
            watchlist_enabled=False,
            discovery=self.discovery_config(target_group_buys=1),
            monotonic=SequenceMonotonic(*([0] * 10)),
        )

        self.assertEqual(worker.run_once(), 2)
        self.assertEqual(collector.accounts, ["campaignupdate", "newcandidate"])

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
