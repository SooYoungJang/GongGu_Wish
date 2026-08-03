export const MAIN_TAB_BAR_HEIGHT = 58;
const MAIN_TAB_BAR_SAFE_AREA_BUFFER = 12;

export function getMainTabBarHeight(bottomInset: number): number {
  return (
    MAIN_TAB_BAR_HEIGHT +
    Math.max(bottomInset - MAIN_TAB_BAR_SAFE_AREA_BUFFER, 0)
  );
}

export function getHomeRequestTickerBottomOffset(
  bottomInset: number,
  gap = 0,
): number {
  return Math.max(0, getMainTabBarHeight(bottomInset) - bottomInset) + gap;
}
