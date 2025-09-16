import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDi7dQ_8WvQdIoAOgokzGs0MzOSj8VvdUw",
  authDomain: "zawix-messages.firebaseapp.com",
  projectId: "zawix-messages",
  storageBucket: "zawix-messages.firebasestorage.app",
  messagingSenderId: "730850472414",
  appId: "1:730850472414:web:dd43f62919a269e52f6d4f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where };