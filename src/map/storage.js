import state from "../state.js";

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
  tiles.map = data.tiles;
}

export function saveMap() {
  const data = {
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    tiles: state.tiles.map,
  };
  localStorage.setItem("map", JSON.stringify(data));
}

export function resetMap() {
  const { tiles, editing } = state;
  state.mapMaxColumn = Math.ceil(window.innerWidth / tiles.size);
  state.mapMaxRow = Math.ceil(window.innerHeight / tiles.size);
  tiles.map = new Array(state.mapMaxColumn * state.mapMaxRow).fill(
    editing.eraserBrush
  );
  saveMap();
}

