import state from "../state.js";
import {
  movePaletteWindow,
  resizePaletteWindow,
  panPaletteTileset,
  snapPaletteScrollToEdge,
} from "../palette/palette.js";
import { saveMap } from "../map/storage.js";
import { saveStateToUndo, undo, redo } from "../map/history.js";
import { cycleActiveLayer, getActiveLayerTiles } from "../tiles/layers.js";
import { getTileTypeLabel } from "../tiles/types.js";

let lastPaletteHeaderExtraText = "";

export function registerInputEvents() {
  if (!state.palette.root || !state.palette.header) return;
  const editing = state.editing;
  const { tiles } = state;

  state.palette.header.addEventListener("mousedown", (e) => {
    editing.isDragging = true;
    if (state.palette.header.style.cursor === "grab")
      state.palette.header.style.cursor = "grabbing";
    editing.dragOffsetX = e.clientX - state.palette.root.offsetLeft;
    editing.dragOffsetY = e.clientY - state.palette.root.offsetTop;
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target.id === "screen") {
      if (editing.isMoveSelecting && !editing.isMoving) {
        const tileX = Math.floor(state.pointer.x / tiles.size);
        const tileY = Math.floor(state.pointer.y / tiles.size);
        editing.moveSelectionStart = { x: tileX, y: tileY };
        editing.moveSelectionEnd = { x: tileX, y: tileY };
      } else if (!editing.isMoveSelecting) {
        if (editing.replaceState.state === 0) editing.replaceState.state = 1;
        if (!editing.isReplacing) editing.isReplacing = true;
      }
    }
  });

  document.addEventListener("mouseup", () => {
    if (editing.isDragging) {
      editing.isDragging = false;
      if (state.palette.header.style.cursor === "grabbing")
        state.palette.header.style.cursor = "grab";
    }
    if (editing.isResizing) {
      editing.isResizing = false;
      editing.resizingEdge = null;
      state.palette.rect = null;
      snapPaletteScrollToEdge();
    }
    if (editing.isScrolling) {
      editing.isScrolling = false;
      editing.paletteScrollOrigin = null;
    }
    if (editing.isSelecting) {
      editing.isSelecting = false;
      if (editing.selectionStart && editing.selectionEnd) {
        const tilesPerRow =
          state.loadedImages["tileset"].image.width /
          state.loadedImages["tileset"].size;
        const startTileX = Math.min(
          editing.selectionStart.x,
          editing.selectionEnd.x,
        );
        const startTileY = Math.min(
          editing.selectionStart.y,
          editing.selectionEnd.y,
        );
        const endTileX = Math.max(
          editing.selectionStart.x,
          editing.selectionEnd.x,
        );
        const endTileY = Math.max(
          editing.selectionStart.y,
          editing.selectionEnd.y,
        );
        editing.selectedTiles = {
          startX: startTileX,
          startY: startTileY,
          width: endTileX - startTileX + 1,
          height: endTileY - startTileY + 1,
        };
        editing.selectedTileIndex = startTileY * tilesPerRow + startTileX;
        editing.paintBrushGroup = editing.selectedTiles;
        editing.paintBrush = editing.selectedTileIndex;
      }
      editing.selectionStart = null;
      editing.selectionEnd = null;
    }
    if (
      editing.isMoveSelecting &&
      editing.moveSelectionStart &&
      editing.moveSelectionEnd &&
      !editing.isMoving
    ) {
      saveMap();
      saveStateToUndo();
      const startX = Math.min(
        editing.moveSelectionStart.x,
        editing.moveSelectionEnd.x,
      );
      const startY = Math.min(
        editing.moveSelectionStart.y,
        editing.moveSelectionEnd.y,
      );
      const endX = Math.max(
        editing.moveSelectionStart.x,
        editing.moveSelectionEnd.x,
      );
      const endY = Math.max(
        editing.moveSelectionStart.y,
        editing.moveSelectionEnd.y,
      );

      editing.moveSelectedTiles = {
        startX,
        startY,
        width: endX - startX + 1,
        height: endY - startY + 1,
      };

      editing.moveTilesData = [];
      const activeLayerTiles = getActiveLayerTiles();
      for (let h = 0; h < editing.moveSelectedTiles.height; h++) {
        for (let w = 0; w < editing.moveSelectedTiles.width; w++) {
          const tileX = startX + w;
          const tileY = startY + h;
          if (
            tileX >= 0 &&
            tileX < state.mapMaxColumn &&
            tileY >= 0 &&
            tileY < state.mapMaxRow
          ) {
            const mapIndex = tileY * state.mapMaxColumn + tileX;
            editing.moveTilesData.push(activeLayerTiles[mapIndex]);
            activeLayerTiles[mapIndex] = editing.eraserBrush;
          }
        }
      }

      editing.isMoving = true;
      editing.moveSelectedLayerIndex = state.editing.activeLayerIndex;
      editing.moveSelectionStart = null;
      editing.moveSelectionEnd = null;
    } else if (editing.isMoving) {
      const offsetX = Math.floor(editing.moveSelectedTiles.width / 2);
      const offsetY = Math.floor(editing.moveSelectedTiles.height / 2);
      const startTileX = Math.floor(state.pointer.x / tiles.size) - offsetX;
      const startTileY = Math.floor(state.pointer.y / tiles.size) - offsetY;

      let dataIndex = 0;
      const targetLayerTiles = getActiveLayerTiles();
      for (let h = 0; h < editing.moveSelectedTiles.height; h++) {
        for (let w = 0; w < editing.moveSelectedTiles.width; w++) {
          const tileX = startTileX + w;
          const tileY = startTileY + h;

          if (
            tileX >= 0 &&
            tileX < state.mapMaxColumn &&
            tileY >= 0 &&
            tileY < state.mapMaxRow
          ) {
            const mapIndex = tileY * state.mapMaxColumn + tileX;
            if (!state.tiles.empty.includes(editing.moveTilesData[dataIndex])) {
              targetLayerTiles[mapIndex] = editing.moveTilesData[dataIndex];
            }
          }
          dataIndex++;
        }
      }

      editing.isMoving = false;
      editing.isMoveSelecting = false;
      editing.moveSelectedTiles = {};
      editing.moveTilesData = [];
      editing.moveSelectedLayerIndex = null;
    }
    if (editing.replaceState.state === 2) {
      editing.replaceState.state = 0;
    }
    if (editing.isReplacing) editing.isReplacing = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (state.gameplay.isPlaying && e.target.id === "screen") {
      state.pointer.x = e.clientX;
      state.pointer.y = e.clientY;
    }

    if (e.target.id === "screen" && state.loadedImages["tileset"]) {
      updatePaletteHeader(
        `| Selected tile #${editing.selectedTileIndex} | ${getTileTypeLabel(
          editing.selectedTileIndex,
        )}`,
      );
      state.pointer.x = e.clientX;
      state.pointer.y = e.clientY;

      if (editing.isMoveSelecting && !editing.isMoving) {
        const tileX = Math.floor(state.pointer.x / tiles.size);
        const tileY = Math.floor(state.pointer.y / tiles.size);
        editing.moveSelectionEnd = { x: tileX, y: tileY };
      }
    }
    if (editing.isDragging) {
      state.palette.header.style.cursor = "grabbing";
      movePaletteWindow(
        e.clientX - editing.dragOffsetX,
        e.clientY - editing.dragOffsetY,
      );
    }
    if (editing.isResizing && state.palette.rect) {
      const minSize = 100;
      const maxWidth = state.loadedImages["tileset"].image.width * 2;
      const maxHeight =
        state.loadedImages["tileset"].image.height * 2 +
        state.palette.header.clientHeight;
      let newWidth;
      let newHeight;
      if (editing.resizingEdge.includes("right")) {
        newWidth = Math.max(
          Math.min(e.clientX - state.palette.rect.left, maxWidth),
          minSize,
        );
      }
      if (editing.resizingEdge.includes("bottom")) {
        newHeight = Math.max(
          Math.min(e.clientY - state.palette.rect.top, maxHeight),
          minSize,
        );
      }
      if (editing.resizingEdge.includes("left")) {
        newWidth = Math.max(
          Math.min(
            state.palette.rect.right -
              e.clientX -
              state.palette.borderWidth * 2,
            maxWidth,
          ),
          minSize,
        );
        state.palette.root.style.left = `${Math.min(
          Math.max(
            e.clientX,
            state.palette.rect.right - maxWidth - state.palette.borderWidth * 2,
          ),
          state.palette.rect.right - minSize,
        )}px`;
      }
      if (editing.resizingEdge.includes("top")) {
        newHeight = Math.max(
          Math.min(
            state.palette.rect.bottom -
              e.clientY -
              state.palette.borderWidth * 2,
            maxHeight,
          ),
          minSize,
        );
        state.palette.root.style.top = `${Math.min(
          Math.max(
            e.clientY,
            state.palette.rect.bottom -
              maxHeight -
              state.palette.borderWidth * 2,
          ),
          state.palette.rect.bottom - minSize,
        )}px`;
      }
      resizePaletteWindow(newWidth, newHeight);
      snapPaletteScrollToEdge(editing.resizingEdge || "");
    }
  });

  state.palette.root.addEventListener("mousemove", (e) => {
    if (!state.loadedImages["tileset"]) return;
    const rect = state.palette.root.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - state.palette.borderWidth;
    if (mouseX <= 150 && !editing.resizingEdge)
      state.palette.header.style.cursor = "pointer";
    else state.palette.header.style.cursor = "grab";
    if (editing.isResizing) return;

    const paletteTileSize =
      state.loadedImages["tileset"].size *
      state.constants.PALETTE_TILE_SIZE_SCALE;
    let mouseY =
      e.clientY -
      rect.top -
      state.palette.borderWidth -
      state.palette.header.clientHeight;
    const tilesPerRow =
      state.loadedImages["tileset"].image.width /
      state.loadedImages["tileset"].size;
    const tileX = Math.floor(
      (mouseX + editing.paletteScrollX) / paletteTileSize,
    );
    const tileY = Math.floor(
      (mouseY + editing.paletteScrollY) / paletteTileSize,
    );
    const tileIndex = tileY * tilesPerRow + tileX;
    const tileDescriptor =
      tileIndex < 0
        ? ""
        : ` | Tile #${tileIndex} (${tileX}, ${tileY}) | ${getTileTypeLabel(
            tileIndex,
          )}`;
    updatePaletteHeader(`${tileDescriptor}`);

    if (editing.isSelecting && editing.selectionStart) {
      editing.selectionEnd = { x: tileX, y: tileY };
    }

    if (editing.isScrolling && editing.paletteScrollOrigin) {
      const dx = e.clientX - editing.paletteScrollOrigin.x;
      const dy = e.clientY - editing.paletteScrollOrigin.y;
      editing.paletteScrollOrigin.x = e.clientX;
      editing.paletteScrollOrigin.y = e.clientY;
      panPaletteTileset(dx, dy);
      return;
    }

    mouseY += state.palette.header.clientHeight;
    editing.resizingEdge = null;

    if (mouseX < state.constants.RESIZE_MARGIN) editing.resizingEdge = "left";
    else if (mouseX > rect.width - state.constants.RESIZE_MARGIN)
      editing.resizingEdge = "right";

    if (mouseY < state.constants.RESIZE_MARGIN)
      editing.resizingEdge = editing.resizingEdge
        ? "top-" + editing.resizingEdge
        : "top";
    else if (mouseY > rect.height - state.constants.RESIZE_MARGIN)
      editing.resizingEdge = editing.resizingEdge
        ? "bottom-" + editing.resizingEdge
        : "bottom";

    state.palette.root.style.cursor = resizeCursor(editing.resizingEdge);
  });

  state.palette.root.addEventListener("mousedown", (e) => {
    if (!state.loadedImages["tileset"]) return;
    if (editing.resizingEdge) {
      editing.isResizing = true;
      state.palette.rect = state.palette.root.getBoundingClientRect();
    } else if (!editing.isDragging) {
      if (e.ctrlKey) {
        editing.isScrolling = true;
        editing.paletteScrollOrigin = { x: e.clientX, y: e.clientY };
      } else {
        editing.isSelecting = true;
        const paletteTileSize =
          state.loadedImages["tileset"].size *
          state.constants.PALETTE_TILE_SIZE_SCALE;
        const rect = state.palette.root.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - state.palette.borderWidth;
        const mouseY =
          e.clientY -
          rect.top -
          state.palette.borderWidth -
          state.palette.header.clientHeight;
        const tileX = Math.floor(
          (mouseX + editing.paletteScrollX) / paletteTileSize,
        );
        const tileY = Math.floor(
          (mouseY + editing.paletteScrollY) / paletteTileSize,
        );
        editing.selectionStart = { x: tileX, y: tileY };
        editing.selectionEnd = { x: tileX, y: tileY };
        const tilesPerRow =
          state.loadedImages["tileset"].image.width /
          state.loadedImages["tileset"].size;
        const tileIndex = tileY * tilesPerRow + tileX;
        editing.isErasing = state.tiles.empty.includes(tileIndex);
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!state.loadedImages["tileset"]) return;
    if (e.ctrlKey) {
      if (e.key === "z" && !e.shiftKey) {
        undo();
        return;
      } else if (e.key === "Z" && e.shiftKey) {
        redo();
        return;
      }
    }
    if (e.key === "," || e.key === ".") {
      e.preventDefault();
      cycleActiveLayer(e.key === "," ? -1 : 1);
      updatePaletteHeader(
        `| Selected tile #${editing.selectedTileIndex} | ${getTileTypeLabel(
          editing.selectedTileIndex,
        )}`,
      );
      return;
    }
    if (e.key === "/") {
      editing.isOpacityEnabled = !editing.isOpacityEnabled;
      return;
    }
    if (e.key === "[" || e.key === "]") {
      e.preventDefault();
      adjustBrushSize(e.key === "[" ? -1 : 1);
      return;
    }
    if (!["e", "b", "m", "d", "Escape", "a"].includes(e.key)) return;
    editing.isErasing = false;
    switch (e.key) {
      case "e":
        selectEraser();
        break;
      case "b":
        selectBrush();
        break;
      case "m":
        selectMove();
        break;
      case "Escape":
      case "d":
        deselect();
        break;
      case "a":
        if (editing.isEditing)
          editing.isAutotilingEnabled = !editing.isAutotilingEnabled;
        break;
    }
    updatePaletteHeader(
      `| Selected tile #${editing.selectedTileIndex} | ${getTileTypeLabel(
        editing.selectedTileIndex,
      )}`,
    );
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Control" && editing.isScrolling) {
      editing.isScrolling = false;
    }
  });
}

