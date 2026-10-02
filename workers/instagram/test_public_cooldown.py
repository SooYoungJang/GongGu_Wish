from datetime import datetime, timezone
import io
import json
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

from public_cooldown import cooldown_from_logs, parse_cooldown, restore_production_cooldown


class PublicCooldownTest(unittest.TestCase):
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
