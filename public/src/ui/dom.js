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
    10,
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
  state.dom.createNewMapBtn = document.getElementById("createNewMapBtn");
  state.dom.revertBtn = document.getElementById("revertBtn");
  state.dom.landingPage = document.getElementById("landingPage");
  state.dom.landingPageLoading = document.getElementById("landingPageLoading");
  state.dom.landingPageContent = document.getElementById("landingPageContent");
  state.dom.playGameBtn = document.getElementById("playGameBtn");
  state.dom.editLevelsBtn = document.getElementById("editLevelsBtn");
  state.dom.exitMapBtn = document.getElementById("exitMapBtn");
  state.dom.passwordModal = document.getElementById("passwordModal");
  state.dom.passwordInput = document.getElementById("passwordInput");
  state.dom.togglePasswordBtn = document.getElementById("togglePasswordBtn");
  state.dom.passwordSubmitBtn = document.getElementById("passwordSubmitBtn");
  state.dom.passwordCancelBtn = document.getElementById("passwordCancelBtn");
  state.dom.passwordError = document.getElementById("passwordError");

  return state;
}