export function selectEraser() {
  const editing = state.editing;
  if (editing.isMoveSelecting) {
    editing.isMoveSelecting = false;
  }
  editing.isErasing = true;
  editing.selectedTileIndex = editing.eraserBrush;
  editing.selectedTiles = {
    startX:
      state.loadedImages["tileset"].empty.type === "null"
        ? -1
        : state.loadedImages["tileset"].empty.tile[0].x,
    startY:
      state.loadedImages["tileset"].empty.type === "null"
        ? -1
        : state.loadedImages["tileset"].empty.tile[0].y,
    width: 1,
    height: 1,
  };
}

export function selectBrush() {
  const editing = state.editing;
  if (editing.isMoveSelecting) {
    editing.isMoveSelecting = false;
  }
  if (
    (editing.paintBrushGroup.startX ===
      (state.loadedImages["tileset"].empty.type === "null"
        ? -1
        : state.loadedImages["tileset"].empty.tile[0].x) &&
      editing.paintBrushGroup.startY ===
        (state.loadedImages["tileset"].empty.type === "null"
          ? -1
          : state.loadedImages["tileset"].empty.tile[0].y)) ||
    (editing.paintBrushGroup !== null &&
      Object.keys(editing.paintBrushGroup).length === 0)
  ) {
    editing.selectedTileIndex =
      state.loadedImages["tileset"].paint.tile[0].y *
        (state.loadedImages["tileset"].image.width /
          state.loadedImages["tileset"].size) +
      state.loadedImages["tileset"].paint.tile[0].x;
    editing.selectedTiles = {
      startX: state.loadedImages["tileset"].paint.tile[0].x,
      startY: state.loadedImages["tileset"].paint.tile[0].y,
      width: 1,
      height: 1,
    };
  } else {
    editing.selectedTileIndex = editing.paintBrush;
    editing.selectedTiles = editing.paintBrushGroup;
  }
}

