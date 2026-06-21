# HomeScreen Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor HomeScreen.tsx with 7 changes — text fixes, new horizontal scroll sections, section removal, and style unification.

**Architecture:** All changes are in HomeScreen.tsx and HomeScreen.redesign.test.tsx. No new files. Add filter helpers for date logic, two new components (this-week horizontal deals, expiring-soon horizontal deals), update one component (WeeklyCalendarStrip), remove one section (DISCOVERY FEED + DealCardGrid), and unify textLink styles.

**Tech Stack:** React Native, TypeScript, vitest, react-test-renderer

## Global Constraints

- No new npm packages
- Use testID for test targeting where accessible
- DealCard is reused without modification (no new DealCard variants)
- All string literals in Korean (existing convention)
- Date comparison uses getTime() — no external date library
- Keep existing beige/ivory + purple accent design system
- tsc --noEmit must remain clean
- All existing tests must still pass

---

### Task 1: Update tests — write RED tests for new behavior

**Files:**
- Test: `/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/screens/HomeScreen.redesign.test.tsx`

**Interfaces:**
- Consumes: Existing `renderHomeContent()`, `flattenText()`, `flattenStyle()`, sample data
- Produces: Test expectations for new components and removed section

- [ ] **Step 1: Write tests for '이번주 공구' text change**

```typescript
it('shows 이번주 공구 instead of 주간 공구', () => {
  const renderer = renderHomeContent();
  const text = flattenText(renderer!.toJSON());
  expect(text).not.toContain('주간 공구');
  expect(text).toContain('이번주 공구');
});
```

- [ ] **Step 2: Write test for '전체' button as textLink (not chip)**

```typescript
it('renders calendar 전체 as textLink without border', () => {
  const renderer = renderHomeContent();
  const viewAllCta = renderer!.root.findByProps({ accessibilityLabel: '전체 캘린더 보기' });
  const style = flattenStyle(viewAllCta.props.style);
  expect(String(style.borderWidth)).toBe('0');
});
```

- [ ] **Step 3: Write test for DISCOVERY FEED removal**

```typescript
it('removes DISCOVERY FEED eyebrow and 오늘 열려있는 공구 section', () => {
  const renderer = renderHomeContent();
  const text = flattenText(renderer!.toJSON());
  expect(text).not.toContain('DISCOVERY FEED');
  expect(text).not.toContain('오늘 열려있는 공구');
});
```

- [ ] **Step 4: Write test for '이번주 공구' week deals horizontal section**

```typescript
it('renders this week horizontal scroll section below calendar', () => {
  const renderer = renderHomeContent();
  const text = flattenText(renderer!.toJSON());
  expect(text).toContain('이번주 공구');
  // Find ScrollView for this week deals (the week deals should render DealCards for items within this week)
});
```

- [ ] **Step 5: Write test for '마감임박 공구' section**

```typescript
it('renders expiring soon section with header', () => {
  const renderer = renderHomeContent();
  const text = flattenText(renderer!.toJSON());
  expect(text).toContain('마감임박 공구');
  expect(text).toContain('전체보기');
});
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
cd /Users/pc/Documents/RN_GongGu_Wish/apps/mobile
npx vitest run --reporter=verbose src/screens/HomeScreen.redesign.test.tsx 2>&1 | head -50
```

Expected: Tests fail because the new features aren't implemented yet.

---

### Task 2: Implement HomeScreen.tsx changes

**Files:**
- Modify: `/Users/pc/Documents/RN_GongGu_Wish/apps/mobile/src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `GroupBuy` type (from types.ts), `DealCard` (from components/DealCard), `colors`, `spacing`, `borderRadius`, `shadows`, `typography` (from design/tokens)
- Produces: Refactored HomeScreenContent with all 7 changes

- [ ] **Step 1: Add date filter helpers**

Add after `getWeekDays()` function:

```typescript
function isInThisWeek(endDate: string | null): boolean {
  if (!endDate) return false;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const current = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0..Sun=6
  const monday = new Date(now);
  monday.setDate(now.getDate() - current);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return date >= monday && date <= sunday;
}

