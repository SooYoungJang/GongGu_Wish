export type AgeBand = "under13" | "age13" | "age14Plus";

export type AudiencePolicy = {
  resolved: boolean;
  canUseApp: boolean;
  canAuthenticate: boolean;
  canRequestAds: boolean;
  canRecordBehaviorSignals: boolean;
};

const BLOCKED_POLICY: AudiencePolicy = {
  resolved: false,
  canUseApp: false,
  canAuthenticate: false,
  canRequestAds: false,
  canRecordBehaviorSignals: false,
};

export function parseStoredAgeBand(value: string | null): AgeBand | null {
  if (value === "under13" || value === "age13" || value === "age14Plus") {
    return value;
  }
  return null;
}

export function resolveAudiencePolicy(ageBand: AgeBand | null): AudiencePolicy {
  if (ageBand === null) return BLOCKED_POLICY;
  if (ageBand === "under13") {
    return { ...BLOCKED_POLICY, resolved: true };
  }
  if (ageBand === "age13") {
    return {
      ...BLOCKED_POLICY,
      resolved: true,
      canUseApp: true,
    };
  }
  return {
    resolved: true,
    canUseApp: true,
    canAuthenticate: true,
    canRequestAds: true,
    canRecordBehaviorSignals: true,
  };
}

export function requiresRestrictedModeCleanup(
  previousAgeBand: AgeBand | null,
  nextAgeBand: AgeBand,
): boolean {
  return previousAgeBand === "age14Plus" && nextAgeBand !== "age14Plus";
}
