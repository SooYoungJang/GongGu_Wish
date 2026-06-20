#!/usr/bin/env python3
"""Post Critic Review to QA thread."""
import json, os, urllib.request

def main():
    token_path = os.path.expanduser("~/.hermes/profiles/critic/.env")
    # Read token directly
    token = None
    with open(token_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DISCORD_BOT_TOKEN="):
                token = line.split("=", 1)[1].strip().strip("'\"")
                break
    
    if not token:
        print("ERROR: DISCORD_BOT_TOKEN not found")
        return 1
    
    print(f"Token loaded: {len(token)} chars")
    
    thread_id = "1517857750208483452"
    
    content = """[Critic Review] <@871440961216061471> Verdict: **APPROVE** (scope-limited -- code/test gate)

### Critical Findings
None.

### Evidence checked & independently re-verified (2026-06-20 22:58 KST)
**QA thread evidence** -- QA\uac00 \uc774\uc804 NEEDS EVIDENCE\uc5d0 \ub300\uc751\ud558\uc5ec 3\uc885 \uc99d\uac70 reply\ub97c \uac8c\uc2dc:
- `npx turbo run typecheck --filter=@gonggu/mobile` \u2192 Tasks 2 successful / 2 total, FULL TURBO
- apps/mobile `npx vitest run` \u2192 5 files / 36 tests PASS
- `npx vitest run apps/mobile/src/screens/HomeScreen.redesign.test.tsx` \u2192 1 file / 4 tests PASS
- \uc774\uc804 3\uac1c \uc774\uc288 \ucf54\ub4dc \ub77c\uc778 \ub9e4\ud551 \ubc0f \ub124\uc774\ud2f0\ube0c \uc2dc\uac01 \uac80\uc218 \ud55c\uacc4 \ubb38\uc11c\ud654

**Independent re-run (this session):**
- mobile typecheck: 2/2 successful, FULL TURBO \u2705
- mobile vitest run: 5 files / 36 tests PASS \u2705
- HomeScreen.redesign.test.tsx: 1 file / 4 tests PASS \u2705

**Code verification -- previous 3 issues:**
1. **\uc911\ubcf5 \ud0ed\ubc14** -- `HomeScreenContent`(line 310-370)\ub294 FlatList\ub85c `HomeHeader`/`SearchBar`/`CategoryRow`/`DealCardGrid`/`FloatingCalendarCTA`\ub9cc \ub80c\ub354\ub9c1. tab \uad00\ub828 role/appearance 0\uac74. App-level `MainTabs`\uac00 \uc720\uc77c\ud55c tab owner. RESOLVED \u2705
2. **\uce74\ud14c\uace0\ub9ac \uc6d0\ud615 \uc544\uc774\ucf58+\ub77c\ubca8** -- `CategoryIcon`(line 186-199): glyph + label \ud568\uaed8 \ub80c\ub354\ub9c1. Style `categoryItem`(line 493-504): `aspectRatio:1`, `borderRadius: borderRadius.full`, `minHeight:76`, `minWidth:76`. RESOLVED \u2705
3. **SafeArea \ud558\ub2e8 CTA** -- `FloatingCalendarCTA`(line 256-268): `position:absolute`, `bottom:86+bottomInset`. `SafeAreaView edges=['top','bottom']`(line 331), `useSafeAreaInsets()`(line 328), list `paddingBottom+insets.bottom`(line 364). RESOLVED \u2705

### QA Gaps
- **\ub124\uc774\ud2f0\ube0c iOS/Android \uc2dc\uac01 \ud53d\uc140 \uac80\uc99d \ubbf8\uc218\ud589** -- Expo Web\uc73c\ub85c\ub294 \ub124\uc774\ud2f0\ube0c \ub80c\ub354\ub9c1(\ud3f0\ud2b8/\ub808\uc774\uc544\uc6c3/\uadf8\ub9bc\uc790/SafeArea diff)\uc744 \uc644\uc804\ud788 \uac80\uc99d\ud560 \uc218 \uc5c6\uc74c. QA\uac00 \uc774 \ud55c\uacc4\ub97c \uba85\uc2dc\uc801\uc73c\ub85c \ubb38\uc11c\ud654\ud588\uc73c\ubbcc\ub85c, \ud604\uc7ac scoped code/test gate\uc5d0\uc11c\ub294 evidence-integrity blocker\ub85c \ubcf4\uc9c0 \uc54a\uc74c.
- **\ub8e8\ud2b8 \uba85\ub839\uc5b4\ub294 \ud074\ub9b0\ud558\uc9c0 \uc54a\uc74c** -- root `npx tsc --noEmit`, root `npx vitest run`\uc740 web/storybook/jsdom unrelated \uc2e4\ud328 \uc874\uc7ac. \uc774 \uc0c1\ud0dc\ub97c "\uc804\uccb4 repo PASS"\ub85c \ub300\ud45c\ud558\uc9c0 \ub9d0 \uac83.

### Regression Risks
- `FloatingCalendarCTA` absolute positioning + bottom tab (navigation tab bar) \uc911\ucca9\uc740 \uc2e4\uc81c iOS/Android \uc791\uc740 \ud654\uba74, large-font/accessibility \uc124\uc815\uc5d0\uc11c \ud655\uc778 \ud544\uc694. \ud604\uc7ac Expo Web \ud658\uacbd\uc5d0\uc11c\ub294 \uac80\uc99d \ubd88\uac00.
- `MainTabs` Home/Submit \ub124\ube44\uac8c\uc774\uc158\uc740 \uc2e4\uc81c \ub514\ubc14\uc774\uc2a4/\uc2dc\ubbac\ub808\uc774\ud130\uc5d0\uc11c smoke test \ud544\uc694.

### Required Next Step
No Dev change required for the three previously challenged findings. Proceed as **scoped mobile HomeScreen code/test approval**; create a separate native-device QA task (iOS simulator + Android emulator or physical device) before asserting full native visual approval for release."""

    req = urllib.request.Request(
        f"https://discord.com/api/v10/channels/{thread_id}/messages",
        data=json.dumps({"content": content}).encode(),
        headers={
            "Authorization": f"Bot {token}",
            "Content-Type": "application/json",
            "User-Agent": "HermesCritic/1.0"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.load(r)
            print(f"POSTED message_id: {data.get('id')}")
            print("SUCCESS")
            return 0
    except urllib.error.HTTPError as e:
        print(f"HTTPError {e.code}: {e.read().decode()}")
        return 1
    except Exception as e:
        print(f"ERROR: {repr(e)}")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
