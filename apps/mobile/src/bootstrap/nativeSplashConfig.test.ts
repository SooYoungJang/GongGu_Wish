import appConfig from "../../app.json";
import { describe, expect, it } from "vitest";

type SplashPluginOptions = {
  backgroundColor: string;
  dark: {
    backgroundColor: string;
    image: string;
  };
  image: string;
};

describe("native splash icon configuration", () => {
  it("keeps the launcher icon and uses the softened icon only for native splash", () => {
    const splashPlugin = appConfig.expo.plugins.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
    ) as unknown as [string, SplashPluginOptions];
    const splashOptions = splashPlugin[1];

    expect(appConfig.expo.icon).toBe("./assets/app-icon.png");
    expect(splashOptions.image).toBe("./assets/splash-icon-optimized.png");
    expect(splashOptions.dark.image).toBe(
      "./assets/splash-icon-optimized.png",
    );
    expect(splashOptions.backgroundColor).toBe("#FFF4EA");
    expect(splashOptions.dark.backgroundColor).toBe("#FFF4EA");
  });
});
