type SubmissionAuthClient = {
  auth: {
    getUser(token: string): Promise<{
      data: { user: { id?: unknown } | null };
      error: unknown;
    }>;
  };
};

export class SubmissionAuthenticationError extends Error {
  readonly status = 401;

  constructor() {
    super("인증 정보가 유효하지 않습니다.");
    this.name = "SubmissionAuthenticationError";
  }
}

export async function resolveOptionalSubmissionUserId(
  authorization: string | null,
  supabase: SubmissionAuthClient,
): Promise<string | null> {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new SubmissionAuthenticationError();

  const { data, error } = await supabase.auth.getUser(match[1]);
  const userId = data.user?.id;
  if (error || typeof userId !== "string" || !userId.trim()) {
    throw new SubmissionAuthenticationError();
  }
  return userId.trim();
}
