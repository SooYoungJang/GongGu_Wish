import type { AudiencePolicy } from "./audiencePolicy";

let behaviorSignalsAllowed = false;

export function setAudiencePolicySnapshot(policy: AudiencePolicy): void {
  behaviorSignalsAllowed = policy.canRecordBehaviorSignals === true;
}

export function canRecordBehaviorSignals(): boolean {
  return behaviorSignalsAllowed;
}
