import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";
import { placeTileAt } from "../tiles/autotile.js";
import { proceedToNextLevel, exitMap } from "../events/uiEvents.js";
import { removeTouchedTile } from "./levels.js";
import { showGameTextModal } from "../events/playerControls.js";

const SIGN_TEXT = {
  17: {
    19: `Welcome to <fun>Island Venture</fun>! It seems you already know how to move around and interact with objects! Your goal? Simple. You just have to escape this island <bloody>ALIVE</bloody>. Good luck!`
  }
};

// Lever configuration: col -> row -> { type: "activate-only" | "toggle", onActivate: function, onDeactivate: function }
const LEVER_CONFIG = {
  37: {
    15: {
      type: "activate-only",
      onActivate: (tileData) => {
        handleLeverActivation(tileData);
      }
    }
  }
};

const LEVER_EFFECTS = {
  keySpawnPosition: { col: 38, row: 9 },
  tilesToRemove: [
    { col: 31, row: 19 },
    { col: 31, row: 20 },
    { col: 31, row: 21 }
  ],
  cameraPanDuration: 500,
  keyTileIndex: 18
};

const KEY_CONFIG = {
  keyPosition: { col: 38, row: 9 },
  tileSpawnPosition: { col: 40, row: 9 },
  groundTileIndex: 0
};

const GOLDEN_BOX_LOCKED_CONFIG = {
  position: { col: 29, row: 19 },
  onBump: (tileData) => {
    handleGoldBoxLockedActivation(tileData);
  }
};

const GOLDEN_BOX_LOCKED_EFFECTS = {
  tilesToRemove: [
    { col: 39, row: 17 },
    { col: 39, row: 18 },
    { col: 39, row: 19 }
  ],
  cameraPanDuration: 500
};

const FLAG_HEAD_CONFIG = {
  position: { col: 37, row: 18 },
  cooldownDuration: 5000
};

let flagHeadLastTriggerTime = 0;
let spikeGameOverTriggered = false;
let gameOverTimeoutId = null;

function getWorldPosition(col, row) {
  const tileSize = state.tiles.size || 36;
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2
  };
}

function panCameraTo(col, row, callback) {
  const worldPos = getWorldPosition(col, row);
  state.camera.isFollowingPlayer = false;
  state.camera.targetX = worldPos.x;
  state.camera.targetY = worldPos.y;
  state.camera.panCallback = callback;
  state.camera.panCallbackTime = null;
  state.camera.panHoldDuration = LEVER_EFFECTS.cameraPanDuration;
  state.camera.panEasingFactor = 25;
}

function spawnObject(col, row, spawnTileIndex = 0) {
  const mapIndex = row * state.mapMaxColumn + col;
  if (mapIndex < 0 || mapIndex >= state.mapMaxColumn * state.mapMaxRow) {
    console.warn("Invalid position for object spawn:", col, row);
    return;
  }

  let targetLayer = null;
  for (const layer of state.tiles.layers) {
    if (layer.visible) {
      const tileAtPos = layer.tiles[mapIndex];
      if (tileAtPos === undefined || state.tiles.empty.includes(tileAtPos)) {
        targetLayer = layer;
        break;
      }
    }
  }

  if (!targetLayer && state.tiles.layers.length > 0) {
    targetLayer =
      state.tiles.layers[state.editing.activeLayerIndex] ||
      state.tiles.layers[0];
  }

  if (targetLayer) {
    const originalActiveIndex = state.editing.activeLayerIndex;
    const targetLayerIndex = state.tiles.layers.indexOf(targetLayer);

    state.editing.activeLayerIndex = targetLayerIndex;
    placeTileAt(mapIndex, spawnTileIndex);

    state.editing.activeLayerIndex = originalActiveIndex;
  }
}

