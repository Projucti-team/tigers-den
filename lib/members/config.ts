export type AuthProviderId = "google" | "facebook";

export function getEnabledAuthProviders(): AuthProviderId[] {
  const providers: AuthProviderId[] = [];

  if (process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    providers.push("google");
  }
  // Facebook login disabled — uncomment when Meta app is Live.
  // if (process.env.FACEBOOK_CLIENT_ID?.trim() && process.env.FACEBOOK_CLIENT_SECRET?.trim()) {
  //   providers.push("facebook");
  // }

  return providers;
}

export function isMemberAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET?.trim()) && getEnabledAuthProviders().length > 0;
}
