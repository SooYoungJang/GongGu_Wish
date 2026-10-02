"""Temporary read-only diagnosis; removed before merging the runtime fix."""

import json
import os
import subprocess

from public_cooldown import cooldown_from_logs


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, timeout=60).stdout.decode("utf-8")


repository = os.environ["GITHUB_REPOSITORY"]
run_id = "37026344118"
jobs = json.loads(gh("api", f"repos/{repository}/actions/runs/{run_id}/jobs?per_page=100"))["jobs"]
logs = gh("run", "view", run_id, "--repo", repository, "--log")
lines = logs.splitlines()
collect = [line for line in lines if "\tCollect into Production\t" in line]
until = cooldown_from_logs(logs)
print(json.dumps({
    "ghVersion": gh("--version").splitlines()[0],
    "runId": run_id,
    "lines": len(lines),
    "collectLines": len(collect),
    "unknownStepLines": sum("\tUNKNOWN STEP\t" in line for line in lines),
    "all429Lines": sum("HTTP_429" in line for line in lines),
    "collect429Lines": sum("HTTP_429" in line for line in collect),
    "parsedCooldown": until.isoformat() if until else None,
    "collectSteps": [
        {"jobId": job["id"], "name": step["name"], "startedAt": step.get("started_at"), "completedAt": step.get("completed_at")}
        for job in jobs for step in job.get("steps", []) if step["name"] == "Collect into Production"
    ],
}, ensure_ascii=False))
