"""Pure HTML parsing helpers for the public Instagram Playwright worker."""

from dataclasses import dataclass
from html.parser import HTMLParser
import ipaddress
import re
from urllib.parse import parse_qsl, quote, urlencode, urljoin, urlparse, urlunparse

INSTAGRAM_HOSTS = {"instagram.com", "www.instagram.com"}
INSTAGRAM_LINK_HOST = "l.instagram.com"
TRUSTED_MEDIA_SUFFIXES = ("cdninstagram.com", "fbcdn.net")
TRACKING_QUERY_KEYS = {"dclid", "fbclid", "gclid", "igshid", "mc_cid", "mc_eid"}
# Instagram profile pages may expose post links with the profile username in
# the path (for example, ``/milkable/p/ABC123/``) or in the root form
# (``/p/ABC123/``). Canonicalize both forms to the root post URL below.
POST_PATH_RE = re.compile(r"^/(?:[A-Za-z0-9._]{1,30}/)?(p|reel|tv)/([A-Za-z0-9_-]+)/?$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
TWITTER_TITLE_USERNAME_RE = re.compile(r"\(@([A-Za-z0-9._]{1,30})\)")
HASHTAG_RE = re.compile(r"^[0-9A-Za-z_가-힣]{1,50}$")
RESERVED_PROFILE_SEGMENTS = {
    "about",
    "accounts",
    "challenge",
    "developer",
    "direct",
    "explore",
    "legal",
    "p",
    "privacy",
    "reel",
    "stories",
    "terms",
    "tv",
    "web",
}


@dataclass(frozen=True)
class ProfilePostLink:
    post_id: str
    post_url: str
    image_url: str | None = None


@dataclass(frozen=True)
class ProfileExternalLink:
    url: str
    label: str | None = None


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


def build_hashtag_url(value: str) -> str:
    hashtag = value.strip().lstrip("#")
    if not HASHTAG_RE.fullmatch(hashtag):
        raise ValueError("invalid Instagram discovery hashtag")
    return f"https://www.instagram.com/explore/tags/{quote(hashtag, safe='')}/"


def normalize_profile_url(
    value: str,
    base_url: str = "https://www.instagram.com/",
) -> str | None:
    absolute_url = urljoin(base_url, value)
    parsed = urlparse(absolute_url)
    if parsed.scheme != "https" or parsed.hostname not in INSTAGRAM_HOSTS:
        return None
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) != 1 or segments[0].lower() in RESERVED_PROFILE_SEGMENTS:
        return None
    try:
        return normalize_username(segments[0])
    except ValueError:
        return None


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


def _is_instagram_host(host: str) -> bool:
    return host == "instagram.com" or host.endswith(".instagram.com")


def _is_public_external_host(host: str) -> bool:
    if (
        not host
        or "." not in host
        or host == "localhost"
        or host.endswith((".localhost", ".local", ".internal"))
    ):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True


def normalize_profile_external_url(
    value: str,
    base_url: str = "https://www.instagram.com/",
    *,
    _redirect_depth: int = 0,
) -> str | None:
    if not value or len(value) > 4_096 or _redirect_depth > 2:
        return None
    parsed = urlparse(urljoin(base_url, value.strip()))
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
        return None
    if host == INSTAGRAM_LINK_HOST:
        target = next(
            (item for key, item in parse_qsl(parsed.query) if key == "u"),
            None,
        )
        return (
            normalize_profile_external_url(
                target,
                base_url,
                _redirect_depth=_redirect_depth + 1,
            )
            if target
            else None
        )
    if _is_instagram_host(host) or not _is_public_external_host(host):
        return None

    try:
        port = parsed.port
    except ValueError:
        return None
    canonical_host = host.encode("idna").decode("ascii")
    if ":" in canonical_host:
        canonical_host = f"[{canonical_host}]"
    default_port = (parsed.scheme == "https" and port == 443) or (
        parsed.scheme == "http" and port == 80
    )
    netloc = canonical_host if port is None or default_port else f"{canonical_host}:{port}"
    query = urlencode(
        [
            (key, item)
            for key, item in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.lower().startswith("utm_")
            and key.lower() not in TRACKING_QUERY_KEYS
        ],
        doseq=True,
    )
    normalized = urlunparse(
        (parsed.scheme.lower(), netloc, parsed.path, parsed.params, query, ""),
    )
    return normalized[:2_048] if len(normalized) <= 2_048 else None


class _ProfileExternalLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str | None]] = []
        self._href: str | None = None
        self._label_hint: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a" or self._href is not None:
            return
        attributes = dict(attrs)
        self._href = attributes.get("href")
        self._label_hint = attributes.get("aria-label") or attributes.get("title")
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None and data.strip():
            self._text.append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._href is None:
            return
        label = self._label_hint or " ".join(self._text)
        normalized_label = " ".join(label.split())[:200] if label.strip() else None
        self.links.append((self._href, normalized_label))
        self._href = None
        self._label_hint = None
        self._text = []


def extract_profile_external_links(
    html: str,
    base_url: str = "https://www.instagram.com/",
    limit: int = 5,
) -> list[ProfileExternalLink]:
    if limit <= 0:
        return []
    parser = _ProfileExternalLinkParser()
    parser.feed(html)
    result: list[ProfileExternalLink] = []
    seen: set[str] = set()
    for href, label in parser.links:
        normalized = normalize_profile_external_url(href, base_url)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(ProfileExternalLink(normalized, label))
        if len(result) >= limit:
            break
    return result


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
    limit: int | None = 3,
) -> list[ProfilePostLink]:
    if limit is not None and limit <= 0:
        return []
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
        if limit is not None and len(result) >= limit:
            break
    return result


def extract_discovery_post_links(
    html: str,
    base_url: str = "https://www.instagram.com/",
) -> list[ProfilePostLink]:
    return extract_profile_posts(html, base_url=base_url, limit=None)


class _PostAuthorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._article_depth = 0
        self._main_depth = 0
        self.metadata_usernames: list[str] = []
        self.article_usernames: list[str] = []
        self.main_usernames: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            content = attributes.get("content") or ""
            match = (
                TWITTER_TITLE_USERNAME_RE.search(content)
                if key == "twitter:title"
                else None
            )
            if match:
                username = normalize_username(match.group(1))
                if username not in self.metadata_usernames:
                    self.metadata_usernames.append(username)
            return
        if tag == "main":
            self._main_depth += 1
            return
        if tag == "article":
            self._article_depth += 1
            return
        if tag != "a" or not (self._article_depth or self._main_depth):
            return
        username = normalize_profile_url(attributes.get("href") or "")
        if not username:
            return
        usernames = (
            self.article_usernames if self._article_depth else self.main_usernames
        )
        if username not in usernames:
            usernames.append(username)

    def handle_endtag(self, tag: str) -> None:
        if tag == "article" and self._article_depth:
            self._article_depth -= 1
        elif tag == "main" and self._main_depth:
            self._main_depth -= 1


def extract_post_username(html: str) -> str | None:
    parser = _PostAuthorParser()
    parser.feed(html)
    if len(parser.metadata_usernames) == 1:
        return parser.metadata_usernames[0]
    if parser.article_usernames:
        return parser.article_usernames[0]
    if len(parser.main_usernames) == 1:
        return parser.main_usernames[0]
    return None


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
