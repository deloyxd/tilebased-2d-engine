import state from "../state.js";
import { saveStateToUndo } from "../map/history.js";
import { importMap, exportMap, importMapFromData } from "../map/io.js";
import { resetMap, saveLastLoadedLevel } from "../map/storage.js";
import { togglePlayMode, resetPlayerState } from "../gameplay/player.js";
import {
  initFirestore,
  getAuthors,
  saveLevelToFirestore,
  getAllLevels,
  updateLevelToFirestore,
  deleteLevelFromFirestore,
} from "../map/firestore.js";
import { displayBackground } from "../render/game.js";

let dom = null;
let selectionHandlersInitialized = false;

function isMapEmpty() {
  if (!state.tiles.layers || state.tiles.layers.length === 0) {
    return true;
  }

  const emptyTileValues = new Set(state.tiles.empty);
  if (state.editing.eraserBrush !== undefined) {
    emptyTileValues.add(state.editing.eraserBrush);
  }

  for (const layer of state.tiles.layers) {
    if (!layer.tiles || layer.tiles.length === 0) {
      continue;
    }
    for (const tile of layer.tiles) {
      if (!emptyTileValues.has(tile)) {
        return false;
      }
    }
  }

  return true;
}

export function updateSaveButtonVisibility() {
  if (!dom) return;

  const isEmpty = isMapEmpty();
  const hasLoadedLevel =
    state.lastLoadedLevel.id && state.lastLoadedLevel.author;

  if (dom.saveLevelBtn) {
    dom.saveLevelBtn.style.display = !isEmpty && hasLoadedLevel ? "" : "none";
  }

  if (dom.saveAsLevelBtn) {
    dom.saveAsLevelBtn.style.display = !isEmpty ? "" : "none";
  }
}

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
      updateSaveButtonVisibility();
    }
  });

  dom.importFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      saveStateToUndo();
      importMap(e.target.files[0]);
      state.lastLoadedLevel.id = null;
      state.lastLoadedLevel.author = null;
      saveLastLoadedLevel();
      updateSaveButtonVisibility();
      e.target.value = "";
    }
  });

  if (dom.saveAsLevelBtn) {
    dom.saveAsLevelBtn.addEventListener("click", handleSaveAsLevel);
  }

  if (dom.saveLevelBtn) {
    dom.saveLevelBtn.addEventListener("click", handleSaveLevel);
  }

  if (dom.showAllLevelsBtn) {
    dom.showAllLevelsBtn.addEventListener("click", handleShowAllLevels);
  }

  if (dom.levelModalClose) {
    dom.levelModalClose.addEventListener("click", () => {
      if (dom.levelModal) {
        dom.levelModal.style.display = "none";
        const selectAllBtn = document.getElementById("selectAllLevelsBtn");
        const deleteSelectedBtn = document.getElementById(
          "deleteSelectedLevelsBtn"
        );
        if (selectAllBtn) {
          selectAllBtn.style.display = "none";
          selectAllBtn.textContent = "Select All";
        }
        if (deleteSelectedBtn) {
          deleteSelectedBtn.style.display = "none";
        }
      }
    });
  }

  if (dom.levelModal) {
    dom.levelModal.addEventListener("click", (e) => {
      if (e.target === dom.levelModal) {
        dom.levelModal.style.display = "none";
        const selectAllBtn = document.getElementById("selectAllLevelsBtn");
        const deleteSelectedBtn = document.getElementById(
          "deleteSelectedLevelsBtn"
        );
        if (selectAllBtn) {
          selectAllBtn.style.display = "none";
          selectAllBtn.textContent = "Select All";
        }
        if (deleteSelectedBtn) {
          deleteSelectedBtn.style.display = "none";
        }
      }
    });
  }

  updateSaveButtonVisibility();
}

