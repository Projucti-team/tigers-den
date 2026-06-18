import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { isFirebaseAdminConfigured } from "@/lib/firebase/config";

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
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
