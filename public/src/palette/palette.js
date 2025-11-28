import state from "../state.js";
import { saveMap } from "../map/storage.js";
import { saveStateToUndo } from "../map/history.js";
import { placeTileAt } from "../tiles/autotile.js";
import { getActiveLayerTiles } from "../tiles/layers.js";

export function movePaletteWindow(x, y) {
  state.palette.root.style.left = `${x}px`;
  state.palette.root.style.top = `${y}px`;
}

export function resizePaletteWindow(width = null, height = null) {
  if (width) {
    state.palette.root.style.width = `${width}px`;
    state.palette.canvas.width = state.palette.root.clientWidth;
  }
  if (height) {
    state.palette.root.style.height = `${height}px`;
    state.palette.canvas.height =
      state.palette.root.clientHeight - state.palette.header.clientHeight;
  }
  clampPaletteScroll();
}

export function displayPalette() {
  if (!state.loadedImages["tileset"] || !state.palette.context) return;
  const { loadedImages } = state;
  const { PALETTE_TILE_SIZE_SCALE } = state.constants;
  const { context, canvas } = state.palette;
  const paletteTileSize =
    loadedImages["tileset"].size * PALETTE_TILE_SIZE_SCALE;
  const scaledTilesetWidth =
    loadedImages["tileset"].image.width * PALETTE_TILE_SIZE_SCALE;
  const scaledTilesetHeight =
    loadedImages["tileset"].image.height * PALETTE_TILE_SIZE_SCALE;
  const viewportWidth = canvas.width;
  const viewportHeight = canvas.height;
  const scrollX = state.editing.paletteScrollX;
  const scrollY = state.editing.paletteScrollY;

  const offsetX =
    ((scrollX % paletteTileSize) + paletteTileSize) % paletteTileSize;
  const offsetY =
    ((scrollY % paletteTileSize) + paletteTileSize) % paletteTileSize;

  for (
    let y = -offsetY;
    y < viewportHeight + paletteTileSize;
    y += paletteTileSize
  ) {
    for (
      let x = -offsetX;
      x < viewportWidth + paletteTileSize;
      x += paletteTileSize
    ) {
      const tileColumn = Math.floor((x + scrollX) / paletteTileSize);
      const tileRow = Math.floor((y + scrollY) / paletteTileSize);
      context.fillStyle =
        (tileColumn + tileRow) % 2 === 0 ? "#818181" : "#c1c0c1";

      context.fillRect(x, y, paletteTileSize, paletteTileSize);
    }
  }

  context.drawImage(
    loadedImages["tileset"].image,
    0,
    0,
    loadedImages["tileset"].image.width,
    loadedImages["tileset"].image.height,
    -scrollX,
    -scrollY,
    scaledTilesetWidth,
    scaledTilesetHeight,
  );
}