async function removeTiles(tilesToRemove, durationBetween = 0) {
  const emptyTileIndex = state.tiles.empty[0] || -1;

  for (const tile of tilesToRemove) {
    const mapIndex = tile.row * state.mapMaxColumn + tile.col;
    if (mapIndex < 0 || mapIndex >= state.mapMaxColumn * state.mapMaxRow) {
      continue;
    }

    for (const layer of state.tiles.layers) {
      if (!layer.visible) continue;
      const tileIndex = layer.tiles[mapIndex];
      if (tileIndex !== undefined && !state.tiles.empty.includes(tileIndex)) {
        const originalActiveIndex = state.editing.activeLayerIndex;
        const targetLayerIndex = state.tiles.layers.indexOf(layer);

        state.editing.activeLayerIndex = targetLayerIndex;
        placeTileAt(mapIndex, emptyTileIndex);

        state.editing.activeLayerIndex = originalActiveIndex;
        break;
      }
    }

    if (tilesToRemove.indexOf(tile) < tilesToRemove.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, durationBetween));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
}

function handleLeverActivation(tileData) {
  const firstTile = LEVER_EFFECTS.tilesToRemove[0];
  panCameraTo(firstTile.col, firstTile.row, async () => {
    await removeTiles(LEVER_EFFECTS.tilesToRemove, 500);

    panCameraTo(
      LEVER_EFFECTS.keySpawnPosition.col,
      LEVER_EFFECTS.keySpawnPosition.row,
      () => {
        spawnObject(
          LEVER_EFFECTS.keySpawnPosition.col,
          LEVER_EFFECTS.keySpawnPosition.row,
          LEVER_EFFECTS.keyTileIndex
        );

        panCameraTo(
          LEVER_EFFECTS.keySpawnPosition.col,
          LEVER_EFFECTS.keySpawnPosition.row,
          () => {
            state.camera.targetX = null;
            state.camera.targetY = null;
            state.camera.panEasingFactor = null;
            state.camera.isFollowingPlayer = true;
          }
        );
      }
    );
  });
}

function handleGoldBoxLockedActivation(tileData) {
  const firstTile = GOLDEN_BOX_LOCKED_EFFECTS.tilesToRemove[0];
  panCameraTo(firstTile.col, firstTile.row, async () => {
    await removeTiles(GOLDEN_BOX_LOCKED_EFFECTS.tilesToRemove, 500);

    state.camera.targetX = null;
    state.camera.targetY = null;
    state.camera.panEasingFactor = null;
    state.camera.isFollowingPlayer = true;
  });
}

function interactWithObject(type, tileData) {
  if (!state.gameplay.interaction) {
    state.gameplay.interaction = {
      activeSign: null,
      activeLever: null,
      isTextModalOpen: false,
      leverStates: {}
    };
  }

  if (!state.gameplay.interaction.leverStates) {
    state.gameplay.interaction.leverStates = {};
  }

  if (type === "sign") {
    const text = SIGN_TEXT[tileData.col]?.[tileData.row] || "...";

    state.gameplay.interaction.activeSign = {
      col: tileData.col,
      row: tileData.row,
      text
    };
  } else if (type === "lever") {
    const leverConfig = LEVER_CONFIG[tileData.col]?.[tileData.row];
    if (!leverConfig) return;

    const leverKey = `${tileData.col},${tileData.row}`;
    state.gameplay.interaction.activeLever = {
      col: tileData.col,
      row: tileData.row,
      type: leverConfig.type || "toggle",
      onActivate: leverConfig.onActivate,
      onDeactivate: leverConfig.onDeactivate,
      isActivated: state.gameplay.interaction.leverStates[leverKey] || false
    };
  }
}

function getAllTilesFromMap() {
  const allTiles = [];
  let diamondsTotal = 0;
  let keysTotal = 0;
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow) {
    state.gameplay.collectibles.diamondsTotal = 0;
    state.gameplay.collectibles.keysTotal = 0;
    return allTiles;
  }

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
        if (label && label.toLowerCase().includes("key")) {
          keysTotal++;
        }

        allTiles.push({
          col,
          row,
          tileIndex
        });
      }
    }
  }

  state.gameplay.collectibles.diamondsTotal = diamondsTotal;
  state.gameplay.collectibles.keysTotal = keysTotal;

  return allTiles;
}

