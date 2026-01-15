
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// Load Firebase config from environment variables or use defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Use a fixed document ID for the main store to simplify persistence
// In a real multi-user app, this would be tied to a User ID
const DOC_PATH = "prasama_erp/production_v1";

export async function loadCloudData() {
  try {
    const docRef = doc(db, DOC_PATH);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Firestore Load Error:", error);
    return null;
  }
}

export async function saveCloudData(data: any) {
  try {
    const docRef = doc(db, DOC_PATH);
    // Use setDoc with merge to ensure we don't accidentally wipe data
    await setDoc(docRef, data, { merge: false });
    return true;
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    return false;
  }
}

// Optional: Listen for real-time updates from other tabs/devices
export function subscribeToChanges(callback: (data: any) => void) {
  return onSnapshot(doc(db, DOC_PATH), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
}
