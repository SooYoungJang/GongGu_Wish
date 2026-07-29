export type RestrictedAudienceCleanupDependencies = {
  accessToken: string | null | undefined;
  userId: string | null | undefined;
  disableRemotePush: (_accessToken: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
  clearSessionId: () => Promise<unknown>;
  clearLocalUserData: (_namespace: string) => Promise<unknown>;
};

function invokeCleanup(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    return Promise.resolve(operation());
  } catch (error) {
    return Promise.reject(error);
  }
}

export async function cleanupRestrictedAudienceSession({
  accessToken,
  userId,
  disableRemotePush,
  signOut,
  clearSessionId,
  clearLocalUserData,
}: RestrictedAudienceCleanupDependencies): Promise<void> {
  const cleanups: Promise<unknown>[] = [];

  if (accessToken) {
    cleanups.push(invokeCleanup(() => disableRemotePush(accessToken)));
  }

  const namespaces = userId ? [`user:${userId}`, "guest"] : ["guest"];
  if (accessToken || userId) {
    cleanups.push(invokeCleanup(signOut));
  }
  cleanups.push(
    invokeCleanup(clearSessionId),
    ...namespaces.map((namespace) =>
      invokeCleanup(() => clearLocalUserData(namespace)),
    ),
  );

  await Promise.allSettled(cleanups);
}