async function handleSaveAsLevel() {
  initFirestore();
  const authors = getAuthors();

  if (authors.length === 0) {
    alert("No authors configured. Please add authors in src/map/firestore.js");
    return;
  }

  const authorOptions = authors
    .map((author, index) => `${index + 1}. ${author}`)
    .join("\n");
  const userInput = prompt(
    `Select an author:\n\n${authorOptions}\n\nEnter number (1-${authors.length}):`
  );

  if (!userInput) return;

  const selectedIndex = parseInt(userInput) - 1;
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= authors.length
  ) {
    alert("Invalid selection");
    return;
  }

  const selectedAuthor = authors[selectedIndex];
  const levelId = await saveLevelToFirestore(selectedAuthor);

  if (levelId) {
    alert(`Level saved successfully! ID: ${levelId}`);
  }
}

async function handleSaveLevel() {
  if (!state.lastLoadedLevel.id || !state.lastLoadedLevel.author) {
    alert(
      "No map loaded. Please load a map first using 'Load Map' > 'Import Map'."
    );
    return;
  }

  const userInput = prompt("Enter your full name to confirm:");

  if (!userInput) return;

  const enteredName = userInput.trim();
  const mapAuthor = state.lastLoadedLevel.author;

  if (enteredName !== mapAuthor) {
    alert(
      "Name does not match the author of the loaded map. Update cancelled."
    );
    return;
  }

  initFirestore();
  const success = await updateLevelToFirestore(state.lastLoadedLevel.id);

  if (success) {
    alert("Map updated successfully!");
  }
}

