import state from "../state.js";
import { saveMap } from "./storage.js";

export function importMap(file) {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    state.mapMaxColumn = data.mapMaxColumn;
    state.mapMaxRow = data.mapMaxRow;
    state.tiles.map = data.tiles;
    saveMap();
  };
}

export function exportMap() {
  const data = {
    mapMaxColumn: state.mapMaxColumn,
    mapMaxRow: state.mapMaxRow,
    tiles: state.tiles.map,
  };
  const blob = new Blob([JSON.stringify(data)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "map.json";
  a.click();
  URL.revokeObjectURL(url);
}