export function displayMoveSelection() {
  if (!state.loadedImages["tileset"]) return;
  const { loadedImages, tiles } = state;
  const editing = state.editing;
  if (!editing.isMoveSelecting && !editing.isMoving) return;

  const tilesPerRow =
    loadedImages["tileset"].image.width / loadedImages["tileset"].size;

  if (
    editing.isMoveSelecting &&
    editing.moveSelectionEnd &&
    !editing.isMoving
  ) {
    const startX = editing.moveSelectionStart
      ? Math.min(editing.moveSelectionStart.x, editing.moveSelectionEnd.x)
      : editing.moveSelectionEnd.x;
    const startY = editing.moveSelectionStart
      ? Math.min(editing.moveSelectionStart.y, editing.moveSelectionEnd.y)
      : editing.moveSelectionEnd.y;
    const endX = editing.moveSelectionStart
      ? Math.max(editing.moveSelectionStart.x, editing.moveSelectionEnd.x)
      : editing.moveSelectionEnd.x;
    const endY = editing.moveSelectionStart
      ? Math.max(editing.moveSelectionStart.y, editing.moveSelectionEnd.y)
      : editing.moveSelectionEnd.y;

    state.ctx.save();
    state.ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
    state.ctx.fillRect(
      startX * tiles.size,
      startY * tiles.size,
      (endX - startX + 1) * tiles.size,
      (endY - startY + 1) * tiles.size,
    );
    state.ctx.strokeStyle = "yellow";
    state.ctx.lineWidth = 2;
    state.ctx.setLineDash([6, 4]);
    state.ctx.lineDashOffset = editing.tileDashOffset;
    state.ctx.strokeRect(
      startX * tiles.size,
      startY * tiles.size,
      (endX - startX + 1) * tiles.size,
      (endY - startY + 1) * tiles.size,
    );
    state.ctx.restore();
  }

  if (editing.isMoving && editing.moveSelectedTiles.width) {
    const offsetX = Math.floor(editing.moveSelectedTiles.width / 2);
    const offsetY = Math.floor(editing.moveSelectedTiles.height / 2);
    const previewX = Math.floor(state.pointer.x / tiles.size) - offsetX;
    const previewY = Math.floor(state.pointer.y / tiles.size) - offsetY;

    let dataIndex = 0;
    for (let h = 0; h < editing.moveSelectedTiles.height; h++) {
      for (let w = 0; w < editing.moveSelectedTiles.width; w++) {
        const tileIdx = editing.moveTilesData[dataIndex];
        if (tileIdx !== editing.eraserBrush) {
          state.ctx.drawImage(
            loadedImages["tileset"].image,
            (tileIdx % tilesPerRow) * loadedImages["tileset"].size,
            Math.floor(tileIdx / tilesPerRow) * loadedImages["tileset"].size,
            loadedImages["tileset"].size,
            loadedImages["tileset"].size,
            (previewX + w) * tiles.size,
            (previewY + h) * tiles.size,
            tiles.size,
            tiles.size,
          );
        }
        dataIndex++;
      }
    }

    state.ctx.save();
    state.ctx.strokeStyle = "yellow";
    state.ctx.lineWidth = 2;
    state.ctx.setLineDash([6, 4]);
    state.ctx.lineDashOffset = editing.tileDashOffset;
    state.ctx.strokeRect(
      previewX * tiles.size,
      previewY * tiles.size,
      editing.moveSelectedTiles.width * tiles.size,
      editing.moveSelectedTiles.height * tiles.size,
    );
    state.ctx.restore();
  }
}

