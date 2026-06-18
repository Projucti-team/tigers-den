"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

import { getFirebasePublicConfig } from "@/lib/firebase/config";

let clientApp: FirebaseApp | undefined;
let clientDb: Firestore | undefined;

export function getClientFirebaseApp(): FirebaseApp {
  if (clientApp) return clientApp;

  const config = getFirebasePublicConfig();
  if (!config) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  clientApp = getApps().length ? getApp() : initializeApp(config);
  return clientApp;
}

export function getClientFirestore(): Firestore {
  if (!clientDb) {
    clientDb = getFirestore(getClientFirebaseApp());
  }

  return clientDb;
}
