export function safeStorageFailure(error: { code?: string; message?: string }, status: number) {
  let storageCode = "OTHER";
  if (typeof error.code === "string" && /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(error.code)) storageCode = error.code;
  else if (error.message?.startsWith("Invalid API key")) storageCode = "API_KEY_REJECTED";
  else if (error.message?.startsWith("Invalid JWT") || error.message?.startsWith("JWT expired")) storageCode = "JWT_REJECTED";
  else if (error.message?.includes("fetch failed")) storageCode = "NETWORK_ERROR";
  return { storageCode, storageStatus: Number.isInteger(status) && status >= 0 && status <= 599 ? status : 0 };
}