async function handleShowAllLevels() {
  if (!dom.showAllLevelsBtn || !dom.levelModal || !dom.levelModalContent)
    return;

  const originalButtonText = dom.showAllLevelsBtn.textContent;
  dom.showAllLevelsBtn.disabled = true;
  dom.showAllLevelsBtn.textContent = "Loading...";

  try {
    initFirestore();
    const levels = await getAllLevels();

    if (levels.length === 0) {
      dom.levelModalContent.innerHTML = "<p>No levels designs found.</p>";
      dom.levelModal.style.display = "block";
      return;
    }

    let html = '<div style="display: grid; gap: 10px;">';

    levels.forEach((level, index) => {
      const id = level.id;
      const createdAt = level.createdAt?.toDate
        ? level.createdAt.toDate().toLocaleString()
        : "Unknown";
      const updatedAt = level.updatedAt?.toDate
        ? level.updatedAt.toDate().toLocaleString()
        : "Unknown";

      html += `
        <div style="
          border: 1px solid #666;
          padding: 15px;
          border-radius: 4px;
          background-color: #333;
          display: flex;
          gap: 15px;
        ">
          <div style="
            flex: 1;
            display: flex;
            flex-direction: column;
          ">
            <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
              <input
                type="checkbox"
                class="level-checkbox"
                data-level-id="${level.id}"
                style="
                  width: 18px;
                  height: 18px;
                  cursor: pointer;
                "
              />
              <div>
                <strong>Author:</strong> ${level.author || "Unknown"}
              </div>
            </div>
            <div style="margin-bottom: 10px; font-size: 0.95em;">
              <strong>Level:</strong> ${
                (level.level || 0) === 0 ? "N/A" : level.level
              }
            </div>
            <div style="font-size: 0.9em; color: #aaa;">
              <div>Created: ${createdAt}</div>
              <div>Updated: ${updatedAt}</div>
              <br>
              <div>ID: ${id}</div>
            </div>
          </div>
          <div style="
            width: 200px;
            height: 150px;
            border: 1px solid #555;
            border-radius: 4px;
            background-color: #222;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            flex-shrink: 0;
          ">
            <div class="level-preview-loading" data-level-index="${index}" style="
              color: #aaa;
              font-size: 0.9em;
            ">Loading preview...</div>
            <canvas 
              class="level-preview-canvas" 
              data-level-index="${index}"
              style="
                display: none;
                max-width: 100%;
                max-height: 100%;
                image-rendering: pixelated;
              "
            ></canvas>
            <button
              class="import-level-btn"
              data-level-id="${level.id}"
              style="
                position: absolute;
                bottom: 5px;
                right: 5px;
                background-color:rgb(255, 255, 255);
                color: black;
                border: 1px solid #666;
                padding: 6px 12px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 0.85em;
                z-index: 10;
              "
            >
              Import Map
            </button>
          </div>
        </div>
      `;
    });

    html += "</div>";
    dom.levelModalContent.innerHTML = html;
    dom.levelModal.style.display = "block";

    const selectAllBtn = document.getElementById("selectAllLevelsBtn");
    const deleteSelectedBtn = document.getElementById(
      "deleteSelectedLevelsBtn"
    );
    const checkboxes =
      dom.levelModalContent.querySelectorAll(".level-checkbox");
    const importButtons =
      dom.levelModalContent.querySelectorAll(".import-level-btn");

    function updateButtonVisibility() {
      const currentCheckboxes =
        dom.levelModalContent.querySelectorAll(".level-checkbox");
      const currentImportButtons =
        dom.levelModalContent.querySelectorAll(".import-level-btn");
      const hasSelection = Array.from(currentCheckboxes).some(
        (cb) => cb.checked
      );
      const allChecked = Array.from(currentCheckboxes).every(
        (cb) => cb.checked
      );
      if (selectAllBtn) {
        selectAllBtn.style.display = hasSelection ? "block" : "none";
        if (hasSelection) {
          selectAllBtn.textContent = allChecked ? "Deselect All" : "Select All";
        }
      }
      if (deleteSelectedBtn) {
        deleteSelectedBtn.style.display = hasSelection ? "block" : "none";
      }
      currentImportButtons.forEach((button) => {
        button.style.display = hasSelection ? "none" : "block";
      });
    }

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", updateButtonVisibility);
    });

    if (!selectionHandlersInitialized) {
      if (selectAllBtn) {
        selectAllBtn.addEventListener("click", function selectAllHandler() {
          const currentCheckboxes =
            dom.levelModalContent.querySelectorAll(".level-checkbox");
          const allChecked = Array.from(currentCheckboxes).every(
            (cb) => cb.checked
          );
          currentCheckboxes.forEach((checkbox) => {
            checkbox.checked = !allChecked;
          });
          if (selectAllBtn) {
            selectAllBtn.textContent = allChecked
              ? "Select All"
              : "Deselect All";
          }
          updateButtonVisibility();
        });
      }

      if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener(
          "click",
          async function deleteSelectedHandler() {
            const currentCheckboxes =
              dom.levelModalContent.querySelectorAll(".level-checkbox");
            const selectedIds = Array.from(currentCheckboxes)
              .filter((cb) => cb.checked)
              .map((cb) => cb.getAttribute("data-level-id"));

            if (selectedIds.length === 0) return;

            const count = selectedIds.length;
            const confirmMessage = `Are you sure you want to permanently delete ${count} level design${
              count > 1 ? "s" : ""
            }? This action cannot be undone.\n\nType "DELETE" to confirm:`;
            const userInput = prompt(confirmMessage);

            if (userInput !== "DELETE") {
              return;
            }

            const confirmed = confirm(
              `This will permanently delete ${count} level design${
                count > 1 ? "s" : ""
              }. Are you absolutely sure?`
            );

            if (!confirmed) {
              return;
            }

            let successCount = 0;
            let failCount = 0;

            for (const levelId of selectedIds) {
              const success = await deleteLevelFromFirestore(levelId);
              if (success) {
                successCount++;
              } else {
                failCount++;
              }
            }

            if (successCount > 0) {
              alert(
                `Successfully deleted ${successCount} level design${
                  successCount > 1 ? "s" : ""
                }.${
                  failCount > 0
                    ? ` Failed to delete ${failCount} level design${
                        failCount > 1 ? "s" : ""
                      }.`
                    : ""
                }`
              );
              await handleShowAllLevels();
              const selectAllBtn =
                document.getElementById("selectAllLevelsBtn");
              const deleteSelectedBtn = document.getElementById(
                "deleteSelectedLevelsBtn"
              );
              if (selectAllBtn) {
                selectAllBtn.style.display = "none";
                selectAllBtn.textContent = "Select All";
              }
              if (deleteSelectedBtn) {
                deleteSelectedBtn.style.display = "none";
              }
            } else {
              alert(
                `Failed to delete level design${failCount > 1 ? "s" : ""}.`
              );
            }
          }
        );
      }
      selectionHandlersInitialized = true;
    }

    importButtons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        const levelId = e.target.getAttribute("data-level-id");
        const level = levels.find((l) => l.id === levelId);

        if (level && level.mapData) {
          const confirmed = confirm(
            "Import this level? This will replace your current map."
          );
          if (confirmed) {
            saveStateToUndo();
            importMapFromData(level.mapData);
            state.lastLoadedLevel.id = level.id;
            state.lastLoadedLevel.author = level.author || null;
            saveLastLoadedLevel();
            updateSaveButtonVisibility();
            dom.levelModal.style.display = "none";
          }
        }
      });
    });

    levels.forEach((level, index) => {
      if (level.mapData) {
        renderLevelPreview(level.mapData, index);
      }
    });
  } finally {
    dom.showAllLevelsBtn.disabled = false;
    dom.showAllLevelsBtn.textContent = originalButtonText;
  }
}