export function displayTileSelections() {
  if (!state.loadedImages["tileset"] || !state.palette.header) return;
  const { loadedImages, tiles } = state;
  const editing = state.editing;
  const activeLayerTiles = getActiveLayerTiles();
  if (editing.isMoveSelecting || editing.isMoving) return;

  const paletteTileSize =
    loadedImages["tileset"].size * state.constants.PALETTE_TILE_SIZE_SCALE;
  const scrollOffsetX = editing.paletteScrollX;
  const scrollOffsetY = editing.paletteScrollY;
  let hoveredTileIndex = state.palette.header.innerHTML.split("Tile #")[1];
  const tilesPerRow =
    loadedImages["tileset"].image.width / loadedImages["tileset"].size;
  editing.tileDashOffset -= 0.3;

  if (editing.isSelecting && editing.selectionStart && editing.selectionEnd) {
    const startX = Math.min(editing.selectionStart.x, editing.selectionEnd.x);
    const startY = Math.min(editing.selectionStart.y, editing.selectionEnd.y);
    const endX = Math.max(editing.selectionStart.x, editing.selectionEnd.x);
    const endY = Math.max(editing.selectionStart.y, editing.selectionEnd.y);
    const rectX = startX * paletteTileSize - scrollOffsetX;
    const rectY = startY * paletteTileSize - scrollOffsetY;
    const rectWidth = (endX - startX + 1) * paletteTileSize;
    const rectHeight = (endY - startY + 1) * paletteTileSize;

    state.palette.context.save();
    state.palette.context.fillStyle = "rgba(255, 255, 255, 0.2)";
    state.palette.context.fillRect(rectX, rectY, rectWidth, rectHeight);
    state.palette.context.strokeStyle = "white";
    state.palette.context.lineWidth = 2;
    state.palette.context.setLineDash([6, 4]);
    state.palette.context.lineDashOffset = editing.tileDashOffset;
    state.palette.context.strokeRect(rectX, rectY, rectWidth, rectHeight);
    state.palette.context.restore();
  }

  if (hoveredTileIndex && !editing.isResizing && !editing.isSelecting) {
    hoveredTileIndex = hoveredTileIndex.split(" ")[0];
    const hoverX =
      (hoveredTileIndex % tilesPerRow) * paletteTileSize - scrollOffsetX;
    const hoverY =
      Math.floor(hoveredTileIndex / tilesPerRow) * paletteTileSize -
      scrollOffsetY;
    state.palette.context.save();
    state.palette.context.strokeStyle = "white";
    state.palette.context.lineWidth = 1;
    state.palette.context.setLineDash([6, 4]);
    state.palette.context.lineDashOffset = editing.tileDashOffset;
    state.palette.context.strokeRect(
      hoverX,
      hoverY,
      paletteTileSize,
      paletteTileSize,
    );
    state.palette.context.restore();
  }

  if (!editing.isSelecting) {
    if (editing.selectedTileIndex === -1) {
      editing.selectedTiles.startX = 0;
      editing.selectedTiles.startY = 0;
    }

    if (editing.selectedTileIndex >= 0) {
      const selectX =
        editing.selectedTiles.startX * paletteTileSize - scrollOffsetX;
      const selectY =
        editing.selectedTiles.startY * paletteTileSize - scrollOffsetY;
      const selectWidth = editing.selectedTiles.width * paletteTileSize;
      const selectHeight = editing.selectedTiles.height * paletteTileSize;

      state.palette.context.save();
      state.palette.context.strokeStyle = "white";
      state.palette.context.lineWidth = 2;
      state.palette.context.setLineDash([6, 4]);
      state.palette.context.lineDashOffset = editing.tileDashOffset;
      state.palette.context.strokeRect(
        selectX,
        selectY,
        selectWidth,
        selectHeight,
      );
      state.palette.context.restore();
    }

    const isOutsidePalette =
      !editing.isResizing &&
      state.palette.header.innerHTML.split("Selected tile #")[1];
    if (isOutsidePalette) {
      const { baseWidth, baseHeight, brushWidth, brushHeight } =
        getBrushDimensions(editing);
      const offsetX = Math.floor(brushWidth / 2);
      const offsetY = Math.floor(brushHeight / 2);
      if (editing.selectedTileIndex >= 0) {
        for (let h = 0; h < brushHeight; h++) {
          for (let w = 0; w < brushWidth; w++) {
            const tileX = editing.selectedTiles.startX + (w % baseWidth);
            const tileY = editing.selectedTiles.startY + (h % baseHeight);
            const tileIdx = tileY * tilesPerRow + tileX;

            state.ctx.drawImage(
              loadedImages["tileset"].image,
              (tileIdx % tilesPerRow) * loadedImages["tileset"].size,
              Math.floor(tileIdx / tilesPerRow) * loadedImages["tileset"].size,
              loadedImages["tileset"].size,
              loadedImages["tileset"].size,
              (Math.floor(state.pointer.x / tiles.size) - offsetX + w) *
                tiles.size,
              (Math.floor(state.pointer.y / tiles.size) - offsetY + h) *
                tiles.size,
              tiles.size,
              tiles.size,
            );
          }
        }
      }

      state.ctx.save();
      state.ctx.strokeStyle = "white";
      state.ctx.lineWidth = 2;
      state.ctx.setLineDash([6, 4]);
      state.ctx.lineDashOffset = editing.tileDashOffset;
      state.ctx.strokeRect(
        (Math.floor(state.pointer.x / tiles.size) - offsetX) * tiles.size,
        (Math.floor(state.pointer.y / tiles.size) - offsetY) * tiles.size,
        tiles.size * brushWidth,
        tiles.size * brushHeight,
      );
      state.ctx.restore();

      const startTileX = Math.floor(state.pointer.x / tiles.size) - offsetX;
      const startTileY = Math.floor(state.pointer.y / tiles.size) - offsetY;

      let hasChanges = false;

      const importContainer = state.dom.importBtn
        ? state.dom.importBtn.parentElement
        : null;

      if (editing.isReplacing) {
        if (importContainer) importContainer.style.display = "none";
        for (let h = 0; h < brushHeight; h++) {
          for (let w = 0; w < brushWidth; w++) {
            const tileX = startTileX + w;
            const tileY = startTileY + h;
            const replacingIndex = tileY * state.mapMaxColumn + tileX;

            if (
              tileX >= 0 &&
              tileX < state.mapMaxColumn &&
              tileY >= 0 &&
              tileY < state.mapMaxRow &&
              editing.replaceState.state === 1
            ) {
              const patternX = editing.selectedTiles.startX + (w % baseWidth);
              const patternY = editing.selectedTiles.startY + (h % baseHeight);
              const sourceTileIdx =
                editing.selectedTileIndex >= 0
                  ? patternY * tilesPerRow + patternX
                  : editing.eraserBrush;
              if (activeLayerTiles[replacingIndex] !== sourceTileIdx) {
                if (!hasChanges) {
                  hasChanges = true;
                  saveStateToUndo();
                }
                if (
                  editing.isErasing ||
                  !state.tiles.empty.includes(sourceTileIdx)
                ) {
                  placeTileAt(replacingIndex, sourceTileIdx);
                }
                saveMap();
              }
            }

            if (editing.replaceState.state === 1) {
              editing.replaceState.state = 2;
            }
            if (editing.replaceState.tileIndex !== replacingIndex) {
              if (editing.replaceState.tileIndex !== "") {
                editing.replaceState.state = 1;
              }
              editing.replaceState.tileIndex = replacingIndex;
            }
          }
        }
      } else if (importContainer) {
        importContainer.style.display = "block";
      }
    }
  }
}

