/**
 * Config for reading GA4 stats server-side via the Analytics Data API. Separate from the
 * public NEXT_PUBLIC_GA_MEASUREMENT_ID (that one just tells the browser where to send hits;
 * this is a service account with read access to the same GA4 property, used to pull numbers
 * back into the admin dashboard).
 *
 * GA_CLIENT_EMAIL / GA_PRIVATE_KEY(_B64) fall back to the existing FIREBASE_* service-account
 * vars (lib/firebase/config.ts) when unset. Same Google Cloud service account can be granted
 * both Firestore admin (for The Roar) and GA4 Viewer access (Admin → Property Access Management
 * in GA4) — GA4 Viewer is read-only, so reusing it here is low-risk and avoids re-pasting the
 * private key into Coolify a second time. Set the GA_* vars instead if you'd rather use a
 * dedicated service account.
 */
export function getGaPropertyId(): string | undefined {
  return process.env.GA_PROPERTY_ID?.trim() || undefined;
}

export function getGaClientEmail(): string | undefined {
  return process.env.GA_CLIENT_EMAIL?.trim() || process.env.FIREBASE_CLIENT_EMAIL?.trim() || undefined;
}

/**
 * Mirrors FIREBASE_PRIVATE_KEY_B64 / FIREBASE_PRIVATE_KEY in lib/firebase/config.ts —
 * base64-encoded PEM is preferred since it survives Coolify/shell env var mangling better
 * than a raw multi-line (or \n-escaped) key.
 */
export function hasGaPrivateKey(): boolean {
  return Boolean(
    process.env.GA_PRIVATE_KEY_B64?.trim() ||
      process.env.GA_PRIVATE_KEY?.trim() ||
      process.env.FIREBASE_PRIVATE_KEY_B64?.trim() ||
      process.env.FIREBASE_PRIVATE_KEY?.trim(),
  );
}

export function isGaReportingConfigured(): boolean {
  return Boolean(getGaPropertyId() && getGaClientEmail() && hasGaPrivateKey());
}
