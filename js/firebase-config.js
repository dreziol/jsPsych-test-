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
  apiKey: "AIzaSyCMxzpCz9cZhPm_iR_-QqLYarTM6GEQalc",
  authDomain: "test-75c1d.firebaseapp.com",
  projectId: "test-75c1d",
  storageBucket: "test-75c1d.firebasestorage.app",
  messagingSenderId: "710473477441",
  appId: "1:710473477441:web:062998efdc8f3dae49c5c0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export for use in other modules
export { db, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, limit, startAfter };
