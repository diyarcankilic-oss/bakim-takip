import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA9AnHd6emck4fkRvf5pWfUV8AMFgS16F0",
  authDomain: "bakim-takip-f9c52.firebaseapp.com",
  databaseURL: "https://bakim-takip-f9c52-default-rtdb.firebaseio.com",
  projectId: "bakim-takip-f9c52",
  storageBucket: "bakim-takip-f9c52.firebasestorage.app",
  messagingSenderId: "238374508220",
  appId: "1:238374508220:web:b82e86b387046043ef22b9",
  measurementId: "G-TJ1DWSDLCT"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, onValue };
