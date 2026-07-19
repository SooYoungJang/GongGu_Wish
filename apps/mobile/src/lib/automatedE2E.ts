import Constants from "expo-constants";

export function isAutomatedE2E(): boolean {
  return (
    Constants.expoConfig?.extra?.automatedE2E === true ||
    process.env.EXPO_PUBLIC_E2E_MODE === "true"
  );
}
