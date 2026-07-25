import { createPrivateKey } from "node:crypto";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { isFirebaseAdminConfigured } from "@/lib/firebase/config";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let diagnosticsLogged = false;

/**
 * Logs the *shape* of the private key we actually received at runtime — never the key
 * material itself — so we can tell from prod logs whether Coolify is delivering real
 * newlines, literal `\n` escapes, both, or neither, without ever printing the secret.
 * Also runs the value through Node's own crypto module directly, which sometimes gives
 * a more specific error than the wrapped one firebase-admin surfaces.
 */
function logPrivateKeyDiagnostics(privateKey: string): void {
  if (diagnosticsLogged) return;
  diagnosticsLogged = true;

  const literalBackslashNCount = (privateKey.match(/\\n/g) ?? []).length;
  const realNewlineCount = (privateKey.match(/\n/g) ?? []).length;

  let cryptoParseResult: string;
  try {
    createPrivateKey(privateKey);
    cryptoParseResult = "OK";
  } catch (err) {
    cryptoParseResult = err instanceof Error ? err.message : String(err);
  }

  console.error("[firebase-admin] FIREBASE_PRIVATE_KEY diagnostics", {
    length: privateKey.length,
    literalBackslashNCount,
    realNewlineCount,
    hasCarriageReturn: privateKey.includes("\r"),
    startsWith: JSON.stringify(privateKey.slice(0, 35)),
    endsWith: JSON.stringify(privateKey.slice(-35)),
    nodeCryptoParseResult: cryptoParseResult,
  });
}

/**
 * Tolerates the two most common ways people mangle this env var when copying it out of the
 * downloaded service-account JSON: pasting the whole `"private_key": "...\n..."` value
 * including its wrapping quotes (OpenSSL then fails with a cryptic "DECODER routines::
 * unsupported" error, since the leading/trailing `"` breaks the PEM boundary), and leaving the
 * `\n` sequences as literal backslash-n instead of real newlines (which Coolify's single-line
 * secret fields require you to do, but not every host does).
 */
function normalizeFirebasePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, "\n").trim();
}

/**
 * Preferred path: FIREBASE_PRIVATE_KEY_B64 holds the entire PEM key base64-encoded into one
 * plain-ASCII line — no newlines, backslashes, or quotes for any UI/shell/log layer to mangle.
 * Falls back to the raw FIREBASE_PRIVATE_KEY var (normalized) for backward compatibility.
 */
function resolvePrivateKey(): string | undefined {
  const b64 = process.env.FIREBASE_PRIVATE_KEY_B64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8").trim();
      if (decoded.includes("BEGIN PRIVATE KEY")) return decoded;
      console.error(
        "[firebase-admin] FIREBASE_PRIVATE_KEY_B64 decoded but doesn't contain a PEM header — falling back to FIREBASE_PRIVATE_KEY",
      );
    } catch (err) {
      console.error("[firebase-admin] FIREBASE_PRIVATE_KEY_B64 failed to base64-decode", err);
    }
  }

  const raw = process.env.FIREBASE_PRIVATE_KEY;
  return raw ? normalizeFirebasePrivateKey(raw) : undefined;
}

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = resolvePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  logPrivateKeyDiagnostics(privateKey);

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    // Fail with a message that actually says what's wrong, instead of letting the
    // Google SDK's OpenSSL error ("DECODER routines::unsupported") reach the logs unexplained.
    throw new Error(
      "FIREBASE_PRIVATE_KEY does not look like a PEM key (missing 'BEGIN PRIVATE KEY') " +
        "— check it was pasted without surrounding quotes and with \\n sequences intact.",
    );
  }

  adminApp =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

  return adminApp;
}

export function getAdminFirestore(): Firestore {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }

  return adminDb;
}
