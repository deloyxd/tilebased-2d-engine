import state from "../state.js";

const DEFAULT_BG_CONFIG = { type: "normal" };

function getCoverageDimensions(tileSize) {
  const canvasColumns = Math.ceil((state.canvas?.width || 0) / tileSize);
  const canvasRows = Math.ceil((state.canvas?.height || 0) / tileSize);
  const mapColumns = state.mapMaxColumn || 0;
  const mapRows = state.mapMaxRow || 0;
  return {
    columns: Math.max(canvasColumns, mapColumns),
    rows: Math.max(canvasRows, mapRows)
  };
}

export function updateBackgroundTiles() {
  const tileset = state.loadedImages["tileset"];
  if (!tileset || !state.canvas) return;

  const tileSize = state.tiles.size || 1;
  const bgConfig = tileset.bg || DEFAULT_BG_CONFIG;
  const { columns, rows } = getCoverageDimensions(tileSize);

  state.tiles.bg = [];

  if (!columns || !rows) {
    return;
  }

  if (bgConfig.type === "group" && bgConfig.tile?.length) {
    const group = bgConfig.tile[0];
    const groupWidth = group.w || 1;
    const groupHeight = group.h || 1;
    for (let y = 0; y < rows; y += groupHeight) {
      for (let x = 0; x < columns; x += groupWidth) {
        for (let h = 0; h < groupHeight; h++) {
          for (let w = 0; w < groupWidth; w++) {
            const tileX = x + w;
            const tileY = y + h;
            if (tileX >= columns || tileY >= rows) continue;
            const srcX = (group.x + w) * tileset.size;
            const srcY = (group.y + h) * tileset.size;
            state.tiles.bg.push({
              srcX,
              srcY,
              desX: tileX * tileSize,
              desY: tileY * tileSize
            });
          }
        }
      }
    }
    return;
  }

  if (bgConfig.type === "source") {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        state.tiles.bg.push({
          desX: x * tileSize,
          desY: y * tileSize
        });
      }
    }
    if (!bgConfig.image) {
      const bgImage = new Image();
      bgImage.src = `./images/${bgConfig.name}.${bgConfig.extension}`;
      bgImage.onload = () => {
        state.loadedImages["tileset"].bg.image = bgImage;
      };
    }
    return;
  }
}
