import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";
import { proceedToNextLevel, exitMap } from "../events/uiEvents.js";
import { removeTouchedTile } from "./levels.js";
import { showGameTextModal } from "../events/playerControls.js";

const SIGN_TEXT = {
  2: {
    17: `<fun>Tutorial</fun>: Move around using WAD or Arrow keys, Space bar to jump. Beware of <bloody>spikes</bloody>!`
  }
};

const FLAG_HEAD_CONFIG = {
  position: { col: 22, row: 15 },
  cooldownDuration: 5000
};

let flagHeadLastTriggerTime = 0;
let spikeGameOverTriggered = false;
let gameOverTimeoutId = null;

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

function getCollisionOffsetX() {
  const player = state.player;
  const facingRight = player.facing >= 0;
  return facingRight
    ? Math.max(0, player.width - player.collisionWidth - 5)
    : 5;
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

export default {
  getAllTiles: getAllTilesFromMap,
  tiles: [
    {
      col: 2,
      row: 17,
      onTouch: (tileData) => interactWithObject("sign", tileData)
    },
    {
      col: FLAG_HEAD_CONFIG.position.col,
      row: FLAG_HEAD_CONFIG.position.row,
      onTouch: (tileData) => handleFlagHeadTouch(tileData)
    }
  ],
  onTileTouch: (tileData, callback = null) => {
    if (!tileData || tileData.tileIndex === undefined) {
      return;
    }

    const label = getTileTypeLabel(tileData.tileIndex);
    const lower = label.toLowerCase();

    if (lower.includes("flag")) {
      const flagPos = FLAG_HEAD_CONFIG.position;
      if (tileData.col === flagPos.col && tileData.row === flagPos.row) {
        handleFlagHeadTouch(tileData);
      }
      return;
    }
  },
  checkSpikeCollision: checkSpikeCollision,
  resetFlagHeadCooldown: resetFlagHeadCooldown,
  resetSpikeGameOverState: resetSpikeGameOverState
};
