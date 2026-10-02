from datetime import datetime, timezone
import io
import json
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
import zipfile

from public_cooldown import cooldown_from_logs, parse_cooldown, restore_production_cooldown


RAW_BLOCKED = (
    "2026-10-02T15:22:51.100000Z HTTP_429 cooldownUntil=2099-01-01T00:00:00+00:00\n"
    "2026-10-02T15:22:51.250000Z ##[group]Run python public_main.py\n"
    "2026-10-02T15:45:19.4273030Z stop=HTTP_429\n"
)


def history_gh(records, artifact_zip=None):
    by_id = {str(record["id"]): record for record in records}

    def gh(args, **kwargs):
        if args[1] == "run":
            record = by_id[args[3]]
            return SimpleNamespace(stdout=("Job\tUNKNOWN STEP\t" + record["logs"]).encode())
        endpoint = args[2]
        if "/artifacts?" in endpoint:
            artifacts = [] if artifact_zip is None else [
                {"id": 80, "created_at": "2026-10-02T18:00:00Z", "expired": False,
                 "workflow_run": {"id": 70, "head_branch": "main"}},
            ]
            payload = {"artifacts": artifacts}
        elif "/artifacts/80/zip" in endpoint:
            return SimpleNamespace(stdout=artifact_zip)
        elif "/runs?" in endpoint:
            payload = {"workflow_runs": [
                {"id": record["id"], "created_at": record["created_at"]} for record in records
            ]}
        elif "/jobs?" in endpoint:
            record = by_id[endpoint.split("/runs/")[1].split("/")[0]]
            payload = {"jobs": [{"id": record["id"], "steps": [
                {"name": "Collect into Production", "conclusion": "success",
                 "started_at": record.get("start", "2026-10-02T15:22:51Z"),
                 "completed_at": record.get("end", "2026-10-02T15:45:19Z")},
            ]}]}
        elif "/jobs/" in endpoint and endpoint.endswith("/logs"):
            logs = by_id[endpoint.split("/jobs/")[1].split("/")[0]]["logs"]
            if "\x1b" in logs and "--allow-escape-sequences" not in args:
                raise subprocess.CalledProcessError(1, args, stderr=b"the response contains terminal escape sequences")
            return SimpleNamespace(stdout=logs.encode())
        else:
            raise AssertionError(f"Unexpected gh request: {args}")
        return SimpleNamespace(stdout=json.dumps(payload).encode())

    return gh


