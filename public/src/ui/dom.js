import state from "../state.js";

export function initDomReferences() {
  state.canvas = document.getElementById("screen");
  state.ctx = state.canvas.getContext("2d");

  state.palette.root = document.getElementById("palette");
  state.palette.header = document.getElementById("palette-header");
  state.palette.canvas = document.getElementById("palette-canvas");
  state.palette.context = state.palette.canvas.getContext("2d");
  state.palette.borderWidth = parseInt(
    getComputedStyle(state.palette.root).borderWidth,
    10
  );

  state.dom.testBtn = document.getElementById("testBtn");
  state.dom.importBtn = document.getElementById("importBtn");
  state.dom.exportBtn = document.getElementById("exportBtn");
  state.dom.resetBtn = document.getElementById("resetBtn");
  state.dom.resetPlayerBtn = document.getElementById("resetPlayerBtn");
  state.dom.importFileInput = document.getElementById("importFile");
  state.dom.saveAsLevelBtn = document.getElementById("saveAsLevelBtn");
  state.dom.saveLevelBtn = document.getElementById("saveLevelBtn");
  state.dom.showAllLevelsBtn = document.getElementById("showAllLevelsBtn");
  state.dom.levelModal = document.getElementById("levelModal");
  state.dom.levelModalClose = document.getElementById("levelModalClose");
  state.dom.levelModalContent = document.getElementById("levelModalContent");
  state.dom.revertBtn = document.getElementById("revertBtn");

  return state;
}

