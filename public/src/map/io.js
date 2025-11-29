import state from "../state.js";
import { saveMap } from "./storage.js";
import { initializeLayersFromData } from "../tiles/layers.js";
import { updateBackgroundTiles } from "../tiles/background.js";
import { resetHistory, saveStateToUndo } from "./history.js";
import { hideLandingPage } from "../events/uiEvents.js";

export function importMap(file) {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    importMapFromData(data);
  };
}

export function importMapFromData(data) {
  resetHistory();
  state.originalMapData = JSON.parse(JSON.stringify(data));
  state.mapMaxColumn = data.mapMaxColumn;
  state.mapMaxRow = data.mapMaxRow;
  const legacyLayer = data.tiles
    ? [
        {
          id: "legacy-layer",
          name: "Layer 1",
          visible: true,
          tiles: data.tiles
        }
      ]
    : [];
  initializeLayersFromData(
    data.layers && data.layers.length ? data.layers : legacyLayer,
    data.activeLayerIndex ?? 0
  );
  updateBackgroundTiles();
  saveMap();
  hideLandingPage();
}

export function revertToOriginalMap() {
  saveStateToUndo();
  if (!state.originalMapData) {
    return;
  }
  const data = state.originalMapData;
  state.mapMaxColumn = data.mapMaxColumn;
  state.mapMaxRow = data.mapMaxRow;
  const legacyLayer = data.tiles
    ? [
        {
          id: "legacy-layer",
          name: "Layer 1",
          visible: true,
          tiles: data.tiles
        }
      ]
    : [];
  initializeLayersFromData(
    data.layers && data.layers.length ? data.layers : legacyLayer,
    data.activeLayerIndex ?? 0
  );
  updateBackgroundTiles();
  saveMap();
}

export function exportMap() {
  const data = {
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    layers: state.tiles.layers,
    activeLayerIndex: state.editing.activeLayerIndex,
    tiles:
      state.tiles.layers[state.editing.activeLayerIndex]?.tiles.slice() || []
  };
  const blob = new Blob([JSON.stringify(data)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "map.json";
  a.click();
  URL.revokeObjectURL(url);
}
