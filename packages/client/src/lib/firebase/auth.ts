import {
  GoogleAuthProvider,
  TwitterAuthProvider,
  getIdToken,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./config";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

const xProvider = new TwitterAuthProvider();

export function observeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return credential.user;
}

export async function signInWithX(): Promise<User> {
  const credential = await signInWithPopup(firebaseAuth, xProvider);
  return credential.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function getUserIdToken(user: User, forceRefresh = false): Promise<string> {
  return getIdToken(user, forceRefresh);
}
