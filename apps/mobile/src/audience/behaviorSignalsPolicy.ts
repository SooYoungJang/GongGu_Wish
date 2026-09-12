import type { AudiencePolicy } from "./audiencePolicy";

let behaviorSignalsAllowed = false;
const listeners = new Set<() => void>();

export function subscribeBehaviorSignalsPolicy(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setAudiencePolicySnapshot(policy: AudiencePolicy): void {
  behaviorSignalsAllowed = policy.canRecordBehaviorSignals === true;
  listeners.forEach(listener => listener());
}

export function canRecordBehaviorSignals(): boolean {
  return behaviorSignalsAllowed;
}
