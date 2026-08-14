/**
 * Config for reading GA4 stats server-side via the Analytics Data API. Separate from the
 * public NEXT_PUBLIC_GA_MEASUREMENT_ID (that one just tells the browser where to send hits;
 * this is a service account with read access to the same GA4 property, used to pull numbers
 * back into the admin dashboard).
 */
export function getGaPropertyId(): string | undefined {
  return process.env.GA_PROPERTY_ID?.trim() || undefined;
}

export function getGaClientEmail(): string | undefined {
  return process.env.GA_CLIENT_EMAIL?.trim() || undefined;
}

/**
 * Mirrors FIREBASE_PRIVATE_KEY_B64 / FIREBASE_PRIVATE_KEY in lib/firebase/config.ts —
 * base64-encoded PEM is preferred since it survives Coolify/shell env var mangling better
 * than a raw multi-line (or \n-escaped) key.
 */
export function hasGaPrivateKey(): boolean {
  return Boolean(process.env.GA_PRIVATE_KEY_B64?.trim() || process.env.GA_PRIVATE_KEY?.trim());
}

export function isGaReportingConfigured(): boolean {
  return Boolean(getGaPropertyId() && getGaClientEmail() && hasGaPrivateKey());
}
