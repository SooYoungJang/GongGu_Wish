export type TabBarVisibilityStyle = {
  display: "flex" | "none";
};

export function getTabBarVisibilityStyle(
  hidden: boolean,
): TabBarVisibilityStyle {
  return { display: hidden ? "none" : "flex" };
}
