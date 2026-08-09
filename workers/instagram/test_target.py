import unittest

from target import resolve_collection_target


class CollectionTargetTest(unittest.TestCase):
    def test_defaults_to_preview_edge_function(self):
        target = resolve_collection_target({})

        self.assertEqual(target.name, "preview")
        self.assertEqual(
            target.endpoint,
            "https://xwblovggtvbpiusjfokq.supabase.co/functions/v1/instagram-public-collector",
        )
        self.assertEqual(target.transport, "supabase_function")

    def test_local_target_requires_local_api_origin(self):
        target = resolve_collection_target(
            {
                "INSTAGRAM_COLLECTION_TARGET": "local",
                "API_INTERNAL_BASE_URL": "http://127.0.0.1:3000",
            }
        )

        self.assertEqual(target.name, "local")
        self.assertEqual(target.endpoint, "http://127.0.0.1:3000/api/v1")
        self.assertEqual(target.transport, "nest_api")

    def test_production_requires_explicit_write_gate(self):
        with self.assertRaisesRegex(RuntimeError, "Production writes"):
            resolve_collection_target({"INSTAGRAM_COLLECTION_TARGET": "production"})

    def test_production_uses_fixed_origin_after_gate(self):
        target = resolve_collection_target(
            {
                "INSTAGRAM_COLLECTION_TARGET": "production",
                "INSTAGRAM_ALLOW_PRODUCTION_WRITES": "true",
                "INSTAGRAM_PRODUCTION_PREFLIGHT_PASSED": "true",
                "API_INTERNAL_BASE_URL": "https://attacker.example",
            }
        )

        self.assertEqual(target.name, "production")
        self.assertEqual(
            target.endpoint,
            "https://iosdoheblabfimkjnvfj.supabase.co/functions/v1/instagram-public-collector",
        )
        self.assertEqual(target.transport, "supabase_function")

    def test_production_requires_worker_preflight(self):
        with self.assertRaisesRegex(RuntimeError, "preflight"):
            resolve_collection_target(
                {
                    "INSTAGRAM_COLLECTION_TARGET": "production",
                    "INSTAGRAM_ALLOW_PRODUCTION_WRITES": "true",
                }
            )

    def test_rejects_unknown_target(self):
        with self.assertRaisesRegex(RuntimeError, "INSTAGRAM_COLLECTION_TARGET"):
            resolve_collection_target({"INSTAGRAM_COLLECTION_TARGET": "staging"})


if __name__ == "__main__":
    unittest.main()