function getDiamondKey(col, row) {
  return `${col},${row}`;
}

function collectDiamond(tileData) {
  if (!tileData || tileData.col === undefined || tileData.row === undefined) {
    return;
  }

  const collectibles = state.gameplay.collectibles;
  if (!collectibles || !collectibles.collectedDiamondKeys) return;

  const key = getDiamondKey(tileData.col, tileData.row);
  if (collectibles.collectedDiamondKeys.has(key)) return;

  collectibles.collectedDiamondKeys.add(key);
  collectibles.diamondsCollected += 1;
}

function getKeyKey(col, row) {
  return `${col},${row}`;
}

function collectKey(tileData) {
  if (!tileData || tileData.col === undefined || tileData.row === undefined) {
    return;
  }

  const collectibles = state.gameplay.collectibles;
  if (!collectibles) return;

  if (!collectibles.collectedKeyKeys) {
    collectibles.collectedKeyKeys = new Set();
  }
  if (collectibles.keysCollected === undefined) {
    collectibles.keysCollected = 0;
  }

  const key = getKeyKey(tileData.col, tileData.row);
  if (collectibles.collectedKeyKeys.has(key)) return;

  collectibles.collectedKeyKeys.add(key);
  collectibles.keysCollected += 1;

  state.editing.isAutotilingEnabled = true;
  spawnObject(
    KEY_CONFIG.tileSpawnPosition.col,
    KEY_CONFIG.tileSpawnPosition.row,
    KEY_CONFIG.groundTileIndex
  );
}

function getLeverKey(col, row) {
  return `${col},${row}`;
}

function activateLever(tileData) {
  if (!tileData || tileData.col === undefined || tileData.row === undefined) {
    return;
  }

  const interaction = state.gameplay.interaction;
  if (!interaction) return;

  if (!interaction.leverStates) {
    interaction.leverStates = {};
  }

  const key = getLeverKey(tileData.col, tileData.row);
  const leverConfig = LEVER_CONFIG[tileData.col]?.[tileData.row];
  if (!leverConfig) return;

  const isActivated = interaction.leverStates[key] || false;
  const leverType = leverConfig.type || "toggle";

  if (leverType === "activate-only") {
    if (isActivated) return;
    interaction.leverStates[key] = true;
    if (leverConfig.onActivate) {
      leverConfig.onActivate(tileData);
    }
    return;
  }

  if (leverType === "toggle") {
    const newState = !isActivated;
    interaction.leverStates[key] = newState;

    if (newState) {
      if (leverConfig.onActivate) {
        leverConfig.onActivate(tileData);
      }
    } else {
      if (leverConfig.onDeactivate) {
        leverConfig.onDeactivate(tileData);
      }
    }
    return;
  }
}

let goldenBoxBumpTriggered = false;

function resetGoldenBoxBumpState() {
  goldenBoxBumpTriggered = false;
}

function resetFlagHeadCooldown() {
  flagHeadLastTriggerTime = 0;
}

function resetSpikeGameOverState() {
  spikeGameOverTriggered = false;
  if (gameOverTimeoutId !== null) {
    clearTimeout(gameOverTimeoutId);
    gameOverTimeoutId = null;
  }
  if (state.gameplay) {
    state.gameplay.isGameOver = false;
  }
}

function removeSpawnedKey() {
  const keyPos = LEVER_EFFECTS.keySpawnPosition;
  const mapIndex = keyPos.row * state.mapMaxColumn + keyPos.col;

  if (mapIndex < 0 || mapIndex >= state.mapMaxColumn * state.mapMaxRow) {
    return;
  }

  const emptyTileIndex = state.tiles.empty[0] || -1;

  for (const layer of state.tiles.layers) {
    const tileIndex = layer.tiles[mapIndex];
    if (tileIndex !== undefined && !state.tiles.empty.includes(tileIndex)) {
      const label = getTileTypeLabel(tileIndex);
      if (label && label.toLowerCase().includes("key")) {
        const originalActiveIndex = state.editing.activeLayerIndex;
        const targetLayerIndex = state.tiles.layers.indexOf(layer);

        state.editing.activeLayerIndex = targetLayerIndex;
        placeTileAt(mapIndex, emptyTileIndex);

        state.editing.activeLayerIndex = originalActiveIndex;
        break;
      }
    }
  }
}