function isExpiringSoon(endDate: string | null): boolean {
  if (!endDate) return false;
  const date = new Date(endDate);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = date.getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 7 * 86_400_000; // within 7 days
}
```

- [ ] **Step 2: Add '이번주 공구' horizontal scroll component**

Add after `WeeklyCalendarStrip` component and before `DealCardGrid`:

```typescript
function ThisWeekDeals({ groupBuys, onPressDeal }: Pick<HomeScreenContentProps, 'groupBuys' | 'onPressDeal'>) {
  const thisWeekItems = useMemo(() => groupBuys.filter((item) => isInThisWeek(item.endDate)), [groupBuys]);
  return (
    <View style={styles.thisWeekSection}>
      {thisWeekItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thisWeekScroll}>
          {thisWeekItems.map((item) => (
            <View key={item.id} style={styles.thisWeekCard}>
              <DealCard item={item} category={categoryForIndex(groupBuys.indexOf(item))} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.thisWeekEmpty}>
          <Text style={styles.thisWeekEmptyText}>이번주 공구가 없습니다</Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Add '마감임박 공구' section component**

Add after `ThisWeekDeals`:

```typescript
function ExpiringSoonSection({ groupBuys, onPressDeal }: Pick<HomeScreenContentProps, 'groupBuys' | 'onPressDeal'>) {
  const expiringItems = useMemo(
    () =>
      groupBuys
        .filter((item) => isExpiringSoon(item.endDate))
        .sort((a, b) => {
          const aDate = new Date(a.endDate ?? 0).getTime();
          const bDate = new Date(b.endDate ?? 0).getTime();
          return aDate - bDate;
        }),
    [groupBuys],
  );
  return (
    <View style={styles.expiringSoonSection}>
      <View style={styles.expiringSoonHeader}>
        <Text style={styles.expiringSoonTitle}>마감임박 공구</Text>
        <Text style={styles.expiringSoonAction}>전체보기</Text>
      </View>
      {expiringItems.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.expiringSoonScroll}>
          {expiringItems.map((item) => (
            <View key={item.id} style={styles.expiringSoonCard}>
              <DealCard item={item} category={categoryForIndex(groupBuys.indexOf(item))} onPress={() => onPressDeal(item)} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.expiringSoonEmpty}>
          <Text style={styles.expiringSoonEmptyText}>마감임박 공구가 없습니다</Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Update WeeklyCalendarStrip — '주간 공구' → '이번주 공구'**

Line 205: change text inside the calendarTitle Text element from `주간 공구` to `이번주 공구`.

- [ ] **Step 5: Update calendarViewAll style — chip → textLink**

Replace the `calendarViewAll` style block (lines 493-506) with textLink style:
```typescript
calendarViewAll: {
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: 'transparent',
  borderWidth: 0,
  flexDirection: 'row',
  justifyContent: 'center',
  minHeight: 44,
  paddingHorizontal: spacing.xs,
},
```

Replace the `calendarViewAllText` style block (lines 507-511) with:
```typescript
calendarViewAllText: {
  color: colors.primary,
  fontSize: 13,
  fontWeight: '700',
},
```

- [ ] **Step 6: Update HomeScreenContent render tree**

In the `HomeScreenContent` return (around lines 320-327):
- Remove the DISCOVERY FEED sectionHeaderRow block (lines 320-326)
- Remove `<DealCardGrid ... />` (line 327)
- After WeeklyCalendarStrip, add `<ThisWeekDeals ... />` and `<ExpiringSoonSection ... />`
- Add `<SubmitPrompt ... />` after the new sections

The new section layout order in the render tree:
```
<HomeHeader />
{isError ? notice : null}
<SearchBar />
{showSearchResults ? <SearchResultsPanel /> : null}
{isFetching && no data ? <ActivityIndicator /> : null}
<MonthlyBannerCarousel />
<CategoryRow />
<WeeklyCalendarStrip />
<ThisWeekDeals groupBuys={groupBuys} onPressDeal={onPressDeal} />
<ExpiringSoonSection groupBuys={groupBuys} onPressDeal={onPressDeal} />
<SubmitPrompt />
```

- [ ] **Step 7: Add new styles**

Add to the `styles` StyleSheet object:

```typescript
thisWeekSection: { marginBottom: spacing.xl },
thisWeekScroll: { gap: spacing.md, paddingRight: spacing.lg },
thisWeekCard: { width: 120, minHeight: 160 },
thisWeekEmpty: {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderRadius: borderRadius.xl,
  borderWidth: 1,
  padding: spacing.lg,
  alignItems: 'center',
},
thisWeekEmptyText: { ...typography.body, textAlign: 'center' },
expiringSoonSection: { marginBottom: spacing.xl },
expiringSoonHeader: {
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: spacing.md,
},
expiringSoonTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
expiringSoonAction: { color: colors.textLink, fontSize: 13, fontWeight: '700' },
expiringSoonScroll: { gap: spacing.md, paddingRight: spacing.lg },
expiringSoonCard: { width: 120, minHeight: 120 },
expiringSoonEmpty: {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderRadius: borderRadius.xl,
  borderWidth: 1,
  padding: spacing.lg,
  alignItems: 'center',
},
expiringSoonEmptyText: { ...typography.body, textAlign: 'center' },
```

---

### Task 3: Verify — tsc + test run

- [ ] **Step 1: Run tsc to check type errors**

```bash
cd /Users/pc/Documents/RN_GongGu_Wish/apps/mobile
npx tsc --noEmit 2>&1 | head -30
```

Expected: No type errors.

- [ ] **Step 2: Run all tests**

```bash
cd /Users/pc/Documents/RN_GongGu_Wish/apps/mobile
npx vitest run --reporter=verbose 2>&1 | tail -40
```

Expected: All tests pass (existing + new).

---

### Task 4: Commit changes

- [ ] **Step 1: Create commit**

```bash
cd /Users/pc/Documents/RN_GongGu_Wish
git add -A
git commit -m "feat(home): redesign v2 — 7 changes

- Change '주간 공구' → '이번주 공구'
- Change '전체' calendar button to textLink style
- Add this-week horizontal scroll section (DealCard, 120x160)
- Remove DISCOVERY FEED + 오늘의 공구 section
- Add '마감임박 공구' horizontal scroll section
- Update tests for all new behavior
- Clean tsc, all tests pass"
```