export function selectMove() {
  const { tiles } = state;
  const editing = state.editing;
  if (!editing.isMoveSelecting) {
    editing.isMoveSelecting = true;
    if (!editing.moveSelectionStart) {
      const tileX = Math.floor(state.pointer.x / tiles.size);
      const tileY = Math.floor(state.pointer.y / tiles.size);
      editing.moveSelectionEnd = { x: tileX, y: tileY };
    }
  }
}

export function deselect() {
  const editing = state.editing;
  if (editing.isMoving) {
    const startX = editing.moveSelectedTiles.startX;
    const startY = editing.moveSelectedTiles.startY;
    const sourceLayerIndex =
      editing.moveSelectedLayerIndex ?? state.editing.activeLayerIndex;
    const sourceLayer =
      state.tiles.layers[sourceLayerIndex] ||
      state.tiles.layers[state.editing.activeLayerIndex];
    const restoreTiles = sourceLayer
      ? sourceLayer.tiles
      : getActiveLayerTiles();
    let dataIndex = 0;
    for (let h = 0; h < editing.moveSelectedTiles.height; h++) {
      for (let w = 0; w < editing.moveSelectedTiles.width; w++) {
        const tileX = startX + w;
        const tileY = startY + h;
        if (
          tileX >= 0 &&
          tileX < state.mapMaxColumn &&
          tileY >= 0 &&
          tileY < state.mapMaxRow
        ) {
          const mapIndex = tileY * state.mapMaxColumn + tileX;
          restoreTiles[mapIndex] = editing.moveTilesData[dataIndex];
        }
        dataIndex++;
      }
    }
    saveMap();
    saveStateToUndo();
  }
  editing.isMoveSelecting = false;
  editing.isMoving = false;
  editing.moveSelectedTiles = {};
  editing.moveTilesData = [];
  editing.moveSelectionStart = null;
  editing.moveSelectedLayerIndex = null;
}