class PublicCooldownTest(unittest.TestCase):
    def test_restores_cooldown_when_other_job_steps_contain_terminal_colors(self):
        records = [{"id": 1, "created_at": "2026-10-02T15:22:00Z", "logs":
                    "2026-10-02T15:20:00Z \x1b[32mDependency installation\x1b[0m\n" + RAW_BLOCKED}]
        with patch("public_cooldown.subprocess.run", side_effect=history_gh(records)):
            until = restore_production_cooldown("owner/repo", "100")
        self.assertEqual(until, datetime(2026, 10, 2, 21, 45, 19, 427303, tzinfo=timezone.utc))

    def test_restores_raw_job_logs_when_cli_step_names_are_unknown(self):
        records = [{"id": 1, "created_at": "2026-10-02T15:22:00Z", "logs": RAW_BLOCKED}]
        with patch("public_cooldown.subprocess.run", side_effect=history_gh(records)):
            until = restore_production_cooldown("owner/repo", "100")
        self.assertEqual(until, datetime(2026, 10, 2, 21, 45, 19, 427303, tzinfo=timezone.utc))

    def test_null_artifact_and_newer_nonblocked_run_keep_older_cooldown(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("instagram-public-cooldown.json", '{"cooldownUntil":null}')
        records = [
            {"id": 2, "created_at": "2026-10-02T17:20:00Z", "start": "2026-10-02T17:20:00Z",
             "end": "2026-10-02T17:21:00Z", "logs": "2026-10-02T17:20:00.100000Z ##[group]Run python public_main.py\n2026-10-02T17:21:00Z posts=0\n"},
            {"id": 1, "created_at": "2026-10-02T15:22:00Z", "logs": RAW_BLOCKED},
        ]
        with patch("public_cooldown.subprocess.run", side_effect=history_gh(records, output.getvalue())):
            until = restore_production_cooldown("owner/repo", "100")
        self.assertEqual(until, datetime(2026, 10, 2, 21, 45, 19, 427303, tzinfo=timezone.utc))

    def test_unidentified_collection_log_boundary_cannot_allow_collection(self):
        records = [{"id": 1, "created_at": "2026-10-02T15:22:00Z", "logs": "2026-10-02T15:45:19Z stop=HTTP_429\n"}]
        with patch("public_cooldown.subprocess.run", side_effect=history_gh(records)):
            with self.assertRaises(ValueError):
                restore_production_cooldown("owner/repo", "100")

    def test_bootstrap_uses_actual_production_429_and_ignores_unit_tests(self):
        logs = (
            "Job\tRun collector unit tests\t2026-10-03T12:00:00Z HTTP_429\n"
            "Job\tCollect into Production\t2026-10-03T00:45:19.409Z stop=HTTP_429\n"
        )
        self.assertEqual(
            cooldown_from_logs(logs),
            datetime(2026, 10, 3, 6, 45, 19, 409000, tzinfo=timezone.utc),
        )

    def test_explicit_retry_timestamp_overrides_default_bootstrap_wait(self):
        logs = "Job\tCollect into Production\t2026-10-03T00:00:00Z HTTP_429 cooldownUntil=2026-10-03T08:00:00+00:00"
        self.assertEqual(cooldown_from_logs(logs), datetime(2026, 10, 3, 8, tzinfo=timezone.utc))

    def test_bootstrap_excludes_invalid_workflow_push_runs_without_logs(self):
        runs = [
            {"id": 200, "event": "push", "created_at": "2026-10-03T02:00:00Z"},
            {"id": 199, "event": "workflow_dispatch", "created_at": "2026-10-03T01:00:00Z"},
        ]

        def gh(args, **kwargs):
            if args[1] == "api":
                if "/artifacts?" in args[2]:
                    return SimpleNamespace(stdout=b'{"artifacts":[]}')
                if "/jobs?" in args[2]:
                    return SimpleNamespace(stdout=json.dumps({"jobs": [{"id": 199, "steps": [
                        {"name": "Collect into Production", "conclusion": "success",
                         "started_at": "2026-10-03T00:45:00Z", "completed_at": "2026-10-03T00:45:19Z"},
                    ]}]}).encode())
                if "/jobs/199/logs" in args[2]:
                    return SimpleNamespace(stdout=b"2026-10-03T00:45:00.100000Z ##[group]Run python public_main.py\n2026-10-03T00:45:19Z stop=HTTP_429\n")
                event = parse_qs(urlsplit(args[2]).query).get("event", [None])[0]
                selected = [run for run in runs if event is None or run["event"] == event]
                return SimpleNamespace(stdout=json.dumps({"workflow_runs": selected}).encode())
            if args[3] == "200":
                raise subprocess.CalledProcessError(1, args, stderr=b"log not found")
            self.assertEqual(args[3], "199")
            return SimpleNamespace(stdout=b"Job\tCollect into Production\t2026-10-03T00:45:19Z stop=HTTP_429\n")

        with patch("public_cooldown.subprocess.run", side_effect=gh):
            until = restore_production_cooldown("owner/repo", "201")
        self.assertEqual(until, datetime(2026, 10, 3, 6, 45, 19, tzinfo=timezone.utc))

    def test_restores_timestamp_from_the_latest_main_artifact_only(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr("instagram-public-cooldown.json", '{"cooldownUntil":"2026-10-03T08:00:00+00:00"}')
        artifacts = {"artifacts": [
            {"id": 1, "created_at": "2026-10-03T00:00:00Z", "expired": False,
             "workflow_run": {"id": 100, "head_branch": "main"}},
            {"id": 2, "created_at": "2026-10-03T01:00:00Z", "expired": False,
             "workflow_run": {"id": 101, "head_branch": "develop"}},
        ]}
        with patch("public_cooldown.subprocess.run", side_effect=[
            SimpleNamespace(stdout=json.dumps(artifacts).encode()),
            SimpleNamespace(stdout=output.getvalue()),
        ]) as gh:
            until = restore_production_cooldown("owner/repo", "102")
        self.assertEqual(until, datetime(2026, 10, 3, 8, tzinfo=timezone.utc))
        self.assertIn("repos/owner/repo/actions/artifacts/1/zip", gh.call_args_list[1].args[0])

    def test_cooldown_read_failure_never_becomes_permission_to_collect(self):
        with patch("public_cooldown.subprocess.run", side_effect=subprocess.CalledProcessError(1, ["gh"])):
            with self.assertRaises(subprocess.CalledProcessError):
                restore_production_cooldown("owner/repo", "102")

    def test_state_rejects_untyped_or_timezone_free_values(self):
        for raw in ('{}', '[]', '{"cooldownUntil":5}', '{"cooldownUntil":"2026-10-03T08:00:00"}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                parse_cooldown(raw)
        self.assertIsNone(parse_cooldown('{"cooldownUntil":null}'))


if __name__ == "__main__":
    unittest.main()
