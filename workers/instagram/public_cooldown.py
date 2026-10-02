"""Persist only a retry timestamp, including between Production workflow runs."""

from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile


def parse_cooldown(raw: str) -> datetime | None:
    state = json.loads(raw)
    if not isinstance(state, dict) or set(state) != {"cooldownUntil"}:
        raise ValueError("Invalid cooldown state")
    value = state["cooldownUntil"]
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Invalid cooldown timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Cooldown timestamp must include a timezone")
    return parsed.astimezone(timezone.utc)


def load_cooldown(path: Path) -> datetime | None:
    return parse_cooldown(path.read_text(encoding="utf-8")) if path.exists() else None


def save_cooldown(path: Path, until: datetime | None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps({"cooldownUntil": until.isoformat() if until is not None else None}),
        encoding="utf-8",
    )
    temporary.replace(path)


def cooldown_from_logs(logs: str) -> datetime | None:
    retry_times = []
    for line in logs.splitlines():
        # Unit tests emit synthetic 429s; only the actual collect step counts.
        if "\tCollect into Production\t" not in line:
            continue
        explicit = re.search(r"cooldownUntil=(\S+)", line)
        if explicit:
            retry_times.append(datetime.fromisoformat(explicit[1].replace("Z", "+00:00")))
        elif "HTTP_429" in line:
            stamp = re.search(r"\t(\d{4}-\d\d-\d\dT\S+Z) ", line)
            if stamp:
                blocked_at = datetime.fromisoformat(stamp[1].replace("Z", "+00:00"))
                retry_times.append(blocked_at + timedelta(hours=6))
    return max(retry_times) if retry_times else None


def cooldown_from_job_logs(logs: str, step: dict) -> datetime | None:
    start = datetime.fromisoformat(step["started_at"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(step["completed_at"].replace("Z", "+00:00"))
    if start.tzinfo is None or end.tzinfo is None or end < start:
        raise ValueError("Invalid collection step timestamps")
    # API step times use whole seconds; keep the final second's fractional logs.
    end += timedelta(seconds=1)
    collecting = False
    selected = []
    for line in logs.splitlines():
        line = line.lstrip("\ufeff")
        match = re.match(r"^(\d{4}-\d\d-\d\dT\S+Z) (.*)$", line)
        if not match:
            continue
        stamp = datetime.fromisoformat(match[1].replace("Z", "+00:00"))
        if not start <= stamp < end:
            continue
        if match[2] == "##[group]Run python public_main.py":
            collecting = True
        if collecting:
            selected.append("Job\tCollect into Production\t" + line)
    if not collecting:
        raise ValueError("Cannot identify collection step log boundary")
    return cooldown_from_logs("\n".join(selected))


def restore_production_cooldown(repository: str, run_id: str) -> datetime | None:
    def gh(*args: str) -> bytes:
        result = subprocess.run(["gh", *args], check=True, capture_output=True, timeout=60)
        return result.stdout

    response = json.loads(gh(
        "api", f"repos/{repository}/actions/artifacts?name=instagram-production-cooldown&per_page=100",
    ))
    artifacts = [
        item for item in response["artifacts"]
        if not item["expired"]
        and item.get("workflow_run", {}).get("head_branch") == "main"
        and str(item.get("workflow_run", {}).get("id")) != run_id
    ]
    if artifacts:
        latest = max(artifacts, key=lambda item: item["created_at"])
        archive = gh("api", f"repos/{repository}/actions/artifacts/{latest['id']}/zip")
        with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
            info = zipped.getinfo("instagram-public-cooldown.json")
            if info.file_size > 4096:
                raise ValueError("Cooldown artifact is too large")
            until = parse_cooldown(zipped.read(info).decode("utf-8"))
            if until is not None:
                return until

    # Only manual runs can collect; invalid workflow push runs may have no logs.
    runs = json.loads(gh(
        "api", f"repos/{repository}/actions/workflows/instagram-public-collector.yml/runs?branch=main&event=workflow_dispatch&status=completed&per_page=20",
    ))["workflow_runs"]
    prior = [run for run in runs if str(run["id"]) != run_id]
    if not prior:
        return None
    retry_times = []
    for run in sorted(prior, key=lambda run: run["created_at"], reverse=True):
        jobs = json.loads(gh("api", f"repos/{repository}/actions/runs/{run['id']}/jobs?per_page=100"))["jobs"]
        for job in jobs:
            for step in job.get("steps", []):
                if step["name"] != "Collect into Production" or step.get("conclusion") == "skipped":
                    continue
                if step.get("conclusion") == "cancelled" and not step.get("started_at"):
                    continue
                logs = gh("api", f"repos/{repository}/actions/jobs/{job['id']}/logs").decode("utf-8-sig")
                until = cooldown_from_job_logs(logs, step)
                if until is not None:
                    retry_times.append(until)
    return max(retry_times) if retry_times else None


def main() -> None:
    path = Path(os.environ["INSTAGRAM_PUBLIC_COOLDOWN_FILE"])
    until = restore_production_cooldown(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_RUN_ID"])
    save_cooldown(path, until)
    allowed = until is None or datetime.now(timezone.utc) >= until
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        output.write(f"allowed={str(allowed).lower()}\n")
    print("Instagram cooldown check: allowed=" + str(allowed).lower())
    if not allowed:
        print(f"Instagram 수집 대기: cooldownUntil={until.isoformat()}")


if __name__ == "__main__":
    main()
