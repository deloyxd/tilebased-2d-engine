import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import state from "../state.js";

const AUTHORS = [
  "Jestley Charles R. Estipona",
  "Enzo P. Daniela",
  "Kyan Ray I. Villarin",
  "Jun Gin Xenon M. De Jose",
  "Jimmy H. Quiton",
];

let db = null;
let initialized = false;

export function initFirestore() {
  if (initialized) return;

  const firebaseConfig = {
    apiKey: "AIzaSyBXAEL0AfW3QVe0b6-b0whBtZpA1BiwPDc",
    authDomain: "islandventure-ae04d.firebaseapp.com",
    projectId: "islandventure-ae04d",
    storageBucket: "islandventure-ae04d.firebasestorage.app",
    messagingSenderId: "580526749644",
    appId: "1:580526749644:web:0feecc813de1af11cc4f69",
  };

  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    initialized = true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    alert(
      "Firebase not configured. Please update firebaseConfig in src/map/firestore.js"
    );
  }
}

export function getAuthors() {
  return AUTHORS;
}

export async function saveLevelToFirestore(author) {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return null;
    }
  }

  const mapData = {
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    layers: state.tiles.layers,
    activeLayerIndex: state.editing.activeLayerIndex,
    tiles:
      state.tiles.layers[state.editing.activeLayerIndex]?.tiles.slice() || [],
  };

  try {
    const docRef = await addDoc(collection(db, "levels"), {
      author: author,
      level: 0,
      mapData: mapData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving level:", error);
    alert("Error saving level: " + error.message);
    return null;
  }
}

export async function getAllLevels() {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return [];
    }
  }

  try {
    const q = query(collection(db, "levels"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const levels = [];
    querySnapshot.forEach((doc) => {
      levels.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return levels;
  } catch (error) {
    console.error("Error loading levels:", error);
    alert("Error loading levels: " + error.message);
    return [];
  }
}
