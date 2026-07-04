# 모바일 디자인 시스템 (필수 가이드)

이 문서는 apps/mobile 에서 UI를 구현할 때 반드시 따라야 할 규칙을 정의한다.
디자인 토큰, 테마 훅, 재사용 컴포넌트는 이미 갖춰져 있으므로 새로 만들지 말고 기존 것을 사용한다.

---

## 핵심 원칙

1. 색상은 절대 하드코딩하지 않는다. useCommerceTheme() 으로 받은 colors 객체에서 가져온다.
2. 간격, 라운드, 그림자, 타이포그래피도 토큰 객체에서 가져온다. 매직 넘버를 직접 적지 않는다.
3. 텍스트는 항상 SText variant 를 사용한다. 원시 Text 를 새로 쓰지 않는다.
4. 새 UI 블록(카드, 칩, 섹션 타이틀, 검색 필드)을 만들기 전에 components/commerce/ 의 재사용 컴포넌트를 먼저 확인한다.
5. 라이트/다크 모드는 자동으로 처리된다. 토큰을 쓰면 별도 분기 없이 두 모드가 동작한다.

---

## 진입점: useCommerceTheme()

위치: src/design/useCommerceTheme.ts

모든 화면과 컴포넌트에서 테마에 접근하는 공식 훅이다. useTheme() 을 감싸서 커머스 토큰을 한 번에 내려주므로, 컴포넌트에서는 이 훅만 쓰면 된다.

```tsx
import { useCommerceTheme } from '../design/useCommerceTheme';

function MyCard() {
  const { colors, radius, spacing, typography, shadow, isDark } = useCommerceTheme();
  // colors.bg, colors.accent, radius.lg, spacing.md ...
}
```

반환값:

- colors — 라이트/다크 자동 전환되는 색상 팔레트 (CommerceColorPalette)
- radius — commerceRadius 토큰 (xs/sm/md/lg/xl/xxl/full)
- spacing — commerceSpacing 토큰 (xxs~xxl, screen, section, cardGap, tabBarHeight)
- typography — commerceTypography 토큰 (pageTitle, sectionTitle, tabLabel, bodyStrong, meta, badge)
- shadow — 라이트/다크 자동 전환 그림자
- isDark, themeMode, setThemeMode, toggleTheme — 테마 상태 제어

이미 60개 이상의 컴포넌트가 이 훅을 사용하고 있으므로, 새 코드도 같은 패턴을 따른다.

---

## 디자인 토큰

위치: src/design/commerce.ts

### 색상 (CommerceColorPalette)

라이트/다크 두 팔레트가 있고 getCommerceColors(isDark) 로 전환된다. 훅을 쓰면 자동이므로 직접 호출할 일은 거의 없다. 주요 토큰:

- 캔버스: bg, surface, softBg, panelBg, cardBg
- 보더: border, borderLight, divider
- 텍스트: text, muted, weak, disabled, inverse
- 액센트: accent, accentDark, accentLight, accentSoft
- 시맨틱: blue, blueSoft, yellow, success, successSoft, warning, warningSoft, error, errorSoft
- 기타: overlay, tabInactive, bottomBarBg, bottomBarBorder, skeleton

### radius / spacing / typography / shadow

```ts
commerceRadius     = { xs:6, sm:8, md:12, lg:16, xl:20, xxl:24, full:999 }
commerceSpacing    = { xxs:2, xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, screen:16, section:34, cardGap:12, tabBarHeight:82 }
commerceTypography = { pageTitle, sectionTitle, tabLabel, bodyStrong, meta, badge }
commerceShadow / commerceDarkShadow
```

### 레거시 토큰 (참고용)

src/design/tokens.ts 의 colors, spacing, borderRadius, typography 는 구세대 토큰이다. useCommerceTheme() 이 커머스 토큰으로 오버라이드한 값을 내려주므로, 새 코드는 커머스 토큰을 직접 사용한다. SText 등 기존 컴포넌트가 내부적으로 구세대 typography 를 참조하는 경우는 그대로 둔다.