function resetLeverAndKeyState() {
  removeSpawnedKey();

  if (state.gameplay.interaction) {
    if (!state.gameplay.interaction.leverStates) {
      state.gameplay.interaction.leverStates = {};
    }
    const leverKey = `37,15`;
    delete state.gameplay.interaction.leverStates[leverKey];
  }
}

function handleFlagHeadTouch(tileData) {
  const collectibles = state.gameplay.collectibles;
  if (!collectibles) {
    return;
  }

  const diamondsCollected = collectibles.diamondsCollected || 0;
  const diamondsTotal = collectibles.diamondsTotal || 0;

  if (diamondsCollected < diamondsTotal) {
    const currentTime = Date.now();
    const timeSinceLastTrigger = currentTime - flagHeadLastTriggerTime;

    if (timeSinceLastTrigger < FLAG_HEAD_CONFIG.cooldownDuration) {
      removeTouchedTile(tileData.col, tileData.row);
      return;
    }

    flagHeadLastTriggerTime = currentTime;

    const remaining = diamondsTotal - diamondsCollected;
    const message = `You need to collect all <fun>diamonds</fun> to finish the level! ${remaining} diamond${
      remaining !== 1 ? "s" : ""
    } remaining. <bloody>- Jestley</bloody>`;

    showGameTextModal(message);
    removeTouchedTile(tileData.col, tileData.row);
    return;
  }

  if (diamondsTotal === 0) {
    proceedToNextLevel();
    return;
  }

  if (diamondsCollected === diamondsTotal) {
    proceedToNextLevel();
  }
}

function checkGoldenBoxBump() {
  if (!state.gameplay.isPlaying || !state.canvas) return;
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow)
    return;

  const player = state.player;
  const tileSize = state.tiles.size || 1;
  const config = GOLDEN_BOX_LOCKED_CONFIG;
  const targetCol = config.position.col;
  const targetRow = config.position.row;

  const isJumping = player.velocity.y < 0;

  if (!isJumping) {
    return;
  }

  if (goldenBoxBumpTriggered) return;

  const collisionOffsetX = getCollisionOffsetXForBump();
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  const padding = 6;

  const headCollisionX = player.position.x + collisionOffsetX + padding;
  const headCollisionY = player.position.y + collisionOffsetY;
  const headCollisionWidth = player.collisionWidth - padding * 2;
  const headCollisionHeight = player.collisionHeight;

  const targetBoxX = targetCol * tileSize;
  const targetBoxY = targetRow * tileSize;
  const targetBoxBottom = targetBoxY + tileSize;

  const horizontalOverlap =
    headCollisionX < targetBoxX + tileSize &&
    headCollisionX + headCollisionWidth > targetBoxX;

  if (!horizontalOverlap) return;

  const headTop = headCollisionY;
  const headBottom = headCollisionY + headCollisionHeight;

  const headTopTileRow = Math.floor(headTop / tileSize);

  const expectedHeadRow = targetRow + 1;

  const bumpThreshold = 5;
  const isHeadInRowBelow = headTopTileRow === expectedHeadRow;
  const isHeadAtBoxBottom =
    headTop >= targetBoxBottom - bumpThreshold &&
    headTop <= targetBoxBottom + bumpThreshold;

  const isHeadTouchingBoxBottom =
    (isHeadInRowBelow || isHeadAtBoxBottom) && headBottom > targetBoxY;

  if (!isHeadTouchingBoxBottom) return;

  const mapIndex = targetRow * state.mapMaxColumn + targetCol;
  if (mapIndex < 0 || mapIndex >= state.mapMaxColumn * state.mapMaxRow) return;

  for (const layer of state.tiles.layers) {
    if (!layer.visible) continue;
    const tileIndex = layer.tiles[mapIndex];
    if (tileIndex === undefined || tileIndex === state.editing.eraserBrush)
      continue;

    const label = getTileTypeLabel(tileIndex);
    if (
      label &&
      label.toLowerCase().includes("gold box") &&
      label.toLowerCase().includes("locked")
    ) {
      const collectibles = state.gameplay.collectibles;
      const hasKey =
        collectibles &&
        (collectibles.keysCollected > 0 ||
          (collectibles.collectedKeyKeys &&
            collectibles.collectedKeyKeys.size > 0));

      if (!hasKey) {
        return;
      }

      goldenBoxBumpTriggered = true;

      const tileData = {
        col: targetCol,
        row: targetRow,
        tileIndex: tileIndex
      };

      if (config.onBump && typeof config.onBump === "function") {
        config.onBump(tileData);
      }
      return;
    }
  }
}

