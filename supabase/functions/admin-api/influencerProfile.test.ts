import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  hasInstagramOwnerChanged,
  normalizeInstagramUsername,
  normalizeProfileImageUrl,
  parseInstagramUsernameWrite,
  parseProfileImageWriteIntent,
  resolveCanonicalProfileImageWriteIntent,
} from "./influencerProfile.ts";

Deno.test("normalizeInstagramUsername stores a canonical account key", () => {
  assertEquals(
    normalizeInstagramUsername("  @GongGu.Creator  "),
    "gonggu.creator",
  );
  assertEquals(normalizeInstagramUsername("@"), null);
  assertEquals(normalizeInstagramUsername("unknown"), null);
  assertEquals(
    normalizeInstagramUsername("seller,or=(is_admin.eq.true)"),
    null,
  );
  assertEquals(normalizeInstagramUsername(null), null);
});

Deno.test(
  "parseInstagramUsernameWrite rejects non-empty invalid handles",
  () => {
    assertEquals(parseInstagramUsernameWrite("  @Seller.One  "), "seller.one");
    assertEquals(parseInstagramUsernameWrite(" @ "), null);
    assertEquals(parseInstagramUsernameWrite("UNKNOWN"), null);

    let message = "";
    try {
      parseInstagramUsernameWrite("seller,or=(is_admin.eq.true)");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assertEquals(message, "instagramUsername must be a valid Instagram handle");
  },
);

Deno.test(
  "normalizeProfileImageUrl accepts only trusted Instagram CDN URLs",
  () => {
    assertEquals(
      normalizeProfileImageUrl(
        " https://scontent-test.cdninstagram.com/profile.jpg ",
      ),
      "https://scontent-test.cdninstagram.com/profile.jpg",
    );
    assertEquals(normalizeProfileImageUrl("javascript:alert(1)"), null);
    assertEquals(
      normalizeProfileImageUrl("https://cdn.example.com/profile.jpg"),
      null,
    );
    assertEquals(
      normalizeProfileImageUrl("http://fbcdn.net/profile.jpg"),
      null,
    );
    assertEquals(
      normalizeProfileImageUrl("https://cdninstagram.com:444/profile.jpg"),
      null,
    );
    assertEquals(normalizeProfileImageUrl("not-a-url"), null);
    assertEquals(normalizeProfileImageUrl(null), null);
  },
);

Deno.test(
  "parseProfileImageWriteIntent distinguishes preserve, clear, and invalid input",
  () => {
    assertEquals(parseProfileImageWriteIntent(undefined, false), {
      shouldUpdate: false,
      profileImageUrl: null,
    });
    assertEquals(parseProfileImageWriteIntent("  ", true), {
      shouldUpdate: true,
      profileImageUrl: null,
    });
    assertEquals(
      parseProfileImageWriteIntent(
        "https://scontent-test.cdninstagram.com/profile.jpg",
        true,
      ),
      {
        shouldUpdate: true,
        profileImageUrl: "https://scontent-test.cdninstagram.com/profile.jpg",
      },
    );

    let message = "";
    try {
      parseProfileImageWriteIntent("not-a-url", true);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assertEquals(
      message,
      "profileImageUrl must be a trusted Instagram CDN URL",
    );
  },
);

Deno.test("hasInstagramOwnerChanged compares canonical account keys", () => {
  assertEquals(hasInstagramOwnerChanged("@Seller.One", "seller.one"), false);
  assertEquals(hasInstagramOwnerChanged("seller_a", "seller_b"), true);
  assertEquals(hasInstagramOwnerChanged(null, "seller_b"), true);
  assertEquals(hasInstagramOwnerChanged("seller_a", null), true);
  assertEquals(hasInstagramOwnerChanged(null, null), false);
});

Deno.test(
  "owner changes clear stale form data without wiping the new canonical avatar",
  () => {
    assertEquals(resolveCanonicalProfileImageWriteIntent("", true, true), {
      shouldUpdate: false,
      profileImageUrl: null,
    });
    assertEquals(resolveCanonicalProfileImageWriteIntent("", true, false), {
      shouldUpdate: true,
      profileImageUrl: null,
    });
    assertEquals(
      resolveCanonicalProfileImageWriteIntent(
        "https://scontent-test.cdninstagram.com/new-owner.jpg",
        true,
        true,
      ),
      {
        shouldUpdate: true,
        profileImageUrl: "https://scontent-test.cdninstagram.com/new-owner.jpg",
      },
    );
  },
);