---

## 텍스트: SText

위치: src/components/ui/SText.tsx

모든 텍스트는 SText variant 로 렌더링한다. variant 별 타이포그래피와 색상이 자동 적용되며, style 로 오버라이드할 수 있다.

```tsx
import { SText } from '../components/ui/SText';

<SText variant="title">제목</SText>
<SText variant="body">본문</SText>
<SText variant="badge" style={{ color: colors.accent }}>할인</SText>
```

variant 목록: eyebrow, title, subtitle, cardTitle, cardBrand, cardSummary, body, caption, label, badge, button

새로운 variant가 필요하면 SText 에 추가하기 전에, 기존 variant 중 재사용 가능한 것이 있는지 먼저 확인한다.

---

## 재사용 컴포넌트: components/commerce/

위치: src/components/commerce/CommerceUI.tsx, barrel: src/components/commerce/index.ts

```tsx
import { CommerceSurface, CommerceCard, CommerceChip, CommerceSectionTitle, CommerceSearchField } from '../components/commerce';
```

| 컴포넌트 | 용도 | 주요 props |
|---|---|---|
| CommerceSurface | 화면 루트 캔버스 (전체 배경, flex:1) | children, style |
| CommerceCard | 카드 컨테이너 (보더 + 그림자 + 라운드) | children, style |
| CommerceChip | 선택형 칩/태그 (카테고리, 필터) | label, selected, onPress |
| CommerceSectionTitle | 섹션 제목 + 우측 액션 | children, variant, right |
| CommerceSearchField | 검색 입력 필드 | value, onChangeText, placeholder |

새 카드, 칩, 검색 필드, 섹션 타이틀을 만들기 전에 이 컴포넌트들로 해결되는지 먼저 확인한다. 스타일 커스터마이징은 새 컴포넌트를 복제하지 말고 style prop 으로 처리한다.

---

## 랭킹 도메인 컴포넌트: components/ranking/

위치: src/components/ranking/index.ts

셀러 랭킹 UI 전용 컴포넌트들이 barrel로 묶여 있다. FollowButton, RankBadge, RankingCategoryChips, RankingTabs, RankingTrendBadge, SellerRankingList, SellerRankingRow, ThumbnailStrip. 랭킹 화면을 다룰 때는 이 컴포넌트를 사용한다.

---

## 아이콘

위치: src/components/ui/LineGlyphs.tsx

SearchGlyph, CrownGlyph 등 라인 아이콘이 있다. 새 아이콘을 직접 그리기 전에 같은 스타일의 라인 글리프로 커버되는지 확인한다.

---

## 금지 사항

- 색상 하드코딩: '#FFFFFF', '#F0445E' 등을 스타일에 직접 적지 않는다. colors.bg, colors.accent 를 쓴다.
- 매직 넘버: borderRadius: 16, padding: 12 등을 직접 적지 않는다. radius.lg, spacing.md 를 쓴다.
- 원시 Text: 새 텍스트에 Text 를 직접 쓰지 않는다. SText variant 를 쓴다.
- 컴포넌트 복제: CommerceCard 와 비슷한 카드를 새로 만들지 않는다. style 로 확장한다.
- 구세대 토큰 직접 import: colors 를 ../design/tokens 에서 새 코드로 가져오지 않는다. useCommerceTheme() 을 쓴다.

---

## 작업 전 체크리스트

1. 색상/간격/라운드를 쓸 때 useCommerceTheme() 훅을 사용했는가?
2. 텍스트를 SText variant 로 렌더링했는가?
3. 카드/칩/검색 필드를 새로 만들기 전에 components/commerce/ 를 확인했는가?
4. 라이트/다크 모드에서 토큰만으로 동작하는가?
5. 하드코딩된 색상/매직 넘버가 없는가?

