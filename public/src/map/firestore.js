import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import state from "../state.js";

const AUTHORS = [
  "Enzo P. Daniela",
  "Jestley Charles R. Estipona",
  "Jun Gin Xenon M. De Jose",
  "Kyan Ray I. Villarin",
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
      "Firebase not configured. Please update firebaseConfig in src/map/firestore.js",
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
      isBeingEdited: true,
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

export async function updateLevelToFirestore(levelId) {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return false;
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
    const docRef = doc(db, "levels", levelId);
    await updateDoc(docRef, {
      mapData: mapData,
      isBeingEdited: true,
      updatedAt: Timestamp.now(),
    });
    return true;
  } catch (error) {
    console.error("Error updating level:", error);
    alert("Error updating level: " + error.message);
    return false;
  }
}

export async function deleteLevelFromFirestore(levelId) {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return false;
    }
  }

  try {
    const docRef = doc(db, "levels", levelId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting level:", error);
    alert("Error deleting level: " + error.message);
    return false;
  }
}

export async function getLevelById(levelId) {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return null;
    }
  }

  try {
    const docRef = doc(db, "levels", levelId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting level:", error);
    alert("Error getting level: " + error.message);
    return null;
  }
}

export async function setLevelBeingEdited(levelId) {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return false;
    }
  }

  try {
    const docRef = doc(db, "levels", levelId);
    await updateDoc(docRef, {
      isBeingEdited: true,
    });
    return true;
  } catch (error) {
    console.error("Error setting level being edited:", error);
    return false;
  }
}

export async function setLevelNotBeingEdited(levelId) {
  if (!db) {
    initFirestore();
    if (!db) {
      alert("Firebase not initialized");
      return false;
    }
  }

  try {
    const docRef = doc(db, "levels", levelId);
    await updateDoc(docRef, {
      isBeingEdited: false,
    });
    return true;
  } catch (error) {
    console.error("Error setting level not being edited:", error);
    return false;
  }
}
