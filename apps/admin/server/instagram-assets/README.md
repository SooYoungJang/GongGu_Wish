# Source assets

- Static intro now lives in `apps/admin/public/instagram/intro-v1.jpg`; exact approved card converted to sRGB JPEG.
- icon.png: existing repo Google Play app icon, resized to120x120 used in card.
- GongguKorean-Regular.otf and GongguKorean-Bold.otf: subsets of NotoSansCJKkr-Regular.otf / Bold.otf from https://github.com/notofonts/noto-cjk/tree/main/Sans/OTF/Korean . SIL OFL in OFL.txt, retained after modification; family renamed Gonggu Korean. Original33,431,108 bytes, subset3,979,364 bytes.
- FontTools subset ranges: U+0020-007E,00A0-024F,1100-11FF,2000-206F,20A0-20CF,3000-303F,3130-318F,A960-A97F,AC00-D7AF,D7B0-D7FF,FF00-FFEF. Includes all Korean Hangul/Jamo; excludes broad CJK/emoji. Shared supported cmap in ../instagram-glyphs.mjs prevents unsupported product names being published as missing-glyph boxes.
