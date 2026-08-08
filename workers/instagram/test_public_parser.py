import unittest

from public_parser import (
    blocked_page_reason,
    extract_profile_posts,
    normalize_post_url,
    normalize_username,
    parse_post_html,
    trusted_media_url,
)


class PublicParserTest(unittest.TestCase):
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
