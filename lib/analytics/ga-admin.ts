import { BetaAnalyticsDataClient } from "@google-analytics/data";

import { getGaClientEmail, isGaReportingConfigured } from "@/lib/analytics/ga-config";

let client: BetaAnalyticsDataClient | undefined;

/**
 * Same private-key normalization as lib/firebase/admin.ts's resolvePrivateKey() —
 * tolerates the two most common ways this gets mangled when copied out of the downloaded
 * service-account JSON: wrapping quotes left in, and literal `\n` instead of real newlines.
 * Duplicated rather than shared with the Firebase helper so a change to one credential path
 * can never silently affect the other.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, "\n").trim();
}

function resolvePrivateKey(): string | undefined {
  const b64 = process.env.GA_PRIVATE_KEY_B64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8").trim();
      if (decoded.includes("BEGIN PRIVATE KEY")) return decoded;
      console.error(
        "[ga-admin] GA_PRIVATE_KEY_B64 decoded but doesn't contain a PEM header — falling back to GA_PRIVATE_KEY",
      );
    } catch (err) {
      console.error("[ga-admin] GA_PRIVATE_KEY_B64 failed to base64-decode", err);
    }
  }

  const raw = process.env.GA_PRIVATE_KEY;
  return raw ? normalizePrivateKey(raw) : undefined;
}

export function getAnalyticsDataClient(): BetaAnalyticsDataClient {
  if (client) return client;

  if (!isGaReportingConfigured()) {
    throw new Error("GA_REPORTING_NOT_CONFIGURED");
  }

  const clientEmail = getGaClientEmail();
  const privateKey = resolvePrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error("GA_REPORTING_NOT_CONFIGURED");
  }

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "GA_PRIVATE_KEY does not look like a PEM key (missing 'BEGIN PRIVATE KEY') " +
        "— check it was pasted without surrounding quotes and with \\n sequences intact.",
    );
  }

  client = new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey },
  });

  return client;
}
