import unittest

from public_parser import (
    blocked_page_reason,
    build_hashtag_url,
    extract_discovery_post_links,
    extract_post_username,
    extract_profile_external_links,
    extract_profile_posts,
    normalize_profile_external_url,
    normalize_post_url,
    normalize_username,
    parse_post_html,
    trusted_media_url,
)


class PublicParserTest(unittest.TestCase):
    def test_builds_only_canonical_instagram_hashtag_urls(self):
        self.assertEqual(
            build_hashtag_url("#공동구매"),
            "https://www.instagram.com/explore/tags/%EA%B3%B5%EB%8F%99%EA%B5%AC%EB%A7%A4/",
        )
        with self.assertRaises(ValueError):
            build_hashtag_url("../../accounts/login")

    def test_extracts_all_unique_discovery_post_links_without_an_account_cap(self):
        html = "".join(
            f'<a href="/p/post_{index}/"><img src="https://scontent.cdninstagram.com/{index}.jpg"></a>'
            for index in range(15)
        )
        html += '<a href="/p/post_3/">duplicate</a>'

        posts = extract_discovery_post_links(html)

        self.assertEqual(len(posts), 15)
        self.assertEqual(posts[0].post_id, "p:post_0")
        self.assertEqual(posts[-1].post_id, "p:post_14")

    def test_extracts_article_author_and_ignores_navigation_profiles(self):
        html = """
        <nav>
          <a href="/logged.in.user/">내 프로필</a>
          <a href="/explore/">탐색</a>
        </nav>
        <article>
          <header><a href="/random.seller/">판매자</a></header>
          <a href="/p/ABC_123/">게시물</a>
        </article>
        """

        self.assertEqual(extract_post_username(html), "random.seller")

    def test_extracts_main_author_when_instagram_omits_article(self):
        html = """
        <nav>
          <a href="/logged.in.user/">내 프로필</a>
        </nav>
        <main>
          <div><a href="/gonggu_jupjup/">판매자</a></div>
          <a href="/p/ABC_123/">게시물</a>
        </main>
        """

        self.assertEqual(extract_post_username(html), "gonggu_jupjup")

    def test_prefers_twitter_metadata_when_main_contains_multiple_profiles(self):
        html = """
        <html><head>
          <meta name="twitter:title"
                content="판매자 (@actual.seller) • Instagram 릴스">
        </head><body><main>
          <a href="/commenter.first/">댓글 작성자</a>
          <a href="/actual.seller/">판매자</a>
        </main></body></html>
        """

        self.assertEqual(extract_post_username(html), "actual.seller")

    def test_rejects_ambiguous_main_profiles_without_author_metadata(self):
        html = """
        <main>
          <a href="/possible.seller/">판매자 후보</a>
          <a href="/commenter/">댓글 작성자</a>
        </main>
        """

        self.assertIsNone(extract_post_username(html))

    def test_normalizes_only_instagram_post_urls(self):
        self.assertEqual(
            normalize_post_url("/p/ABC_123/"),
            ("p:ABC_123", "https://www.instagram.com/p/ABC_123/"),
        )
        self.assertIsNone(normalize_post_url("https://example.com/p/ABC_123/"))
        with self.assertRaises(ValueError):
            normalize_username("bad username")

    def test_normalizes_account_prefixed_instagram_post_urls(self):
        self.assertEqual(
            normalize_post_url("/milkable/p/ABC_123/"),
            ("p:ABC_123", "https://www.instagram.com/p/ABC_123/"),
        )
        self.assertEqual(
            normalize_post_url("https://www.instagram.com/milkable/reel/REEL_123/"),
            ("reel:REEL_123", "https://www.instagram.com/reel/REEL_123/"),
        )

    def test_extracts_deduplicated_profile_post_links(self):
        html = """
        <a href="/p/first/"><img src="https://scontent.cdninstagram.com/first.jpg"></a>
        <a href="/p/first/"><img src="https://scontent.cdninstagram.com/duplicate.jpg"></a>
        <a href="/reel/second/"><img data-src="https://scontent.cdninstagram.com/second.jpg"></a>
        <a href="/accounts/login/"><img src="https://scontent.cdninstagram.com/login.jpg"></a>
        """
        posts = extract_profile_posts(html, limit=10)
        self.assertEqual([post.post_id for post in posts], ["p:first", "reel:second"])
        self.assertEqual(posts[0].image_url, "https://scontent.cdninstagram.com/first.jpg")

    def test_extracts_profile_prefixed_post_links(self):
        html = """
        <a href="/milkable/p/first/"><img src="https://scontent.cdninstagram.com/first.jpg"></a>
        <a href="/milkable/reel/second/"><img src="https://scontent.cdninstagram.com/second.jpg"></a>
        """
        posts = extract_profile_posts(html, base_url="https://www.instagram.com/milkable/")
        self.assertEqual([post.post_id for post in posts], ["p:first", "reel:second"])
        self.assertEqual(
            [post.post_url for post in posts],
            [
                "https://www.instagram.com/p/first/",
                "https://www.instagram.com/reel/second/",
            ],
        )

    def test_extracts_safe_profile_links_and_unwraps_instagram_redirects(self):
        html = """
        <a href="https://l.instagram.com/?u=https%3A%2F%2Fshop.example%2Fitem%3Futm_source%3Dinstagram%26color%3Dred%26fbclid%3Dtracking&amp;e=signature">
          오늘 공구 구매
        </a>
        <a href="https://shop.example/item?color=red">중복 링크</a>
        <a href="https://linktr.ee/random.seller" aria-label="전체 공구 링크">링크 모음</a>
        <a href="/random.seller/">Instagram 내부 링크</a>
        """

        links = extract_profile_external_links(html)

        self.assertEqual(
            [(link.url, link.label) for link in links],
            [
                ("https://shop.example/item?color=red", "오늘 공구 구매"),
                ("https://linktr.ee/random.seller", "전체 공구 링크"),
            ],
        )

    def test_rejects_unsafe_profile_external_urls(self):
        unsafe_urls = [
            "javascript:alert(1)",
            "https://instagram.com/random.seller/",
            "https://user:password@shop.example/item",
            "http://127.0.0.1/admin",
            "https://[::1]/admin",
            "https://localhost/admin",
            "https://service.local/admin",
            "https://intranet/admin",
        ]

        for value in unsafe_urls:
            with self.subTest(value=value):
                self.assertIsNone(normalize_profile_external_url(value))

        self.assertEqual(
            normalize_profile_external_url("http://shop.example/item"),
            "http://shop.example/item",
        )

    def test_parses_post_metadata_without_network_calls(self):
        html = """
        <html><head>
          <meta property="og:description" content="국내 배송 공구 10,000원 https://shop.example/item">
          <meta property="og:image" content="https://scontent.cdninstagram.com/post.jpg">
        </head><body><time datetime="2026-08-08T01:02:03+00:00"></time></body></html>
        """
        post = parse_post_html(html, "https://www.instagram.com/p/ABC/")
        self.assertEqual(post.post_id, "p:ABC")
        self.assertIn("국내 배송 공구", post.caption)
        self.assertEqual(post.image_url, "https://scontent.cdninstagram.com/post.jpg")
        self.assertEqual(post.taken_at, "2026-08-08T01:02:03+00:00")

    def test_detects_login_and_rate_limit_pages(self):
        self.assertEqual(
            blocked_page_reason(
                "https://www.instagram.com/accounts/login/",
                200,
                "로그인",
            ),
            "LOGIN_OR_CHALLENGE",
        )
        self.assertEqual(
            blocked_page_reason(
                "https://www.instagram.com/example/",
                429,
                "",
            ),
            "HTTP_429",
        )
        self.assertIsNone(
            blocked_page_reason(
                "https://www.instagram.com/example/",
                200,
                "공개 프로필 게시물",
            )
        )

    def test_rejects_untrusted_media_hosts(self):
        self.assertEqual(
            trusted_media_url("https://scontent.cdninstagram.com/image.jpg"),
            "https://scontent.cdninstagram.com/image.jpg",
        )
        self.assertIsNone(trusted_media_url("https://example.com/image.jpg"))


if __name__ == "__main__":
    unittest.main()
