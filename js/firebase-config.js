/**
 * firebase-config.js
 * Initialize Firebase and export Firestore instance.
 * Successfully linked to researcher's Project 'test-75c1d'
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Linked Firebase Config
const firebaseConfig = {
  apiKey: "8888888888888888888888",
  authDomain: "test-78com",
  projectId: "test-75c1d",
  storageBucket: "test-88888888rage.app",
  messagingSenderId: "88888888888888",
  appId: "1:710478888888888ae49c5c0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export for use in other modules
export { db, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, limit, startAfter };
