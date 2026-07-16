module.exports = ({ config }) => {
  const automatedE2E = process.env.EXPO_PUBLIC_E2E_MODE === "true";

  return {
    ...config,
    android: {
      ...config.android,
      // The production release keeps Android's secure cleartext default. Only
      // the generated CI E2E native project may reach the emulator host.
      ...(automatedE2E ? { usesCleartextTraffic: true } : {}),
    },
  };
};
