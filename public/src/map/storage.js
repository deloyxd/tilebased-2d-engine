import state from "../state.js";
import { initializeLayersFromData } from "../tiles/layers.js";
import {
  updateSaveButtonVisibility,
  showLandingPage,
  hideLandingPage,
  isMapEmpty,
  showLandingPageLoading,
  hideLandingPageLoading,
} from "../events/uiEvents.js";
import { saveStateToUndo } from "./history.js";
import {
  initFirestore,
  getLevelById,
  setLevelBeingEdited,
} from "./firestore.js";
import { importMapFromData } from "./io.js";

export async function loadMap() {
  const { tiles } = state;
  state.maxCanvasWidth = window.innerWidth;
  state.maxCanvasHeight = window.innerHeight;

  loadLastLoadedLevel();

  if (state.lastLoadedLevel.id) {
    showLandingPageLoading();
    showLandingPage();
    try {
      initFirestore();
      const level = await getLevelById(state.lastLoadedLevel.id);

      if (level && level.mapData) {
        importMapFromData(level.mapData);
        await setLevelBeingEdited(level.id);
        state.lastLoadedLevel.id = level.id;
        state.lastLoadedLevel.author = level.author || null;
        saveLastLoadedLevel();
        updateSaveButtonVisibility();
        return;
      }
    } catch (error) {
      console.error("Error loading last loaded level from Firestore:", error);
    } finally {
      hideLandingPageLoading();
    }
  }

  const savedMap = localStorage.getItem("map");
  if (!savedMap) {
    resetMap();
    showLandingPage();
    hideLandingPageLoading();
    return;
  }

  const data = JSON.parse(savedMap);
  state.originalMapData = JSON.parse(JSON.stringify(data));
  state.mapMaxColumn = data.mapMaxColumn;
  state.mapMaxRow = data.mapMaxRow;
  const legacyLayer = data.tiles
    ? [
        {
          id: "legacy-layer",
          name: "Layer 1",
          visible: true,
          tiles: data.tiles,
        },
      ]
    : [];
  initializeLayersFromData(
    data.layers && data.layers.length ? data.layers : legacyLayer,
    data.activeLayerIndex ?? 0
  );

  if (isMapEmpty()) {
    showLandingPage();
    hideLandingPageLoading();
  } else {
    hideLandingPage();
  }

  updateSaveButtonVisibility();
}

export function loadLastLoadedLevel() {
  const saved = localStorage.getItem("lastLoadedLevel");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      state.lastLoadedLevel.id = data.id || null;
      state.lastLoadedLevel.author = data.author || null;
    } catch (error) {
      console.error("Error loading lastLoadedLevel:", error);
      state.lastLoadedLevel.id = null;
      state.lastLoadedLevel.author = null;
    }
  }
}

export function saveLastLoadedLevel() {
  if (state.lastLoadedLevel.id && state.lastLoadedLevel.author) {
    localStorage.setItem(
      "lastLoadedLevel",
      JSON.stringify({
        id: state.lastLoadedLevel.id,
        author: state.lastLoadedLevel.author,
      })
    );
  } else {
    localStorage.removeItem("lastLoadedLevel");
  }
}

export function getCurrentMapData() {
  return {
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    layers: JSON.parse(JSON.stringify(state.tiles.layers)),
    activeLayerIndex: state.editing.activeLayerIndex,
    tiles:
      state.tiles.layers[state.editing.activeLayerIndex]?.tiles.slice() || [],
  };
}

export function saveMap() {
  const data = getCurrentMapData();
  localStorage.setItem("map", JSON.stringify(data));
  updateSaveButtonVisibility();
}

export function resetMap() {
  saveStateToUndo();
  const { tiles } = state;
  state.mapMaxColumn = Math.ceil(window.innerWidth / tiles.size);
  state.mapMaxRow = Math.ceil(window.innerHeight / tiles.size);
  initializeLayersFromData([], 0);
  saveMap();
}

export function syncOriginalMapData() {
  state.originalMapData = JSON.parse(JSON.stringify(getCurrentMapData()));
}

export function isMapModifiedFromOriginal() {
  if (!state.originalMapData) return false;

  const originalLayers = state.originalMapData.layers ?? [];
  const currentLayers = state.tiles.layers ?? [];

  if (originalLayers.length !== currentLayers.length) {
    return true;
  }

  for (let i = 0; i < originalLayers.length; i++) {
    const a = originalLayers[i].tiles;
    const b = currentLayers[i].tiles;
    if (a.length !== b.length) return true;

    for (let t = 0; t < a.length; t++) {
      if (a[t] !== b[t]) {
        return true;
      }
    }
  }

  return false;
}
