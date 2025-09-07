// firebase.js - تهيئة Firebase الإصدار 9
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, runTransaction } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js';

// تكوين Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAzYZMxqNmnLMGYnCyiJYPg2MbxZMt0co0",
  authDomain: "osama-91b95.firebaseapp.com",
  databaseURL: "https://osama-91b95-default-rtdb.firebaseio.com",
  projectId: "osama-91b95",
  storageBucket: "osama-91b95.appspot.com",
  messagingSenderId: "118875905722",
  appId: "1:118875905722:web:200bff1bd99db2c1caac83",
  measurementId: "G-LEM5PVPJZC"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// جعل الدوال متاحة عالمياً
window.firebase = {
  auth: {
    getAuth: () => auth,
    signInWithEmailAndPassword: (auth, email, password) => signInWithEmailAndPassword(auth, email, password),
    createUserWithEmailAndPassword: (auth, email, password) => createUserWithEmailAndPassword(auth, email, password),
    signOut: (auth) => signOut(auth),
    onAuthStateChanged: (auth, callback) => onAuthStateChanged(auth, callback)
  },
  database: {
    getDatabase: () => database,
    ref: (path) => ref(database, path),
    set: (ref, data) => set(ref, data),
    get: (ref) => get(ref),
    update: (ref, data) => update(ref, data),
    runTransaction: (ref, transaction) => runTransaction(ref, transaction)
  }
};