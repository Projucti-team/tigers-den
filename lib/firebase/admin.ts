import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { isFirebaseAdminConfigured } from "@/lib/firebase/config";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

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

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? normalizeFirebasePrivateKey(rawPrivateKey) : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

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
