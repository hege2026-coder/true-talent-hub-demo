export const firebaseConfig = {
  apiKey: "AIzaSyCEaIVvYNNgUAzMevUS2QrAN_qgUTBXtVA",
  authDomain: "true-talent-hub.firebaseapp.com",
  projectId: "true-talent-hub",
  storageBucket: "true-talent-hub.firebasestorage.app",
  messagingSenderId: "386318676158",
  appId: "1:386318676158:web:97ed023c3d558ea22d6eef"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
