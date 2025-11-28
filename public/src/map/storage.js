import state from "../state.js";
import { initializeLayersFromData } from "../tiles/layers.js";
import { updateSaveButtonVisibility } from "../events/uiEvents.js";
import { saveStateToUndo } from "./history.js";

export function loadMap() {
  const { tiles } = state;
  state.maxCanvasWidth = window.innerWidth;
  state.maxCanvasHeight = window.innerHeight;

  const savedMap = localStorage.getItem("map");
  if (!savedMap) {
    resetMap();
    loadLastLoadedLevel();
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
    data.activeLayerIndex ?? 0,
  );
  loadLastLoadedLevel();
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
      }),
    );
  } else {
    localStorage.removeItem("lastLoadedLevel");
  }
}

export function saveMap() {
  const data = {
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    layers: state.tiles.layers,
    activeLayerIndex: state.editing.activeLayerIndex,
    // Legacy single-layer fallback
    tiles:
      state.tiles.layers[state.editing.activeLayerIndex]?.tiles.slice() || [],
  };
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
