import state from "../state.js";
import { getLayerStatusText } from "../tiles/layers.js";
import { drawPlayer } from "../gameplay/player.js";

export function displayLoading() {
  if (state.ctx.fillStyle !== "black") state.ctx.fillStyle = "black";
  if (state.ctx.font !== "bold 20px monospace")
    state.ctx.font = "bold 20px monospace";
  state.ctx.fillText(state.loadingMessage, 15, state.canvas.height - 20);
}

export function displayGame() {
  displayBackground();
  displayGameMap();
  drawPlayer();
}

export function displayInfo() {
  if (state.ctx.fillStyle !== "black") state.ctx.fillStyle = "black";
  state.ctx.font = "bold 20px monospace";
  state.ctx.fillText(`FPS: ${state.fps}`, 15, 30);
  state.ctx.font = "16px monospace";
  state.ctx.fillText(`[B]rush`, 15, 60);
  state.ctx.fillText(`[E]raser`, 15, 90);
  state.ctx.fillText(`'[' or ']' Adjust brush size`, 15, 120);
  state.ctx.fillText(
    `Brush size: ${state.editing.brushSize}/${state.constants.BRUSH_MAX_SIZE}`,
    15,
    150
  );
  state.ctx.fillText(`[A]utotiling enabled: ${state.editing.isAutotilingEnabled ? "Yes" : "No"}`, 15, 180);

  state.ctx.fillText(`[M]ove`, 15, 240);
  state.ctx.fillText(`[D]eselect`, 15, 270);
  state.ctx.fillText(`[Ctrl + Z] Undo`, 15, 300);
  state.ctx.fillText(`[Ctrl + Shift + Z] Redo`, 15, 330);

  state.ctx.fillText(getLayerStatusText(), 15, 390);
  state.ctx.fillText(`[,] Prev layer`, 15, 420);
  state.ctx.fillText(`[.] Next layer`, 15, 450);
  state.ctx.fillText(`[/] Toggle layer opacity`, 15, 480);
  
  state.ctx.fillText(`Palette:`, 15, 540);
  state.ctx.fillText(`Movable window`, 15, 570);
  state.ctx.fillText(`Resizable window`, 15, 600);
  state.ctx.fillText(`Ctrl + drag to scroll inside window`, 15, 630);
}

export function displayBackground() {
  if (state.loadedImages["tileset"].bg.type === "color") {
    state.ctx.fillStyle = state.loadedImages["tileset"].bg.tile[0].hex;
    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    return;
  }
  if (state.loadedImages["tileset"].bg.type === "source") {
    if (!state.loadedImages["tileset"].bg.image) return;
    for (const tile of state.tiles.bg) {
      state.ctx.drawImage(
        state.loadedImages["tileset"].bg.image,
        state.loadedImages["tileset"].bg.tile[0].x *
          state.loadedImages["tileset"].bg.size,
        state.loadedImages["tileset"].bg.tile[0].y *
          state.loadedImages["tileset"].bg.size,
        state.loadedImages["tileset"].bg.size,
        state.loadedImages["tileset"].bg.size,
        tile.desX,
        tile.desY,
        state.tiles.size,
        state.tiles.size
      );
    }
    return;
  }
  for (const tile of state.tiles.bg) {
    state.ctx.drawImage(
      state.loadedImages["tileset"].image,
      tile.srcX,
      tile.srcY,
      state.loadedImages["tileset"].size,
      state.loadedImages["tileset"].size,
      tile.desX,
      tile.desY,
      state.tiles.size,
      state.tiles.size
    );
  }
}

export function displayGameMap() {
  if (!state.tiles.layers.length) return;
  const tilesPerRow =
    state.loadedImages["tileset"].image.width /
    state.loadedImages["tileset"].size;
  for (const layer of state.tiles.layers) {
    if (layer.visible === false) continue;
    const previousAlpha = state.ctx.globalAlpha;
    const layerIndex = +layer.name.toLowerCase().split("layer ")[1] - 1 || 0;
    if (state.editing.isOpacityEnabled)
      state.ctx.globalAlpha =
        layerIndex === state.editing.activeLayerIndex ? 1 : 0.35;
    const layerTiles = layer.tiles;
    for (let i = 0; i < layerTiles.length; i++) {
      const tileIndex = layerTiles[i];
      if (tileIndex === state.editing.eraserBrush) continue;
      state.ctx.drawImage(
        state.loadedImages["tileset"].image,
        (tileIndex % tilesPerRow) * state.loadedImages["tileset"].size,
        Math.floor(tileIndex / tilesPerRow) *
          state.loadedImages["tileset"].size,
        state.loadedImages["tileset"].size,
        state.loadedImages["tileset"].size,
        (i % state.mapMaxColumn) * state.tiles.size,
        Math.floor(i / state.mapMaxColumn) * state.tiles.size,
        state.tiles.size,
        state.tiles.size
      );
    }
    state.ctx.globalAlpha = previousAlpha;
  }
}
