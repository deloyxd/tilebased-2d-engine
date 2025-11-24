import state from "../state.js";
import { movePaletteWindow, resizePaletteWindow } from "../palette/palette.js";
import { saveMap } from "../map/storage.js";
import { saveStateToUndo, undo, redo } from "../map/history.js";

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
          editing.selectionEnd.x
        );
        const startTileY = Math.min(
          editing.selectionStart.y,
          editing.selectionEnd.y
        );
        const endTileX = Math.max(
          editing.selectionStart.x,
          editing.selectionEnd.x
        );
        const endTileY = Math.max(
          editing.selectionStart.y,
          editing.selectionEnd.y
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
        editing.moveSelectionEnd.x
      );
      const startY = Math.min(
        editing.moveSelectionStart.y,
        editing.moveSelectionEnd.y
      );
      const endX = Math.max(
        editing.moveSelectionStart.x,
        editing.moveSelectionEnd.x
      );
      const endY = Math.max(
        editing.moveSelectionStart.y,
        editing.moveSelectionEnd.y
      );

      editing.moveSelectedTiles = {
        startX,
        startY,
        width: endX - startX + 1,
        height: endY - startY + 1,
      };

      editing.moveTilesData = [];
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
            editing.moveTilesData.push(state.tiles.map[mapIndex]);
            state.tiles.map[mapIndex] = editing.eraserBrush;
          }
        }
      }

      editing.isMoving = true;
      editing.moveSelectionStart = null;
      editing.moveSelectionEnd = null;
    } else if (editing.isMoving) {
      const offsetX = Math.floor(editing.moveSelectedTiles.width / 2);
      const offsetY = Math.floor(editing.moveSelectedTiles.height / 2);
      const startTileX = Math.floor(state.pointer.x / tiles.size) - offsetX;
      const startTileY = Math.floor(state.pointer.y / tiles.size) - offsetY;

      let dataIndex = 0;
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
              state.tiles.map[mapIndex] = editing.moveTilesData[dataIndex];
            }
          }
          dataIndex++;
        }
      }

      editing.isMoving = false;
      editing.isMoveSelecting = false;
      editing.moveSelectedTiles = {};
      editing.moveTilesData = [];
    }
    if (editing.replaceState.state === 2) {
      editing.replaceState.state = 0;
    }
    if (editing.isReplacing) editing.isReplacing = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (e.target.id === "screen" && state.loadedImages["tileset"]) {
      state.palette.header.innerHTML = `
        ${state.loadedImages["tileset"].name}.${state.loadedImages["tileset"].extension}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <path d="M7 9.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        | Selected tile #${editing.selectedTileIndex}
      `;
      state.pointer.x = e.clientX;
      state.pointer.y = e.clientY;

      if (editing.isMoveSelecting && !editing.isMoving) {
        const tileX = Math.floor(state.pointer.x / tiles.size);
        const tileY = Math.floor(state.pointer.y / tiles.size);
        editing.moveSelectionEnd = { x: tileX, y: tileY };
      }
    }
    if (editing.isDragging)
      movePaletteWindow(
        e.clientX - editing.dragOffsetX,
        e.clientY - editing.dragOffsetY
      );
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
          minSize
        );
      }
      if (editing.resizingEdge.includes("bottom")) {
        newHeight = Math.max(
          Math.min(e.clientY - state.palette.rect.top, maxHeight),
          minSize
        );
      }
      if (editing.resizingEdge.includes("left")) {
        newWidth = Math.max(
          Math.min(
            state.palette.rect.right -
              e.clientX -
              state.palette.borderWidth * 2,
            maxWidth
          ),
          minSize
        );
        state.palette.root.style.left = `${
          Math.min(
            Math.max(
              e.clientX,
              state.palette.rect.right -
                maxWidth -
                state.palette.borderWidth * 2
            ),
            state.palette.rect.right - minSize
          )
        }px`;
      }
      if (editing.resizingEdge.includes("top")) {
        newHeight = Math.max(
          Math.min(
            state.palette.rect.bottom -
              e.clientY -
              state.palette.borderWidth * 2,
            maxHeight
          ),
          minSize
        );
        state.palette.root.style.top = `${
          Math.min(
            Math.max(
              e.clientY,
              state.palette.rect.bottom -
                maxHeight -
                state.palette.borderWidth * 2
            ),
            state.palette.rect.bottom - minSize
          )
        }px`;
      }
      resizePaletteWindow(newWidth, newHeight);
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
      (mouseX + editing.paletteScrollX * 2 * paletteTileSize) / paletteTileSize
    );
    const tileY = Math.floor(
      (mouseY + editing.paletteScrollY * 2 * paletteTileSize) / paletteTileSize
    );
    const tileIndex = tileY * tilesPerRow + tileX;
    state.palette.header.innerHTML = `
      ${state.loadedImages["tileset"].name}.${state.loadedImages["tileset"].extension} 
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <path d="M7 9.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      | Ctrl + drag to scroll${
        tileIndex < 0 ? "" : " | Tile #" + tileIndex + " (" + tileX + ", " + tileY + ")"
      }
    `;

    if (editing.isSelecting && editing.selectionStart) {
      editing.selectionEnd = { x: tileX, y: tileY };
    }

    if (editing.isScrolling && editing.paletteScrollOrigin) {
      const dx = e.clientX - editing.paletteScrollOrigin.x;
      const dy = e.clientY - editing.paletteScrollOrigin.y;
      editing.paletteScrollOrigin.x = e.clientX;
      editing.paletteScrollOrigin.y = e.clientY;
      const scaledTilesetWidth =
        state.loadedImages["tileset"].image.width *
        state.constants.PALETTE_TILE_SIZE_SCALE;
      const scaledTilesetHeight =
        state.loadedImages["tileset"].image.height *
        state.constants.PALETTE_TILE_SIZE_SCALE;
      const maxScrollX =
        (scaledTilesetWidth - state.palette.canvas.clientWidth) /
        paletteTileSize /
        2;
      const maxScrollY =
        (scaledTilesetHeight - state.palette.canvas.clientHeight) /
        paletteTileSize /
        2;
      editing.paletteScrollX = Math.max(
        0,
        Math.min(
          editing.paletteScrollX -
            dx * state.constants.PALETTE_SCROLL_SPEED * 0.0001,
          maxScrollX
        )
      );
      editing.paletteScrollY = Math.max(
        0,
        Math.min(
          editing.paletteScrollY -
            dy * state.constants.PALETTE_SCROLL_SPEED * 0.0001,
          maxScrollY
        )
      );
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
          (mouseX + editing.paletteScrollX * 2 * paletteTileSize) /
            paletteTileSize
        );
        const tileY = Math.floor(
          (mouseY + editing.paletteScrollY * 2 * paletteTileSize) /
            paletteTileSize
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
    if (!["e", "b", "m", "d", "Escape"].includes(e.key)) return;
    editing.isErasing = false;
    switch (e.key) {
      case "e":
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
        break;
      case "b":
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
        break;
      case "m":
        if (!editing.isMoveSelecting) {
          editing.isMoveSelecting = true;
          if (!editing.moveSelectionStart) {
            const tileX = Math.floor(state.pointer.x / tiles.size);
            const tileY = Math.floor(state.pointer.y / tiles.size);
            editing.moveSelectionEnd = { x: tileX, y: tileY };
          }
        }
        break;
      case "Escape":
      case "d":
        if (editing.isMoving) {
          const startX = editing.moveSelectedTiles.startX;
          const startY = editing.moveSelectedTiles.startY;
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
                state.tiles.map[mapIndex] = editing.moveTilesData[dataIndex];
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
        break;
    }
    state.palette.header.innerHTML = `
      ${state.loadedImages["tileset"].name}.${state.loadedImages["tileset"].extension} 
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <path d="M7 9.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      | Selected tile #${editing.selectedTileIndex}
    `;
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Control" && editing.isScrolling) {
      editing.isScrolling = false;
    }
  });
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

