import assert from "node:assert/strict";
import test from "node:test";

/**
 * GA_CLIENT_EMAIL / GA_PRIVATE_KEY(_B64) are optional and fall back to the existing
 * FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY(_B64) vars, so the same service account already
 * granted Firestore access for The Roar can double up as the GA4 reporting Viewer without
 * duplicating credentials into a second set of Coolify vars. Only GA_PROPERTY_ID has no
 * Firebase equivalent and must always be set directly.
 */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(vars)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test("getGaClientEmail falls back to FIREBASE_CLIENT_EMAIL when GA_CLIENT_EMAIL is unset", async () => {
  const { getGaClientEmail } = await import("../../lib/analytics/ga-config.ts");
  withEnv(
    { GA_CLIENT_EMAIL: undefined, FIREBASE_CLIENT_EMAIL: "sa@project.iam.gserviceaccount.com" },
    () => {
      assert.equal(getGaClientEmail(), "sa@project.iam.gserviceaccount.com");
    },
  );
});

test("getGaClientEmail prefers GA_CLIENT_EMAIL over the Firebase fallback when both are set", async () => {
  const { getGaClientEmail } = await import("../../lib/analytics/ga-config.ts");
  withEnv(
    { GA_CLIENT_EMAIL: "dedicated@project.iam.gserviceaccount.com", FIREBASE_CLIENT_EMAIL: "firebase@project.iam.gserviceaccount.com" },
    () => {
      assert.equal(getGaClientEmail(), "dedicated@project.iam.gserviceaccount.com");
    },
  );
});

test("hasGaPrivateKey is true from the Firebase fallback alone, and isGaReportingConfigured only needs GA_PROPERTY_ID on top of that", async () => {
  const { hasGaPrivateKey, isGaReportingConfigured } = await import("../../lib/analytics/ga-config.ts");
  withEnv(
    {
      GA_PROPERTY_ID: "123456789",
      GA_CLIENT_EMAIL: undefined,
      GA_PRIVATE_KEY_B64: undefined,
      GA_PRIVATE_KEY: undefined,
      FIREBASE_CLIENT_EMAIL: "sa@project.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY_B64: "c29tZS1rZXk=",
    },
    () => {
      assert.equal(hasGaPrivateKey(), true);
      assert.equal(isGaReportingConfigured(), true);
    },
  );
});

test("isGaReportingConfigured is false without GA_PROPERTY_ID even if Firebase creds are present", async () => {
  const { isGaReportingConfigured } = await import("../../lib/analytics/ga-config.ts");
  withEnv(
    {
      GA_PROPERTY_ID: undefined,
      FIREBASE_CLIENT_EMAIL: "sa@project.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY_B64: "c29tZS1rZXk=",
    },
    () => {
      assert.equal(isGaReportingConfigured(), false);
    },
  );
});
