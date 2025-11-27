import state from "../state.js";
import { saveStateToUndo } from "../map/history.js";
import { importMap, exportMap, importMapFromData } from "../map/io.js";
import { resetMap } from "../map/storage.js";
import { togglePlayMode, resetPlayerState } from "../gameplay/player.js";
import {
  initFirestore,
  getAuthors,
  saveLevelToFirestore,
  getAllLevels,
} from "../map/firestore.js";

let dom = null;

export function registerUIEvents() {
  dom = state.dom;

  if (dom.testBtn) {
    dom.testBtn.addEventListener("click", togglePlayMode);
  }

  if (dom.resetPlayerBtn) {
    dom.resetPlayerBtn.addEventListener("click", () => {
      if (state.gameplay.isPlaying) {
        resetPlayerState();
      }
    });
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

  if (dom.saveAsLevelBtn) {
    dom.saveAsLevelBtn.addEventListener("click", handleSaveAsLevel);
  }

  if (dom.showAllLevelsBtn) {
    dom.showAllLevelsBtn.addEventListener("click", handleShowAllLevels);
  }

  if (dom.levelModalClose) {
    dom.levelModalClose.addEventListener("click", () => {
      if (dom.levelModal) {
        dom.levelModal.style.display = "none";
      }
    });
  }

  if (dom.levelModal) {
    dom.levelModal.addEventListener("click", (e) => {
      if (e.target === dom.levelModal) {
        dom.levelModal.style.display = "none";
      }
    });
  }
}

async function handleSaveAsLevel() {
  initFirestore();
  const authors = getAuthors();
  
  if (authors.length === 0) {
    alert("No authors configured. Please add authors in src/map/firestore.js");
    return;
  }

  const authorOptions = authors.map((author, index) => `${index + 1}. ${author}`).join("\n");
  const userInput = prompt(`Select an author:\n\n${authorOptions}\n\nEnter number (1-${authors.length}):`);
  
  if (!userInput) return;
  
  const selectedIndex = parseInt(userInput) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= authors.length) {
    alert("Invalid selection");
    return;
  }

  const selectedAuthor = authors[selectedIndex];
  const levelId = await saveLevelToFirestore(selectedAuthor);
  
  if (levelId) {
    alert(`Level saved successfully! ID: ${levelId}`);
  }
}

async function handleShowAllLevels() {
  initFirestore();
  const levels = await getAllLevels();
  
  if (!dom.levelModal || !dom.levelModalContent) return;
  
  if (levels.length === 0) {
    dom.levelModalContent.innerHTML = "<p>No levels found.</p>";
    dom.levelModal.style.display = "block";
    return;
  }

  let html = '<div style="display: grid; gap: 10px;">';
  
  levels.forEach((level) => {
    const createdAt = level.createdAt?.toDate ? level.createdAt.toDate().toLocaleString() : "Unknown";
    const updatedAt = level.updatedAt?.toDate ? level.updatedAt.toDate().toLocaleString() : "Unknown";
    
    html += `
      <div style="
        border: 1px solid #666;
        padding: 15px;
        border-radius: 4px;
        background-color: #333;
      ">
        <div style="margin-bottom: 10px;">
          <strong>Author:</strong> ${level.author || "Unknown"} | 
          <strong>Level:</strong> ${level.level || 0}
        </div>
        <div style="margin-bottom: 10px; font-size: 0.9em; color: #aaa;">
          <div>Created: ${createdAt}</div>
          <div>Updated: ${updatedAt}</div>
        </div>
        <button
          class="import-level-btn"
          data-level-id="${level.id}"
          style="
            background-color: #4a9eff;
            color: white;
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 4px;
          "
        >
          Import Map
        </button>
      </div>
    `;
  });
  
  html += "</div>";
  dom.levelModalContent.innerHTML = html;
  dom.levelModal.style.display = "block";

  const importButtons = dom.levelModalContent.querySelectorAll(".import-level-btn");
  importButtons.forEach((button) => {
    button.addEventListener("click", async (e) => {
      const levelId = e.target.getAttribute("data-level-id");
      const level = levels.find((l) => l.id === levelId);
      
      if (level && level.mapData) {
        const confirmed = confirm("Import this level? This will replace your current map.");
        if (confirmed) {
          saveStateToUndo();
          importMapFromData(level.mapData);
          dom.levelModal.style.display = "none";
        }
      }
    });
  });
}
