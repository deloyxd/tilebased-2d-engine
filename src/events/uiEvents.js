import state from "../state.js";
import { saveStateToUndo } from "../map/history.js";
import { importMap, exportMap } from "../map/io.js";
import { resetMap } from "../map/storage.js";
import { togglePlayMode } from "../gameplay/player.js";

export function registerUIEvents() {
  const { dom } = state;

  if (dom.playBtn) {
    dom.playBtn.addEventListener("click", togglePlayMode);
  }

  if (!dom.importBtn || !dom.exportBtn || !dom.resetBtn || !dom.importFileInput)
    return;

  dom.importBtn.addEventListener("click", () => {
    dom.importFileInput.click();
  });

  dom.exportBtn.addEventListener("click", exportMap);

  dom.resetBtn.addEventListener("click", () => {
    const confirmed = confirm("Are you sure you want to reset the map?");
    if (confirmed) {
      resetMap();
    }
  });

  dom.importFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      saveStateToUndo();
      importMap(e.target.files[0]);
      e.target.value = "";
    }
  });
}

