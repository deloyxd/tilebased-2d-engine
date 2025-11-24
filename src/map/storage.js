import state from "../state.js";
import { initializeLayersFromData } from "../tiles/layers.js";

export function loadMap() {
  const { tiles } = state;
  state.maxCanvasWidth = window.innerWidth;
  state.maxCanvasHeight = window.innerHeight;

  const savedMap = localStorage.getItem("map");
  if (!savedMap) {
    resetMap();
    return;
  }

  const data = JSON.parse(savedMap);
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
}

export function resetMap() {
  const { tiles } = state;
  state.mapMaxColumn = Math.ceil(window.innerWidth / tiles.size);
  state.mapMaxRow = Math.ceil(window.innerHeight / tiles.size);
  initializeLayersFromData([], 0);
  saveMap();
}

