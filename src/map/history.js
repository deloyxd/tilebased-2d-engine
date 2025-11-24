import state from "../state.js";
import { saveMap } from "./storage.js";

export function saveStateToUndo() {
  const snapshot = {
    map: [...state.tiles.map],
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
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
    map: [...state.tiles.map],
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
  };
  state.history.redoStack.push(currentState);

  const previousState = state.history.undoStack.pop();
  state.tiles.map = previousState.map;
  state.mapMaxColumn = previousState.mapMaxColumn;
  state.mapMaxRow = previousState.mapMaxRow;

  saveMap();
}

export function redo() {
  if (state.history.redoStack.length === 0) return;

  const currentState = {
    map: [...state.tiles.map],
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
  };
  state.history.undoStack.push(currentState);

  const nextState = state.history.redoStack.pop();
  state.tiles.map = nextState.map;
  state.mapMaxColumn = nextState.mapMaxColumn;
  state.mapMaxRow = nextState.mapMaxRow;

  saveMap();
}

