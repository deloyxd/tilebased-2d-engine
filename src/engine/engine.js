import state from "../state.js";
import { initDomReferences } from "../ui/dom.js";
import { registerUIEvents } from "../events/uiEvents.js";
import { registerInputEvents } from "../events/inputEvents.js";
import { loadImages } from "../assets/images.js";
import { loadMap, saveMap } from "../map/storage.js";
import { saveStateToUndo } from "../map/history.js";
import { displayGame, displayInfo, displayLoading } from "../render/game.js";
import {
  displayPalette,
  displayTileSelections,
  displayMoveSelection,
  movePaletteWindow,
  resizePaletteWindow,
} from "../palette/palette.js";
import { resizeLayers } from "../tiles/layers.js";

export function startEngine() {
  initDomReferences();
  registerUIEvents();
  registerInputEvents();
  requestAnimationFrame(gameLoop);
  loadImages(() => {
    refreshEngine();
    state.startGame = true;
  });
}

function gameLoop() {
  clearScreen();
  calculateFPS();
  if (!state.startGame) {
    displayLoading();
  } else {
    displayGame();
    if (state.editing.isEditing) {
      if (state.editing.isMoveSelecting || state.editing.isMoving) {
        state.palette.root.style.display = "none";
      } else {
        state.palette.root.style.display = "flex";
        displayPalette();
        displayTileSelections();
      }
      displayMoveSelection();
    }
    displayInfo();
  }
  requestAnimationFrame(gameLoop);
}

function clearScreen() {
  let screenSizeChanged = false;
  if (state.canvas.width !== window.innerWidth) {
    screenSizeChanged = true;
    state.canvas.width = window.innerWidth;
  }
  if (state.canvas.height !== window.innerHeight) {
    screenSizeChanged = true;
    state.canvas.height = window.innerHeight;
  }
  if (screenSizeChanged) {
    if (state.canvas.width > state.maxCanvasWidth)
      state.maxCanvasWidth = state.canvas.width;
    if (state.canvas.height > state.maxCanvasHeight)
      state.maxCanvasHeight = state.canvas.height;
    const newMapMaxColumn = Math.ceil(state.maxCanvasWidth / state.tiles.size);
    const newMapMaxRow = Math.ceil(state.maxCanvasHeight / state.tiles.size);
    if (
      newMapMaxColumn > state.mapMaxColumn ||
      newMapMaxRow > state.mapMaxRow
    ) {
      resizeLayers(newMapMaxColumn, newMapMaxRow);
      state.mapMaxColumn = newMapMaxColumn;
      state.mapMaxRow = newMapMaxRow;
      saveMap();
      saveStateToUndo();
    }
    refreshEngine();
  }
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  state.ctx.imageSmoothingEnabled = false;
  if (state.editing.isEditing) {
    state.palette.context.clearRect(
      0,
      0,
      state.palette.canvas.width,
      state.palette.canvas.height
    );
    state.palette.context.imageSmoothingEnabled = false;
  } else {
    state.palette.root.style.display = "none";
  }
}

function calculateFPS() {
  state.frameCount++;
  const now = performance.now();
  if (now - state.lastTime >= 1000) {
    state.fps = Math.min(state.frameCount, 60);
    state.frameCount = 0;
    state.lastTime = now;
  }
}

function refreshEngine() {
  const tileset = state.loadedImages["tileset"];
  if (!tileset) return;
  state.palette.header.innerHTML = `
  ${tileset.name}.${tileset.extension} 
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M7 9.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  const tilesetSize = tileset.size;
  state.editing.eraserBrush =
    tileset.empty.type === "null"
      ? -1
      : tileset.empty.tile[0].x +
        (tileset.image.width / tilesetSize) * tileset.empty.tile[0].y;
  state.editing.paintBrush = state.editing.eraserBrush;
  state.editing.selectedTileIndex = state.editing.eraserBrush;
  state.editing.selectedTiles = {
    startX: tileset.empty.type === "null" ? -1 : tileset.empty.tile[0].x,
    startY: tileset.empty.type === "null" ? -1 : tileset.empty.tile[0].y,
    width: 1,
    height: 1,
  };
  loadMap();
  const tilesetBG = tileset.bg || { type: "normal" };
  state.tiles.bg = [];
  const canvasMaxColumn = Math.ceil(state.canvas.width / state.tiles.size);
  const canvasMaxRow = Math.ceil(state.canvas.height / state.tiles.size);
  switch (tilesetBG.type) {
    case "group": {
      const groupWidth = tilesetBG.tile[0].w;
      const groupHeight = tilesetBG.tile[0].h;
      for (let y = 0; y < canvasMaxRow; y += groupHeight) {
        for (let x = 0; x < canvasMaxColumn; x += groupWidth) {
          for (let h = 0; h < groupHeight; h++) {
            for (let w = 0; w < groupWidth; w++) {
              const tileX = x + w;
              const tileY = y + h;
              if (tileX >= canvasMaxColumn || tileY >= canvasMaxRow) continue;
              const srcX = (tilesetBG.tile[0].x + w) * tilesetSize;
              const srcY = (tilesetBG.tile[0].y + h) * tilesetSize;
              state.tiles.bg.push({
                srcX,
                srcY,
                desX: tileX * state.tiles.size,
                desY: tileY * state.tiles.size,
              });
            }
          }
        }
      }
      break;
    }
    case "source": {
      for (let y = 0; y < canvasMaxRow; y++) {
        for (let x = 0; x < canvasMaxColumn; x++) {
          state.tiles.bg.push({
            desX: x * state.tiles.size,
            desY: y * state.tiles.size,
          });
        }
      }
      const bgImage = new Image();
      bgImage.src = `./images/${tileset.bg.name}.${tileset.bg.extension}`;
      bgImage.onload = () => {
        state.loadedImages["tileset"].bg.image = bgImage;
      };
      break;
    }
    default:
      break;
  }
  state.palette.root.style.display = state.editing.isEditing ? "flex" : "none";
  if (state.editing.isEditing) {
    resizePaletteWindow(
      tileset.image.width * 2,
      tileset.image.height * 2 + state.palette.header.clientHeight
    );
    movePaletteWindow(
      state.canvas.width / 2 - state.palette.root.clientWidth / 2,
      state.canvas.height / 2 - state.palette.root.clientHeight / 2
    );
  }
}
