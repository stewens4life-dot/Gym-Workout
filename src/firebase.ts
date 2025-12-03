import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfR69yaxonCqGZQliAmopg-ywtUr8LAzk",
  authDomain: "arnold-tracker.firebaseapp.com",
  projectId: "arnold-tracker",
  storageBucket: "arnold-tracker.firebasestorage.app",
  messagingSenderId: "907261527912",
  appId: "1:907261527912:web:f4e62a212b7952ff9fb8dd",
  measurementId: "G-HWXWRPDF8K"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