function getCollisionOffsetXForBump() {
  const player = state.player;
  const facingRight = player.facing >= 0;
  const frontCollisionPadding = 8;
  return facingRight
    ? Math.max(0, player.width - player.collisionWidth - frontCollisionPadding)
    : frontCollisionPadding;
}

function getSpikeRootDirection(tileLabel) {
  if (!tileLabel) return null;
  const lower = tileLabel.toLowerCase();
  if (lower.includes("spike")) {
    if (lower.includes(": left")) return "left";
    if (lower.includes(": right")) return "right";
    if (lower.includes(": top")) return "top";
    if (lower.includes(": bottom")) return "bottom";
  }
  return null;
}

function checkSpikeCollision() {
  if (!state.gameplay.isPlaying || !state.canvas) return;
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow)
    return;
  if (spikeGameOverTriggered) return;

  const player = state.player;
  const tileSize = state.tiles.size || 36;
  const collisionOffsetX = getCollisionOffsetX();
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;

  const playerLeft = player.position.x + collisionOffsetX;
  const playerRight = playerLeft + player.collisionWidth;
  const playerTop = player.position.y + collisionOffsetY;
  const playerBottom = playerTop + player.collisionHeight;

  for (let row = 0; row < state.mapMaxRow; row++) {
    for (let col = 0; col < state.mapMaxColumn; col++) {
      const mapIndex = row * state.mapMaxColumn + col;
      if (mapIndex < 0 || mapIndex >= state.mapMaxColumn * state.mapMaxRow) {
        continue;
      }

      let tileIndex = null;
      for (const layer of state.tiles.layers) {
        if (!layer.visible) continue;
        const layerTile = layer.tiles[mapIndex];
        if (
          layerTile !== undefined &&
          layerTile !== state.editing.eraserBrush &&
          !state.tiles.empty.includes(layerTile)
        ) {
          tileIndex = layerTile;
          break;
        }
      }

      if (tileIndex === null) continue;

      const label = getTileTypeLabel(tileIndex);
      const rootDirection = getSpikeRootDirection(label);

      if (!rootDirection) continue;

      const tileX = col * tileSize;
      const tileY = row * tileSize;
      let spikeCollisionLeft,
        spikeCollisionRight,
        spikeCollisionTop,
        spikeCollisionBottom;

      if (rootDirection === "left") {
        const collisionWidth = tileSize / 3;
        spikeCollisionLeft = tileX;
        spikeCollisionRight = tileX + collisionWidth;
        spikeCollisionTop = tileY;
        spikeCollisionBottom = tileY + tileSize;
      } else if (rootDirection === "right") {
        const collisionWidth = tileSize / 3;
        spikeCollisionLeft = tileX + (tileSize - collisionWidth);
        spikeCollisionRight = tileX + tileSize;
        spikeCollisionTop = tileY;
        spikeCollisionBottom = tileY + tileSize;
      } else if (rootDirection === "top") {
        const collisionHeight = tileSize / 3;
        spikeCollisionLeft = tileX;
        spikeCollisionRight = tileX + tileSize;
        spikeCollisionTop = tileY;
        spikeCollisionBottom = tileY + collisionHeight;
      } else if (rootDirection === "bottom") {
        const collisionHeight = tileSize / 3;
        spikeCollisionLeft = tileX;
        spikeCollisionRight = tileX + tileSize;
        spikeCollisionTop = tileY + (tileSize - collisionHeight);
        spikeCollisionBottom = tileY + tileSize;
      }

      const horizontalOverlap =
        playerLeft < spikeCollisionRight && playerRight > spikeCollisionLeft;
      const verticalOverlap =
        playerTop < spikeCollisionBottom && playerBottom > spikeCollisionTop;

      if (horizontalOverlap && verticalOverlap) {
        spikeGameOverTriggered = true;
        state.gameplay.isGameOver = true;

        state.gameplay.input.left = false;
        state.gameplay.input.right = false;
        state.gameplay.input.up = false;
        state.gameplay.input.down = false;
        state.gameplay.input.jump = false;

        const gameOverMessage = `<bloody>GAME OVER</bloody>\n\nYou have been impaled by a spike! Better luck next time!`;
        showGameTextModal(gameOverMessage);

        gameOverTimeoutId = setTimeout(() => {
          exitMap();
          gameOverTimeoutId = null;
        }, 2000);
        return;
      }
    }
  }
}

