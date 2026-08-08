import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from apscheduler.schedulers.blocking import BlockingScheduler
from dotenv import load_dotenv
from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    ChallengeRequired,
    ClientThrottledError,
    FeedbackRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
    TwoFactorRequired,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("instagram-worker")

API_BASE_URL = os.getenv("API_INTERNAL_BASE_URL", "http://localhost:3000")
SESSION_FILE = Path(os.getenv("INSTAGRAM_SESSION_FILE", "workers/instagram/session.json"))
POLL_INTERVAL_SECONDS = int(os.getenv("INSTAGRAM_POLL_INTERVAL_SECONDS", "900"))
PROXY_URL = os.getenv("INSTAGRAM_PROXY_URL")
TWO_FACTOR_SECRET = os.getenv("INSTAGRAM_2FA_SECRET")  # For TOTP-based 2FA
COLLECTOR_TOKEN = os.getenv("INSTAGRAM_COLLECTOR_TOKEN")
COLLECTOR_HEADERS = {"X-Collector-Token": COLLECTOR_TOKEN} if COLLECTOR_TOKEN else {}


def isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()

    return value.isoformat()


def get_totp_code(secret: str) -> str:
    """Generate TOTP code for 2FA."""
    import base64
    import hmac
    import struct
    
    key = base64.b32decode(secret, casefold=True)
    counter = int(time.time() // 30)
    msg = struct.pack(">Q", counter)
    hmac_digest = hmac.new(key, msg, "sha1").digest()
    offset = hmac_digest[-1] & 0x0F
    code = (struct.unpack(">I", hmac_digest[offset:offset+4])[0] & 0x7FFFFFFF) % 1000000
    return f"{code:06d}"


def setup_client_device(client: Client) -> None:
    """Configure client with realistic device settings for Korean locale."""
    client.set_device({
        "app_version": "284.0.0.19.110",
        "android_version": 33,
        "android_release": "13",
        "dpi": "420dpi",
        "resolution": "1080x2340",
        "manufacturer": "Samsung",
        "device": "SM-S908B",
        "model": "Galaxy S22 Ultra",
        "cpu": "exynos2200",
        "version_code": "339698477",
    })
    client.set_locale("ko_KR")
    client.set_country("KR")
    client.set_country_code(82)
    client.delay_range = [2, 5]


def handle_challenge(client: Client, username: str) -> bool:
    """Handle Instagram challenge (2FA, email/SMS verification)."""
    try:
        # Check if we have TOTP secret for automated 2FA
        if TWO_FACTOR_SECRET and client.last_json.get("step_data", {}).get("choice") == "0":
            # Choice 0 is usually authenticator app (TOTP)
            code = get_totp_code(TWO_FACTOR_SECRET)
            logger.info("Using TOTP code for 2FA")
            client.challenge_resolve(client.last_json, code)
            return True
        
        # For other challenge types (SMS, email), we need manual intervention
        logger.warning("Manual challenge required. Check your email/SMS for code.")
        logger.warning("Challenge JSON: %s", client.last_json)
        return False
    except Exception as e:
        logger.exception("Failed to handle challenge: %s", e)
        return False


def make_client() -> Client:
    username = os.getenv("INSTAGRAM_USERNAME")
    password = os.getenv("INSTAGRAM_PASSWORD")

    if not username or not password:
        raise RuntimeError("INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD are required")

    client = Client()
    setup_client_device(client)

    if PROXY_URL:
        logger.info("Using proxy: %s", PROXY_URL)
        client.set_proxy(PROXY_URL)
        # Verify proxy is working
        try:
            before_ip = client._send_public_request("https://api.ipify.org/", timeout=10)
            logger.info("IP before proxy: %s", before_ip)
        except Exception:
            logger.warning("Could not verify IP before proxy")

    # Load session if exists
    if SESSION_FILE.exists():
        logger.info("Loading Instagram session from %s", SESSION_FILE)
        try:
            client.load_settings(str(SESSION_FILE))
            # Verify session is still valid with a lightweight request
            client.get_timeline_feed()
            logger.info("Session loaded and validated successfully")
            return client
        except (LoginRequired, FeedbackRequired, PleaseWaitFewMinutes, ClientThrottledError) as e:
            logger.warning("Session invalid or expired: %s. Will re-login.", e)
        except Exception as e:
            logger.warning("Failed to load/validate session: %s. Will re-login.", e)

    # Fresh login with retry logic
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info("Attempting login (attempt %d/%d)", attempt + 1, max_retries)
            client.login(username, password)
            logger.info("Login successful")
            break
        except TwoFactorRequired:
            logger.info("Two-factor authentication required")
            if TWO_FACTOR_SECRET:
                code = get_totp_code(TWO_FACTOR_SECRET)
                logger.info("Using TOTP for 2FA")
                client.login(username, password, verification_code=code)
                logger.info("2FA login successful")
                break
            else:
                logger.error("2FA required but INSTAGRAM_2FA_SECRET not configured")
                raise
        except ChallengeRequired:
            logger.info("Challenge required")
            if handle_challenge(client, username):
                logger.info("Challenge resolved")
                break
            else:
                logger.error("Could not resolve challenge automatically")
                raise
        except BadPassword as e:
            logger.error("Bad password or IP blocked: %s", e)
            if "blacklist" in str(e).lower() or "blocked" in str(e).lower():
                logger.error("IP appears to be blacklisted by Instagram. A proxy (INSTAGRAM_PROXY_URL) is required.")
            if attempt == max_retries - 1:
                raise
            time.sleep(5 * (attempt + 1))  # Exponential backoff
        except (ClientThrottledError, PleaseWaitFewMinutes) as e:
            logger.warning("Rate limited: %s. Waiting before retry...", e)
            if attempt == max_retries - 1:
                raise
            time.sleep(30 * (attempt + 1))
        except Exception as e:
            logger.exception("Unexpected error during login: %s", e)
            if attempt == max_retries - 1:
                raise
            time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError("Failed to login after all retries")

    # Save session
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    client.dump_settings(str(SESSION_FILE))
    logger.info("Session saved to %s", SESSION_FILE)
    return client


def fetch_influencers() -> list[dict[str, Any]]:
    response = requests.get(f"{API_BASE_URL}/influencers", timeout=15)
    response.raise_for_status()
    return response.json()


def image_url(media: Any) -> str | None:
    if getattr(media, "thumbnail_url", None):
        return str(media.thumbnail_url)

    resources = getattr(media, "resources", None) or []
    for resource in resources:
        if getattr(resource, "thumbnail_url", None):
            return str(resource.thumbnail_url)

    return None


def collect_media(username: str, client: Client, amount: int = 12) -> None:
    user_id = client.user_id_from_username(username)
    medias = client.user_medias(user_id, amount=amount)
    logger.info("fetched %s recent posts for @%s", len(medias), username)

    for media in medias:
        caption = media.caption_text or ""
        post_code = media.code
        payload = {
            "instagramPostId": str(media.pk),
            "influencerUsername": username,
            "caption": caption,
            "postUrl": f"https://www.instagram.com/p/{post_code}/",
            "imageUrl": image_url(media),
            "takenAt": isoformat(media.taken_at),
            "collectedAt": datetime.now(timezone.utc).isoformat(),
        }

        response = requests.post(
            f"{API_BASE_URL}/raw-posts/collect",
            json=payload,
            headers=COLLECTOR_HEADERS,
            timeout=15,
        )
        response.raise_for_status()
        result = response.json()
        logger.info(
            "collected @%s %s created=%s duplicate=%s caption_hash=%s",
            username,
            post_code,
            result.get("created"),
            result.get("duplicate"),
            hashlib.sha256(caption.encode("utf-8")).hexdigest()[:8],
        )


def run_once() -> None:
    client = make_client()
    influencers = fetch_influencers()

    for influencer in influencers:
        username = influencer["instagramUsername"]
        try:
            collect_media(username, client)
        except Exception:
            logger.exception("failed to collect @%s", username)


def main() -> None:
    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        run_once,
        "interval",
        seconds=POLL_INTERVAL_SECONDS,
        next_run_time=datetime.now(),
    )
    logger.info("Instagram worker started. interval=%ss", POLL_INTERVAL_SECONDS)
    scheduler.start()


if __name__ == "__main__":
    main()