function getBrushDimensions(editing) {
  const baseWidth = Math.max(editing.selectedTiles.width || 1, 1);
  const baseHeight = Math.max(editing.selectedTiles.height || 1, 1);
  const brushSize = Math.max(editing.brushSize || 1, 1);
  return {
    baseWidth,
    baseHeight,
    brushWidth: baseWidth * brushSize,
    brushHeight: baseHeight * brushSize,
  };
}

export function panPaletteTileset(deltaX = 0, deltaY = 0) {
  if (!state.loadedImages["tileset"]) return;
  const dragFactor =
    state.constants.PALETTE_SCROLL_SPEED > 0
      ? state.constants.PALETTE_SCROLL_SPEED / 200
      : 1;
  state.editing.paletteScrollX -= deltaX * dragFactor;
  state.editing.paletteScrollY -= deltaY * dragFactor;
  clampPaletteScroll();
}

export function snapPaletteScrollToEdge(edge = "") {
  const normalizedEdge = edge || "";
  const options = {};
  if (normalizedEdge.includes("left")) options.horizontalSnap = "left";
  else if (normalizedEdge.includes("right")) options.horizontalSnap = "right";
  if (normalizedEdge.includes("top")) options.verticalSnap = "top";
  else if (normalizedEdge.includes("bottom")) options.verticalSnap = "bottom";
  clampPaletteScroll(options);
}

function clampPaletteScroll({
  horizontalSnap = null,
  verticalSnap = null,
} = {}) {
  const { maxScrollX, maxScrollY } = getPaletteScrollBoundsPx();
  const editing = state.editing;

  if (horizontalSnap === "left") editing.paletteScrollX = 0;
  else if (horizontalSnap === "right") editing.paletteScrollX = maxScrollX;
  else editing.paletteScrollX = clamp(editing.paletteScrollX, 0, maxScrollX);

  if (verticalSnap === "top") editing.paletteScrollY = 0;
  else if (verticalSnap === "bottom") editing.paletteScrollY = maxScrollY;
  else editing.paletteScrollY = clamp(editing.paletteScrollY, 0, maxScrollY);
}

function getPaletteScrollBoundsPx() {
  const tileset = state.loadedImages["tileset"];
  if (!tileset || !state.palette.canvas) {
    return { maxScrollX: 0, maxScrollY: 0 };
  }
  const scaledTilesetWidth =
    tileset.image.width * state.constants.PALETTE_TILE_SIZE_SCALE;
  const scaledTilesetHeight =
    tileset.image.height * state.constants.PALETTE_TILE_SIZE_SCALE;
  const viewportWidth = state.palette.canvas.width;
  const viewportHeight = state.palette.canvas.height;
  return {
    maxScrollX: Math.max(0, scaledTilesetWidth - viewportWidth),
    maxScrollY: Math.max(0, scaledTilesetHeight - viewportHeight),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
