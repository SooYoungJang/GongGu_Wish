"""Pure HTML parsing helpers for the public Instagram Playwright worker."""

from dataclasses import dataclass
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlparse

INSTAGRAM_HOSTS = {"instagram.com", "www.instagram.com"}
TRUSTED_MEDIA_SUFFIXES = ("cdninstagram.com", "fbcdn.net")
# Instagram profile pages may expose post links with the profile username in
# the path (for example, ``/milkable/p/ABC123/``) or in the root form
# (``/p/ABC123/``). Canonicalize both forms to the root post URL below.
POST_PATH_RE = re.compile(r"^/(?:[A-Za-z0-9._]{1,30}/)?(p|reel|tv)/([A-Za-z0-9_-]+)/?$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")


@dataclass(frozen=True)
class ProfilePostLink:
    post_id: str
    post_url: str
    image_url: str | None = None


@dataclass(frozen=True)
class ParsedPost:
    post_id: str
    post_url: str
    caption: str
    image_url: str | None
    taken_at: str | None


def normalize_username(value: str) -> str:
    username = value.strip().lstrip("@").lower()
    if not USERNAME_RE.fullmatch(username):
        raise ValueError("invalid Instagram username")
    return username


def normalize_post_url(value: str, base_url: str = "https://www.instagram.com/") -> tuple[str, str] | None:
    absolute_url = urljoin(base_url, value)
    parsed = urlparse(absolute_url)
    if parsed.scheme != "https" or parsed.hostname not in INSTAGRAM_HOSTS:
        return None

    match = POST_PATH_RE.fullmatch(parsed.path)
    if not match:
        return None

    kind, shortcode = match.groups()
    return f"{kind}:{shortcode}", f"https://www.instagram.com/{kind}/{shortcode}/"


def trusted_media_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not any(
        host == suffix or host.endswith(f".{suffix}") for suffix in TRUSTED_MEDIA_SUFFIXES
    ):
        return None
    return value


class _ProfileLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str | None]] = []
        self._href: str | None = None
        self._image_url: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "a" and self._href is None:
            self._href = attributes.get("href")
            self._image_url = None
        elif tag == "img" and self._href is not None and self._image_url is None:
            self._image_url = attributes.get("src") or attributes.get("data-src")

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            self.links.append((self._href, self._image_url))
            self._href = None
            self._image_url = None


def extract_profile_posts(
    html: str,
    base_url: str = "https://www.instagram.com/",
    limit: int = 3,
) -> list[ProfilePostLink]:
    parser = _ProfileLinkParser()
    parser.feed(html)
    result: list[ProfilePostLink] = []
    seen: set[str] = set()
    for href, image_url in parser.links:
        normalized = normalize_post_url(href, base_url)
        if normalized is None:
            continue
        post_id, post_url = normalized
        if post_id in seen:
            continue
        seen.add(post_id)
        result.append(ProfilePostLink(post_id, post_url, image_url))
        if len(result) >= limit:
            break
    return result


class _PostMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.images: list[str] = []
        self.times: list[str] = []
        self._article_depth = 0
        self.article_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            content = attributes.get("content")
            if key and content:
                self.meta.setdefault(key, content.strip())
        elif tag == "img":
            image_url = attributes.get("src") or attributes.get("data-src")
            if image_url:
                self.images.append(image_url)
        elif tag == "time":
            datetime_value = attributes.get("datetime")
            if datetime_value:
                self.times.append(datetime_value.strip())
        elif tag == "article":
            self._article_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "article" and self._article_depth:
            self._article_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._article_depth and data.strip():
            self.article_text.append(data.strip())


def parse_post_html(
    html: str,
    post_url: str,
    fallback_image_url: str | None = None,
) -> ParsedPost:
    normalized = normalize_post_url(post_url)
    if normalized is None:
        raise ValueError("post URL is outside the Instagram public post allowlist")
    post_id, canonical_url = normalized

    parser = _PostMetadataParser()
    parser.feed(html)
    description = parser.meta.get("og:description") or parser.meta.get("description")
    article_text = " ".join(parser.article_text)
    caption = (description or article_text).strip()
    image_url = trusted_media_url(parser.meta.get("og:image")) or trusted_media_url(
        parser.images[0] if parser.images else None
    )
    return ParsedPost(
        post_id=post_id,
        post_url=canonical_url,
        caption=caption[:10_000],
        image_url=image_url or trusted_media_url(fallback_image_url),
        taken_at=parser.times[0] if parser.times else None,
    )


def blocked_page_reason(url: str, status_code: int | None, body_text: str) -> str | None:
    if status_code in {401, 403, 429}:
        return f"HTTP_{status_code}"
    if "/accounts/login" in url or "/challenge/" in url:
        return "LOGIN_OR_CHALLENGE"
    normalized = body_text.lower()
    patterns = {
        "LOGIN_WALL": (
            "log in to instagram",
            "sign up to see photos",
            "로그인하여 사진을 확인",
            "로그인해야",
        ),
        "BLOCKED_PAGE": (
            "try again later",
            "sorry, this page isn't available",
            "잠시 후 다시 시도",
            "페이지를 사용할 수 없습니다",
        ),
    }
    for reason, candidates in patterns.items():
        if any(candidate in normalized for candidate in candidates):
            return reason
    return None
