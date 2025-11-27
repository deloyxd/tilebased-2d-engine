import state from "../state.js";
import { saveMap } from "./storage.js";
import {
  cloneLayers,
  getActiveLayerTiles,
  setActiveLayerIndex,
} from "../tiles/layers.js";

export function saveStateToUndo() {
  const snapshot = {
    layers: cloneLayers(),
    map: [...getActiveLayerTiles()],
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    activeLayerIndex: state.editing.activeLayerIndex,
  };

  state.history.undoStack.push(snapshot);

  if (state.history.undoStack.length > state.constants.MAX_UNDO_STEPS) {
    state.history.undoStack.shift();
  }

  state.history.redoStack = [];
}

export function undo() {
  if (state.history.undoStack.length === 0) return;

  const currentState = {
    layers: cloneLayers(),
    map: [...getActiveLayerTiles()],
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    activeLayerIndex: state.editing.activeLayerIndex,
  };
  state.history.redoStack.push(currentState);

  const previousState = state.history.undoStack.pop();
  if (previousState.layers && previousState.layers.length) {
    state.tiles.layers = cloneLayers(previousState.layers);
  } else if (previousState.map && previousState.map.length) {
    state.tiles.layers = [
      {
        id: "undo-legacy-layer",
        name: "Layer 1",
        visible: true,
        tiles: previousState.map.slice(),
      },
    ];
  } else {
    state.tiles.layers = [];
  }
  state.mapMaxColumn = previousState.mapMaxColumn;
  state.mapMaxRow = previousState.mapMaxRow;
  setActiveLayerIndex(previousState.activeLayerIndex ?? 0);

  saveMap();
}

export function redo() {
  if (state.history.redoStack.length === 0) return;

  const currentState = {
    layers: cloneLayers(),
    map: [...getActiveLayerTiles()],
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    activeLayerIndex: state.editing.activeLayerIndex,
  };
  state.history.undoStack.push(currentState);

  const nextState = state.history.redoStack.pop();
  if (nextState.layers && nextState.layers.length) {
    state.tiles.layers = cloneLayers(nextState.layers);
  } else if (nextState.map && nextState.map.length) {
    state.tiles.layers = [
      {
        id: "redo-legacy-layer",
        name: "Layer 1",
        visible: true,
        tiles: nextState.map.slice(),
      },
    ];
  } else {
    state.tiles.layers = [];
  }
  state.mapMaxColumn = nextState.mapMaxColumn;
  state.mapMaxRow = nextState.mapMaxRow;
  setActiveLayerIndex(nextState.activeLayerIndex ?? 0);

  saveMap();
}