function renderLevelPreview(mapData, index) {
  if (!state.loadedImages["tileset"] || !state.loadedImages["tileset"].image) {
    setTimeout(() => renderLevelPreview(mapData, index), 100);
    return;
  }

  const canvas = dom.levelModalContent.querySelector(
    `.level-preview-canvas[data-level-index="${index}"]`
  );
  const loadingDiv = dom.levelModalContent.querySelector(
    `.level-preview-loading[data-level-index="${index}"]`
  );

  if (!canvas || !loadingDiv) return;

  const previewTileSize = 4;
  const maxPreviewWidth = 200;
  const maxPreviewHeight = 150;

  const mapMaxColumn = mapData.mapMaxColumn || 0;
  const mapMaxRow = mapData.mapMaxRow || 0;

  if (mapMaxColumn === 0 || mapMaxRow === 0) {
    loadingDiv.textContent = "No map data";
    return;
  }

  const mapWidth = mapMaxColumn * previewTileSize;
  const mapHeight = mapMaxRow * previewTileSize;

  const scaleX = maxPreviewWidth / mapWidth;
  const scaleY = maxPreviewHeight / mapHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  canvas.width = mapWidth * scale;
  canvas.height = mapHeight * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const tilesetImage = state.loadedImages["tileset"].image;
  const tilesetSize = state.loadedImages["tileset"].size;
  const tilesPerRow = tilesetImage.width / tilesetSize;

  const layers = mapData.layers || [];
  if (layers.length === 0 && mapData.tiles) {
    layers.push({
      name: "Layer 1",
      visible: true,
      tiles: mapData.tiles,
    });
  }

  displayBackground(canvas, ctx);

  for (const layer of layers) {
    if (layer.visible === false) continue;
    const layerTiles = layer.tiles || [];

    for (let i = 0; i < layerTiles.length; i++) {
      const tileIndex = layerTiles[i];
      if (tileIndex === -1 || tileIndex === undefined) continue;

      const srcX = (tileIndex % tilesPerRow) * tilesetSize;
      const srcY = Math.floor(tileIndex / tilesPerRow) * tilesetSize;

      const destX = (i % mapMaxColumn) * previewTileSize * scale;
      const destY = Math.floor(i / mapMaxColumn) * previewTileSize * scale;
      const destSize = previewTileSize * scale;

      ctx.drawImage(
        tilesetImage,
        srcX,
        srcY,
        tilesetSize,
        tilesetSize,
        destX,
        destY,
        destSize,
        destSize
      );
    }
  }

  loadingDiv.style.display = "none";
  canvas.style.display = "block";
}
