/** Firestore collection for The Roar messages. */
export const ROAR_MESSAGES_COLLECTION = "roar_messages";

export type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();

  if (!apiKey || !authDomain || !projectId || !appId) return null;

  return { apiKey, authDomain, projectId, appId };
}

export function isFirebasePublicConfigured(): boolean {
  return getFirebasePublicConfig() !== null;
}

export function isFirebaseAdminConfigured(): boolean {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  // FIREBASE_PRIVATE_KEY_B64 (base64-encoded PEM) is preferred; FIREBASE_PRIVATE_KEY (raw PEM)
  // is the legacy fallback — see lib/firebase/admin.ts resolvePrivateKey().
  const privateKey =
    process.env.FIREBASE_PRIVATE_KEY_B64?.trim() || process.env.FIREBASE_PRIVATE_KEY?.trim();

  return Boolean(projectId && clientEmail && privateKey);
}

export function isFirebaseChatConfigured(): boolean {
  return isFirebasePublicConfigured() && isFirebaseAdminConfigured();
}
