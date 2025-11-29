import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";
import { placeTileAt } from "../tiles/autotile.js";

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
        collectKey(tileData);
      }
      return;
    }
  },
  activateLever: activateLever,
  checkGoldenBoxBump: checkGoldenBoxBump,
  resetGoldenBoxBumpState: resetGoldenBoxBumpState
};
