import state from "../state.js";

const touchedTiles = new Set();
let currentLevelIndex = -1;
let currentLevelData = null;

function getTileKey(col, row) {
  return `${col},${row}`;
}

function getPlayerTilePosition(tileSize) {
  const player = state.player;
  const collisionOffsetX = getCollisionOffsetX();
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  
  const playerCenterX = player.position.x + collisionOffsetX + player.collisionWidth / 2;
  const playerCenterY = player.position.y + collisionOffsetY + player.collisionHeight / 2;
  
  const col = Math.floor(playerCenterX / tileSize);
  const row = Math.floor(playerCenterY / tileSize);
  
  return { col, row };
}

function getCollisionOffsetX() {
  const player = state.player;
  const facingRight = player.facing >= 0;
  return facingRight
    ? Math.max(0, player.width - player.collisionWidth - 5)
    : 5;
}

let loadingLevelData = false;

async function loadLevelData(levelIndex) {
  if (levelIndex < 1) {
    currentLevelData = null;
    return;
  }

  loadingLevelData = true;
  try {
    const levelModule = await import(`./level_${levelIndex}.js`);
    currentLevelData = levelModule.default || levelModule;
  } catch (error) {
    console.warn(`Level ${levelIndex} data not found:`, error);
    currentLevelData = null;
  } finally {
    loadingLevelData = false;
  }
}

export function getPlayerTilePositionPublic(tileSize) {
  return getPlayerTilePosition(tileSize);
}

export function checkTileInteractions() {
  if (!state.gameplay.isPlaying || !state.canvas) return;
  if (!state.gameplay.playMode.isActive) return;

  const playMode = state.gameplay.playMode;
  const levelIndex = playMode.currentLevelIndex;
  
  if (levelIndex < 0) return;

  const currentLevel = playMode.levels[levelIndex];
  if (!currentLevel || !currentLevel.level) return;

  const levelNumber = currentLevel.level;

  if (currentLevelIndex !== levelNumber) {
    currentLevelIndex = levelNumber;
    touchedTiles.clear();
    loadLevelData(levelNumber);
    return;
  }

  if (loadingLevelData || !currentLevelData) return;

  const tileSize = state.tiles.size || 1;
  const playerTilePos = getPlayerTilePosition(tileSize);

  const tilesToCheck = currentLevelData.tiles || [];
  
  if (typeof currentLevelData.getAllTiles === "function") {
    const allTiles = currentLevelData.getAllTiles();
    for (const tile of allTiles) {
      if (!tilesToCheck.find(t => t.col === tile.col && t.row === tile.row)) {
        tilesToCheck.push(tile);
      }
    }
  }

  for (const tileData of tilesToCheck) {
    if (tileData.col === undefined || tileData.row === undefined) continue;
    if (tileData.col !== playerTilePos.col || tileData.row !== playerTilePos.row) continue;

    const tileKey = getTileKey(tileData.col, tileData.row);
    if (touchedTiles.has(tileKey)) continue;

    touchedTiles.add(tileKey);

    if (typeof tileData.onTouch === "function") {
      tileData.onTouch(tileData);
    } else if (typeof currentLevelData.onTileTouch === "function") {
      currentLevelData.onTileTouch(tileData);
    }
  }
}

export function resetLevelState() {
  touchedTiles.clear();
  currentLevelIndex = -1;
  currentLevelData = null;
  loadingLevelData = false;
}

export function getCurrentLevelData() {
  return currentLevelData;
}

