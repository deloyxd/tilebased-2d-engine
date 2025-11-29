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
  if (state.gameplay.isPlaying) {
    state.ctx.save();
    const zoom = state.camera.zoom;
    const canvas = state.canvas;

    state.ctx.translate(canvas.width / 2, canvas.height / 2);
    state.ctx.scale(zoom, zoom);
    state.ctx.translate(-canvas.width / 2 / zoom, -canvas.height / 2 / zoom);

    state.ctx.translate(-state.camera.x, -state.camera.y);
  }

  displayBackground();
  displayGameMap();
  drawPlayer();

  if (state.gameplay.isPlaying) {
    state.ctx.restore();
  }
}

export function displayInfo() {
  state.ctx.fillStyle = "white";
  state.ctx.strokeStyle = "black";
  state.ctx.lineWidth = 3;
  state.ctx.font = "bold 20px monospace";
  drawText(`FPS: ${state.fps}`, 15, 30);
  state.ctx.font = "16px monospace";

  if (state.editing.isEditing) {
    drawText(`[B]rush`, 15, 60);
    drawText(`[E]raser`, 15, 90);
    drawText(`'[' or ']' Adjust brush size`, 15, 120);
    drawText(
      `Brush size: ${state.editing.brushSize}/${state.constants.BRUSH_MAX_SIZE}`,
      15,
      150,
    );
    drawText(
      `[A]utotiling enabled: ${
        state.editing.isAutotilingEnabled ? "Yes" : "No"
      }`,
      15,
      180,
    );

    drawText(`[M]ove`, 15, 240);
    drawText(`[D]eselect`, 15, 270);
    drawText(`[Ctrl + Z] Undo`, 15, 300);
    drawText(`[Ctrl + Shift + Z] Redo`, 15, 330);

    drawText(getLayerStatusText(), 15, 390);
    drawText(`[,] Prev layer`, 15, 420);
    drawText(`[.] Next layer`, 15, 450);
    drawText(`[/] Toggle layer opacity`, 15, 480);

    drawText(`Palette:`, 15, 540);
    drawText(`Movable window`, 15, 570);
    drawText(`Resizable window`, 15, 600);
    drawText(`Ctrl + drag to scroll inside window`, 15, 630);
    return;
  }

  // if (state.gameplay.isPlaying) {
  //   drawText(`[W / Space / Up arrow] jump`, 15, 60);
  //   drawText(`[A / D / Left / Right arrow] move`, 15, 90);
  //   return;
  // }
}

function drawText(text, x, y) {
  state.ctx.strokeText(text, x, y);
  state.ctx.fillText(text, x, y);
}

export function displayBackground(canvas = null, ctx = null) {
  if (!canvas) canvas = state.canvas;
  if (!ctx) ctx = state.ctx;
  if (state.loadedImages["tileset"].bg.type === "color") {
    ctx.fillStyle = state.loadedImages["tileset"].bg.tile[0].hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (state.loadedImages["tileset"].bg.type === "source") {
    if (!state.loadedImages["tileset"].bg.image) return;
    for (const tile of state.tiles.bg) {
      ctx.drawImage(
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
        state.tiles.size,
      );
    }
    return;
  }
  for (const tile of state.tiles.bg) {
    ctx.drawImage(
      state.loadedImages["tileset"].image,
      tile.srcX,
      tile.srcY,
      state.loadedImages["tileset"].size,
      state.loadedImages["tileset"].size,
      tile.desX,
      tile.desY,
      state.tiles.size,
      state.tiles.size,
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
    if (state.editing.isEditing && state.editing.isOpacityEnabled)
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
        state.tiles.size,
      );
    }
    state.ctx.globalAlpha = previousAlpha;
  }
}
