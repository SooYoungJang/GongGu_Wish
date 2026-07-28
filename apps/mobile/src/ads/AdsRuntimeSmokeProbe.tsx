import Constants from "expo-constants";
import { StyleSheet, Text, View } from "react-native";

import { NativeAdCard } from "../components/ads/NativeAdCard";

type AdsRuntimeSmokeExtra = {
  adsRuntimeSmoke?: unknown;
};

export function isAdsRuntimeSmokeEnabled(extra: AdsRuntimeSmokeExtra) {
  return extra.adsRuntimeSmoke === true;
}

export function AdsRuntimeSmokeProbe() {
  const extra = (Constants.expoConfig?.extra ?? {}) as AdsRuntimeSmokeExtra;
  if (!isAdsRuntimeSmokeEnabled(extra)) return null;

  return (
    <View style={styles.overlay} testID="ads-runtime-smoke">
      <Text style={styles.title}>Google Mobile Ads runtime smoke</Text>
      <Text style={styles.status}>Waiting for official test ads…</Text>
      <View style={styles.ads}>
        <NativeAdCard
          placement="home"
          style={styles.ad}
          testID="ads-runtime-smoke-home-ad"
          variant="row"
        />
        <NativeAdCard
          placement="reels"
          style={styles.ad}
          testID="ads-runtime-smoke-reels-ad"
          variant="row"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ad: {
    alignSelf: "stretch",
  },
  ads: {
    alignSelf: "stretch",
    gap: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    padding: 24,
    zIndex: 10_000,
  },
  status: {
    color: "#475569",
    marginBottom: 20,
  },
  title: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
});
