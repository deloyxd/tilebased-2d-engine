import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";
import { initializeLayersFromData } from "../tiles/layers.js";
import { updateBackgroundTiles } from "../tiles/background.js";

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

  const playerCenterX =
    player.position.x + collisionOffsetX + player.collisionWidth / 2;
  const playerCenterY =
    player.position.y + collisionOffsetY + player.collisionHeight / 2;

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

function recalculateDiamondTotalsFromMap() {
  const collectibles = state.gameplay?.collectibles;
  if (!collectibles) return;

  collectibles.diamondsCollected = 0;
  collectibles.diamondsTotal = 0;

  if (collectibles.collectedDiamondKeys?.clear) {
    collectibles.collectedDiamondKeys.clear();
  } else if (Array.isArray(collectibles.collectedDiamondKeys)) {
    collectibles.collectedDiamondKeys.length = 0;
  }

  collectibles.keysCollected = 0;
  collectibles.keysTotal = 0;

  if (collectibles.collectedKeyKeys?.clear) {
    collectibles.collectedKeyKeys.clear();
  } else if (Array.isArray(collectibles.collectedKeyKeys)) {
    collectibles.collectedKeyKeys.length = 0;
  }

  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow) {
    return;
  }

  let diamondsTotal = 0;

  for (let row = 0; row < state.mapMaxRow; row++) {
    for (let col = 0; col < state.mapMaxColumn; col++) {
      const index = row * state.mapMaxColumn + col;
      let tileIndex = null;

      for (const layer of state.tiles.layers) {
        const layerTile = layer.tiles[index];
        if (
          layerTile !== undefined &&
          layerTile !== state.editing.eraserBrush
        ) {
          tileIndex = layerTile;
          break;
        }
      }

      if (tileIndex !== null) {
        const label = getTileTypeLabel(tileIndex);
        if (label && label.toLowerCase().includes("diamond")) {
          diamondsTotal++;
        }
      }
    }
  }

  collectibles.diamondsTotal = diamondsTotal;
}

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
      if (!tilesToCheck.find((t) => t.col === tile.col && t.row === tile.row)) {
        tilesToCheck.push(tile);
      }
    }
  }

  for (const tileData of tilesToCheck) {
    if (tileData.col === undefined || tileData.row === undefined) continue;
    if (
      tileData.col !== playerTilePos.col ||
      tileData.row !== playerTilePos.row
    )
      continue;

    const tileKey = getTileKey(tileData.col, tileData.row);
    if (touchedTiles.has(tileKey)) continue;

    touchedTiles.add(tileKey);

    if (typeof tileData.onTouch === "function") {
      tileData.onTouch(tileData);
    } else if (typeof currentLevelData.onTileTouch === "function") {
      currentLevelData.onTileTouch(tileData);
    }
  }

  if (typeof currentLevelData.checkGoldenBoxBump === "function") {
    currentLevelData.checkGoldenBoxBump();
  }

  if (typeof currentLevelData.checkSpikeCollision === "function") {
    currentLevelData.checkSpikeCollision();
  }
}

export function resetLevelState() {
  if (
    currentLevelData &&
    typeof currentLevelData.resetGoldenBoxBumpState === "function"
  ) {
    currentLevelData.resetGoldenBoxBumpState();
  }

  if (
    currentLevelData &&
    typeof currentLevelData.resetFlagHeadCooldown === "function"
  ) {
    currentLevelData.resetFlagHeadCooldown();
  }

  if (
    currentLevelData &&
    typeof currentLevelData.resetSpikeGameOverState === "function"
  ) {
    currentLevelData.resetSpikeGameOverState();
  }

  touchedTiles.clear();
  currentLevelIndex = -1;
  const previousLevelData = currentLevelData;
  currentLevelData = null;
  loadingLevelData = false;

  if (state.gameplay.interaction) {
    state.gameplay.interaction.activeSign = null;
    state.gameplay.interaction.activeLever = null;
    state.gameplay.interaction.isTextModalOpen = false;
    state.gameplay.interaction.leverStates = {};
  }

  if (state.camera) {
    state.camera.targetX = null;
    state.camera.targetY = null;
    state.camera.panCallback = null;
    state.camera.panCallbackTime = null;
    state.camera.panHoldDuration = 0;
    state.camera.panEasingFactor = null;
    state.camera.isFollowingPlayer = true;
  }

  if (state.originalMapData) {
    const data = state.originalMapData;
    state.mapMaxColumn = data.mapMaxColumn;
    state.mapMaxRow = data.mapMaxRow;
    const legacyLayer = data.tiles
      ? [
          {
            id: "legacy-layer",
            name: "Layer 1",
            visible: true,
            tiles: data.tiles
          }
        ]
      : [];
    initializeLayersFromData(
      data.layers && data.layers.length ? data.layers : legacyLayer,
      data.activeLayerIndex ?? 0
    );
    updateBackgroundTiles();
  }

  if (
    previousLevelData &&
    typeof previousLevelData.resetLeverAndKeyState === "function"
  ) {
    previousLevelData.resetLeverAndKeyState();
  }

  recalculateDiamondTotalsFromMap();
}

export function getCurrentLevelData() {
  return currentLevelData;
}

export function removeTouchedTile(col, row) {
  const tileKey = getTileKey(col, row);
  touchedTiles.delete(tileKey);
}
