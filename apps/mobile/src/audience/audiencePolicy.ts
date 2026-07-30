export type AgeBand = "under13" | "age13" | "age14Plus";

export type AudiencePolicy = {
  resolved: boolean;
  canUseApp: boolean;
  canAuthenticate: boolean;
  canRequestAds: boolean;
  canRecordBehaviorSignals: boolean;
};

const RESTRICTED_BROWSE_POLICY: AudiencePolicy = {
  resolved: false,
  canUseApp: true,
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
  if (ageBand === null) return RESTRICTED_BROWSE_POLICY;
  if (ageBand === "under13" || ageBand === "age13") {
    return { ...RESTRICTED_BROWSE_POLICY, resolved: true };
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
