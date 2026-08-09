from dataclasses import dataclass
import os
from typing import Mapping
from urllib.parse import urlparse


PREVIEW_SUPABASE_ORIGIN = "https://xwblovggtvbpiusjfokq.supabase.co"
PRODUCTION_SUPABASE_ORIGIN = "https://iosdoheblabfimkjnvfj.supabase.co"
LOCAL_API_ORIGIN = "http://127.0.0.1:3000"
COLLECTOR_FUNCTION = "/functions/v1/instagram-public-collector"


@dataclass(frozen=True)
class CollectionTarget:
    name: str
    endpoint: str
    transport: str


def _is_true(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes"}


def _local_api_endpoint(env: Mapping[str, str]) -> str:
    raw_origin = (env.get("API_INTERNAL_BASE_URL") or LOCAL_API_ORIGIN).strip()
    parsed = urlparse(raw_origin)
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/", "/api/v1"}
    ):
        raise RuntimeError(
            "local target requires API_INTERNAL_BASE_URL to be a local Nest API origin."
        )

    endpoint = raw_origin.rstrip("/")
    if not endpoint.endswith("/api/v1"):
        endpoint = f"{endpoint}/api/v1"
    return endpoint


def resolve_collection_target(
    env: Mapping[str, str] | None = None,
) -> CollectionTarget:
    values = os.environ if env is None else env
    name = (values.get("INSTAGRAM_COLLECTION_TARGET") or "preview").strip().lower()

    if name == "local":
        return CollectionTarget(name, _local_api_endpoint(values), "nest_api")

    if name == "preview":
        origin = PREVIEW_SUPABASE_ORIGIN
    elif name == "production":
        if not _is_true(values.get("INSTAGRAM_ALLOW_PRODUCTION_WRITES")):
            raise RuntimeError(
                "Production writes require INSTAGRAM_ALLOW_PRODUCTION_WRITES=true."
            )
        if not _is_true(values.get("INSTAGRAM_PRODUCTION_PREFLIGHT_PASSED")):
            raise RuntimeError(
                "Production writes require the worker preflight to pass first."
            )
        origin = PRODUCTION_SUPABASE_ORIGIN
    else:
        raise RuntimeError(
            "INSTAGRAM_COLLECTION_TARGET must be local, preview, or production."
        )

    return CollectionTarget(
        name,
        f"{origin}{COLLECTOR_FUNCTION}",
        "supabase_function",
    )