function resizeCursor(edge) {
  switch (edge) {
    case "left":
    case "right":
      return "ew-resize";
    case "top":
    case "bottom":
      return "ns-resize";
    case "top-left":
    case "bottom-right":
      return "nwse-resize";
    case "top-right":
    case "bottom-left":
      return "nesw-resize";
    default:
      return "default";
  }
}

export function updatePaletteHeader(extraText) {
  if (extraText !== undefined) {
    lastPaletteHeaderExtraText = extraText;
  } else {
    extraText = lastPaletteHeaderExtraText;
  }
  if (!state.loadedImages["tileset"] || !state.palette.header) return;
  const dropDownSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M7 9.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  state.palette.header.innerHTML = `
  ${state.loadedImages["tileset"].name}.${
    state.loadedImages["tileset"].extension
  }
  ${extraText || ""}
  `;
}

function adjustBrushSize(delta) {
  const { BRUSH_MIN_SIZE, BRUSH_MAX_SIZE } = state.constants;
  const editing = state.editing;
  const nextSize = Math.min(
    BRUSH_MAX_SIZE,
    Math.max(BRUSH_MIN_SIZE, editing.brushSize + delta),
  );
  if (nextSize === editing.brushSize) return;
  editing.brushSize = nextSize;
  updatePaletteHeader();
}
