export function isMemberAuthConfigured(): boolean {
  if (!process.env.AUTH_SECRET) return false;

  const hasGoogle = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  const hasFacebook = Boolean(
    process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET,
  );

  return hasGoogle || hasFacebook;
}