function getCollisionOffsetX() {
  const player = state.player;
  const facingRight = player.facing >= 0;
  return facingRight
    ? Math.max(0, player.width - player.collisionWidth - 5)
    : 5;
}

export default {
  getAllTiles: getAllTilesFromMap,
  tiles: [
    {
      col: 17,
      row: 19,
      onTouch: (tileData) => interactWithObject("sign", tileData)
    },
    {
      col: 37,
      row: 15,
      onTouch: (tileData) => interactWithObject("lever", tileData)
    },
    {
      col: FLAG_HEAD_CONFIG.position.col,
      row: FLAG_HEAD_CONFIG.position.row,
      onTouch: (tileData) => handleFlagHeadTouch(tileData)
    }
  ],
  onTileTouch: (tileData) => {
    if (!tileData || tileData.tileIndex === undefined) {
      return;
    }

    const label = getTileTypeLabel(tileData.tileIndex);
    const lower = label.toLowerCase();

    if (lower.includes("diamond")) {
      collectDiamond(tileData);
      return;
    }

    if (lower.includes("key")) {
      const keyPos = KEY_CONFIG.keyPosition;
      if (tileData.col === keyPos.col && tileData.row === keyPos.row) {
        const mapIndex = keyPos.row * state.mapMaxColumn + keyPos.col;
        let keyTileExists = false;

        for (const layer of state.tiles.layers) {
          const tileIndex = layer.tiles[mapIndex];
          if (
            tileIndex !== undefined &&
            !state.tiles.empty.includes(tileIndex)
          ) {
            const tileLabel = getTileTypeLabel(tileIndex);
            if (tileLabel && tileLabel.toLowerCase().includes("key")) {
              keyTileExists = true;
              break;
            }
          }
        }

        const interaction = state.gameplay.interaction;
        const leverKey = "37,15";
        const leverActivated =
          interaction &&
          interaction.leverStates &&
          interaction.leverStates[leverKey] === true;

        if (
          (keyTileExists ||
            (state.gameplay.collectibles &&
              state.gameplay.collectibles.keysTotal &&
              state.gameplay.collectibles.keysTotal > 0)) &&
          leverActivated
        ) {
          collectKey(tileData);
        }
      }
      return;
    }

    if (lower.includes("flag")) {
      const flagPos = FLAG_HEAD_CONFIG.position;
      if (tileData.col === flagPos.col && tileData.row === flagPos.row) {
        handleFlagHeadTouch(tileData);
      }
      return;
    }
  },
  activateLever: activateLever,
  checkGoldenBoxBump: checkGoldenBoxBump,
  checkSpikeCollision: checkSpikeCollision,
  resetGoldenBoxBumpState: resetGoldenBoxBumpState,
  resetFlagHeadCooldown: resetFlagHeadCooldown,
  resetSpikeGameOverState: resetSpikeGameOverState,
  resetLeverAndKeyState: resetLeverAndKeyState
};
