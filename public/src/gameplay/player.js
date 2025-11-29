import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";
import {
  checkTileInteractions,
  getPlayerTilePositionPublic
} from "./levels.js";

const PLAYER_CONSTANTS = {
  widthScale: 1.33,
  heightScale: 1.33,
  moveSpeed: 150,
  climbSpeed: 150,
  climbColliderWidthRatio: 0.35,
  gravity: 1500,
  maxFallSpeed: 900,
  jumpForce: -475,
  swimGravity: 300,
  swimMaxFallSpeed: 200,
  swimJumpForce: -200,
  frameDuration: 0.14,
  collisionPadding: 6,
  frontCollisionPadding: 8,
  spawnOffsetX: 8
};

function isMapEmpty() {
  const layers = state.tiles?.layers || [];
  if (layers.length === 0) {
    return true;
  }

  const emptyTileValues = new Set(state.tiles?.empty || []);
  if (state.editing?.eraserBrush !== undefined) {
    emptyTileValues.add(state.editing.eraserBrush);
  }

  for (const layer of layers) {
    const tiles = layer?.tiles || [];
    if (tiles.length === 0) continue;
    for (const tile of tiles) {
      if (!emptyTileValues.has(tile)) {
        return false;
      }
    }
  }

  return true;
}

export function initPlayer() {
  const tileSize = state.tiles.size || 32;
  state.player.width = Math.floor(tileSize * PLAYER_CONSTANTS.widthScale);
  state.player.height = Math.floor(tileSize * PLAYER_CONSTANTS.heightScale);
  state.player.collisionWidth = Math.max(1, Math.floor(tileSize * 0.75));
  state.player.collisionHeight = tileSize;
  resetPlayerState();
}

export function togglePlayMode() {
  const button = state.dom.testBtn;
  state.editing.isEditing = !state.editing.isEditing;
  state.gameplay.isPlaying = !state.gameplay.isPlaying;
  state.gameplay.input.left = false;
  state.gameplay.input.right = false;
  state.gameplay.input.jump = false;
  state.gameplay.input.up = false;
  state.gameplay.input.down = false;

  if (state.gameplay.isPlaying) {
    const collectibles = state.gameplay.collectibles;
    if (collectibles) {
      collectibles.diamondsCollected = 0;
      if (collectibles.collectedDiamondKeys?.clear) {
        collectibles.collectedDiamondKeys.clear();
      } else if (Array.isArray(collectibles.collectedDiamondKeys)) {
        collectibles.collectedDiamondKeys.length = 0;
      }
    }

    resetPlayerState();
    if (button) button.textContent = "Stop";
    setEditorButtonsVisibility(true);
  } else {
    state.player.velocity.x = 0;
    state.player.velocity.y = 0;
    state.player.animation = "idle";
    state.player.frameIndex = 0;
    state.player.frameTimer = 0;
    if (button) button.textContent = "Test";
    setEditorButtonsVisibility(false);
  }
}

function setEditorButtonsVisibility(shouldHide) {
  const displayValue = shouldHide ? "none" : "";
  const isPlayMode = state.gameplay.playMode.isActive;

  ["importBtn", "showAllLevelsBtn"].forEach((key) => {
    const button = state.dom[key];
    if (button) {
      button.style.display = displayValue;
    }
  });

  if (state.dom.testBtn) {
    state.dom.testBtn.style.display = isPlayMode ? "none" : "";
  }

  if (state.dom.resetBtn) {
    state.dom.resetBtn.style.display = shouldHide || isMapEmpty() ? "none" : "";
  }
  if (state.dom.exportBtn) {
    state.dom.exportBtn.style.display =
      shouldHide || isMapEmpty() ? "none" : "";
  }
  if (state.dom.revertBtn) {
    state.dom.revertBtn.style.display =
      shouldHide || isMapEmpty() || !state.originalMapData ? "none" : "";
  }
  if (state.dom.exitMapBtn) {
    state.dom.exitMapBtn.style.display = shouldHide ? "none" : "";
    if (state.dom.exitMapBtn.style.display !== "none") {
      state.dom.exitMapBtn.textContent = isPlayMode ? "Quit" : "Exit Editor";
    }
  }
  const saveAsLevelBtn = state.dom.saveAsLevelBtn;
  if (saveAsLevelBtn) {
    saveAsLevelBtn.style.display = shouldHide || isMapEmpty() ? "none" : "";
  }
  const saveLevelBtn = state.dom.saveLevelBtn;
  if (saveLevelBtn) {
    if (shouldHide) {
      saveLevelBtn.style.display = "none";
    } else {
      saveLevelBtn.style.display =
        !isMapEmpty() &&
        state.lastLoadedLevel.id &&
        state.lastLoadedLevel.author
          ? ""
          : "none";
    }
  }
  const resetPlayerBtn = state.dom.resetPlayerBtn;
  if (resetPlayerBtn) {
    resetPlayerBtn.style.display = shouldHide ? "" : "none";
  }
}

export function updatePlayer(deltaSeconds = 0) {
  if (!state.gameplay.isPlaying || !state.canvas) return;
  const player = state.player;
  const input = state.gameplay.input;
  const dt = Math.max(deltaSeconds, 0);
  const tileSize = state.tiles.size || 1;

  const verticalDirection = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const horizontalDirection = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  const climbSurface = detectClimbSurface(tileSize);
  if (climbSurface) {
    player.isClimbing = true;
    player.climbAxis = climbSurface.orientation;
    player.climbTile = climbSurface.tile;
  } else if (player.isClimbing) {
    player.isClimbing = false;
    player.climbAxis = null;
    player.climbTile = null;
  } else {
    player.climbTile = null;
  }

  const isInWater = detectWater(tileSize);
  player.isSwimming = isInWater;

  player.velocity.x = horizontalDirection * PLAYER_CONSTANTS.moveSpeed;
  if (horizontalDirection !== 0) {
    player.facing = horizontalDirection;
  }
  const nextX = player.position.x + player.velocity.x * dt;
  if (!resolveHorizontalCollisions(nextX, tileSize)) {
    player.position.x = nextX;
  }
  const mapWidth = state.mapMaxColumn * tileSize;
  player.position.x = Math.max(
    0,
    Math.min(player.position.x, mapWidth - player.width)
  );

  if (player.isClimbing) {
    player.velocity.y =
      player.climbAxis === "vertical"
        ? verticalDirection * PLAYER_CONSTANTS.climbSpeed
        : 0;
    player.onGround = false;
  } else if (player.isSwimming) {
    player.velocity.y += PLAYER_CONSTANTS.swimGravity * dt;
    player.velocity.y = Math.min(
      player.velocity.y,
      PLAYER_CONSTANTS.swimMaxFallSpeed
    );

    if (input.jump) {
      player.velocity.y = PLAYER_CONSTANTS.swimJumpForce;
      player.onGround = false;
    }
  } else {
    player.velocity.y += PLAYER_CONSTANTS.gravity * dt;
    player.velocity.y = Math.min(
      player.velocity.y,
      PLAYER_CONSTANTS.maxFallSpeed
    );

    if (input.jump && player.onGround) {
      player.velocity.y = PLAYER_CONSTANTS.jumpForce;
      player.onGround = false;
    }
  }

  const nextY = player.position.y + player.velocity.y * dt;
  if (!resolveVerticalCollisions(nextY, tileSize)) {
    player.position.y = nextY;
    player.onGround = false;
  }

  const nextAnimation =
    !player.onGround || Math.abs(player.velocity.x) > 1 ? "move" : "idle";
  if (nextAnimation !== player.animation) {
    player.animation = nextAnimation;
    player.frameIndex = nextAnimation === "move" ? 1 : 0;
    player.frameTimer = 0;
  } else if (player.onGround || player.animation === "move") {
    player.frameTimer += dt;
    if (player.frameTimer >= PLAYER_CONSTANTS.frameDuration) {
      player.frameTimer = 0;
      const frameCount =
        player.animation === "move" ? 2 : getAnimationFrameCount();
      player.frameIndex = (player.frameIndex + 1) % frameCount;
    }
  }

  const mapHeight = state.mapMaxRow * tileSize;
  if (player.position.y + player.height >= mapHeight) {
    player.position.y = mapHeight - player.height;
    player.velocity.y = 0;
    player.onGround = true;
  }

  checkTileInteractions();
}

export function drawPlayer() {
  if (!state.gameplay.isPlaying || !state.ctx) return;
  const player = state.player;
  const spriteSheet = state.loadedImages["characters"];

  const shouldFlip = player.facing < 0;
  state.ctx.save();
  if (shouldFlip) {
    state.ctx.scale(-1, 1);
  }
  const drawX = shouldFlip
    ? -(player.position.x + player.width)
    : player.position.x;

  if (!spriteSheet?.image) {
    state.ctx.fillStyle = "#ff4d6d";
    state.ctx.fillRect(drawX, player.position.y, player.width, player.height);
    state.ctx.restore();

    return;
  }

  const frame = getCurrentFrame(spriteSheet);
  if (!frame) {
    state.ctx.restore();

    return;
  }

  state.ctx.drawImage(
    spriteSheet.image,
    frame.x * spriteSheet.size,
    frame.y * spriteSheet.size,
    spriteSheet.size,
    spriteSheet.size,
    drawX,
    player.position.y - 5,
    player.width,
    player.height
  );
  state.ctx.restore();
  drawInteractionPrompt();
}

export function resetPlayerState() {
  const spawnPosition = findSignSpawnPosition();
  const fallbackX =
    (state.canvas?.width || window.innerWidth) * 0.1 - state.player.width / 2;
  const fallbackY =
    (state.canvas?.height || window.innerHeight) * 0.1 - state.player.height;
  state.player.position.x = Math.max(
    Math.min(
      spawnPosition?.x ?? fallbackX,
      (state.canvas?.width || window.innerWidth) - state.player.width
    ),
    0
  );
  state.player.position.y = Math.max(spawnPosition?.y ?? fallbackY, 0);
  state.player.velocity.x = 0;
  state.player.velocity.y = 0;
  state.player.animation = "idle";
  state.player.frameIndex = 0;
  state.player.frameTimer = 0;
  state.player.onGround = false;
  state.player.facing = 1;
  state.player.isClimbing = false;
  state.player.climbAxis = null;
  state.player.climbTile = null;
  state.player.isSwimming = false;

  if (state.gameplay.isPlaying && state.canvas) {
    const playerCenterX = state.player.position.x + state.player.width / 2;
    const playerCenterY = state.player.position.y + state.player.height / 2;
    const zoom = state.camera.zoom;
    const scaledCanvasWidth = state.canvas.width / zoom;
    const scaledCanvasHeight = state.canvas.height / zoom;
    state.camera.x = playerCenterX - scaledCanvasWidth / 2;
    state.camera.y = playerCenterY - scaledCanvasHeight / 2;
  }
}

export function updateCamera(deltaSeconds = 0) {
  if (!state.gameplay.isPlaying || !state.canvas) return;

  const canvas = state.canvas;
  const tileSize = state.tiles.size || 1;
  const zoom = state.camera.zoom;
  const mapWidth = state.mapMaxColumn * tileSize;
  const mapHeight = state.mapMaxRow * tileSize;
  const scaledCanvasWidth = canvas.width / zoom;
  const scaledCanvasHeight = canvas.height / zoom;

  // Handle camera panning to target position
  if (state.camera.targetX !== null && state.camera.targetY !== null) {
    const targetX = state.camera.targetX - scaledCanvasWidth / 2;
    const targetY = state.camera.targetY - scaledCanvasHeight / 2;

    const dx = targetX - state.camera.x;
    const dy = targetY - state.camera.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 1) {
      const moveDistance = state.camera.panSpeed * deltaSeconds;
      if (distance <= moveDistance) {
        state.camera.x = targetX;
        state.camera.y = targetY;
        // Camera reached target, start hold timer
        if (state.camera.panCallbackTime === null) {
          state.camera.panCallbackTime = performance.now();
        }
      } else {
        state.camera.x += (dx / distance) * moveDistance;
        state.camera.y += (dy / distance) * moveDistance;
      }
    } else {
      state.camera.x = targetX;
      state.camera.y = targetY;
      // Camera reached target, start hold timer
      if (state.camera.panCallbackTime === null) {
        state.camera.panCallbackTime = performance.now();
      }
    }

    // Check if hold duration has passed
    if (
      state.camera.panCallbackTime !== null &&
      state.camera.panHoldDuration > 0
    ) {
      const elapsed = performance.now() - state.camera.panCallbackTime;
      if (elapsed >= state.camera.panHoldDuration) {
        // Hold duration complete, execute callback
        const callback = state.camera.panCallback;
        state.camera.panCallback = null;
        state.camera.panCallbackTime = null;
        state.camera.panHoldDuration = 0;
        if (callback) callback();
      }
    }
  } else if (state.camera.isFollowingPlayer) {
    // Normal camera following behavior
    const player = state.player;
    const playerCenterX = player.position.x + player.width / 2;
    const playerCenterY = player.position.y + player.height / 2;

    const canvasRect = canvas.getBoundingClientRect();
    const mouseX = state.pointer.x - canvasRect.left;
    const mouseY = state.pointer.y - canvasRect.top;

    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;

    const mouseOffsetX =
      canvas.width > 0 ? ((mouseX - canvasCenterX) / canvasCenterX) * 0.3 : 0;
    const mouseOffsetY =
      canvas.height > 0 ? ((mouseY - canvasCenterY) / canvasCenterY) * 0.3 : 0;

    const targetCameraX =
      playerCenterX -
      scaledCanvasWidth / 2 +
      mouseOffsetX * scaledCanvasWidth * 0.2;
    const targetCameraY =
      playerCenterY -
      scaledCanvasHeight / 2 +
      mouseOffsetY * scaledCanvasHeight * 0.2;

    const cameraSmoothingFactor = 50;
    state.camera.x += (targetCameraX - state.camera.x) / cameraSmoothingFactor;
    state.camera.y += (targetCameraY - state.camera.y) / cameraSmoothingFactor;
  }

  // Clamp camera to map bounds
  const minCameraX = 0;
  const maxCameraX = Math.max(0, mapWidth - scaledCanvasWidth);
  const minCameraY = 0;
  const maxCameraY = Math.max(0, mapHeight - scaledCanvasHeight);

  state.camera.x = Math.max(minCameraX, Math.min(maxCameraX, state.camera.x));
  state.camera.y = Math.max(minCameraY, Math.min(maxCameraY, state.camera.y));
}

function resolveHorizontalCollisions(nextX, tileSize) {
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow)
    return false;
  const player = state.player;
  const movingRight = nextX > player.position.x;
  const collisionOffsetX = getCollisionOffsetX();
  const collisionX = player.position.x + collisionOffsetX;
  const nextCollisionX = nextX + collisionOffsetX;
  const collisionEdge = movingRight
    ? nextCollisionX + player.collisionWidth
    : nextCollisionX;
  const tileCol = Math.floor(collisionEdge / tileSize);
  const padding = PLAYER_CONSTANTS.collisionPadding;
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  const topRow = Math.floor(
    (player.position.y + collisionOffsetY + padding) / tileSize
  );
  const bottomRow = Math.floor(
    (player.position.y + collisionOffsetY + player.collisionHeight - padding) /
      tileSize
  );

  if (
    tileCol < 0 ||
    tileCol >= state.mapMaxColumn ||
    bottomRow < 0 ||
    topRow >= state.mapMaxRow
  ) {
    return false;
  }

  for (let row = topRow; row <= bottomRow; row++) {
    const isSolid = isSpecificTileType(tileCol, row, "solid");
    const isBox = isSpecificTileType(tileCol, row, "box");

    if (isSolid || isBox) {
      if (movingRight) {
        player.position.x =
          tileCol * tileSize - player.collisionWidth - collisionOffsetX;
        player.velocity.x = 0;
      } else {
        player.position.x = (tileCol + 1) * tileSize - collisionOffsetX;
        player.velocity.x = 0;
      }
      return true;
    }
  }
  return false;
}

function resolveVerticalCollisions(nextY, tileSize) {
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow)
    return false;
  const player = state.player;
  const falling = nextY > player.position.y;
  const collisionOffsetX = getCollisionOffsetX();
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  const nextCollisionY = nextY + collisionOffsetY;
  const padding = PLAYER_CONSTANTS.collisionPadding;
  const leftCol = Math.floor(
    (player.position.x + collisionOffsetX + padding) / tileSize
  );
  const rightCol = Math.floor(
    (player.position.x + collisionOffsetX + player.collisionWidth - padding) /
      tileSize
  );

  if (falling) {
    const footHeight = player.collisionHeight / 4;
    const footTop = nextCollisionY + player.collisionHeight - footHeight;
    const footBottom = nextCollisionY + player.collisionHeight;
    const tileRow = Math.floor(footBottom / tileSize);

    if (
      tileRow >= 0 &&
      tileRow < state.mapMaxRow &&
      rightCol >= 0 &&
      leftCol < state.mapMaxColumn
    ) {
      for (let col = leftCol; col <= rightCol; col++) {
        const isSolid = isSpecificTileType(col, tileRow, "solid");
        const isPlatform = isSpecificTileType(col, tileRow, "platform");
        const isBox = isSpecificTileType(col, tileRow, "box");

        if (isSolid || isPlatform || isBox) {
          const tileTop = tileRow * tileSize;
          const tileCollisionHeight = isPlatform ? tileSize / 4 : tileSize;
          const tileBottom = tileTop + tileCollisionHeight;

          if (footBottom > tileTop && footTop < tileBottom) {
            player.position.y =
              tileRow * tileSize - player.collisionHeight - collisionOffsetY;
            player.velocity.y = 0;
            player.onGround = true;
            return true;
          }
        }
      }
    }
  }

  if (!falling) {
    const collisionEdge = nextCollisionY;
    const headTileRow = Math.floor(collisionEdge / tileSize);

    if (
      headTileRow >= 0 &&
      headTileRow < state.mapMaxRow &&
      rightCol >= 0 &&
      leftCol < state.mapMaxColumn
    ) {
      for (let col = leftCol; col <= rightCol; col++) {
        const isSolid = isSpecificTileType(col, headTileRow, "solid");
        const isBox = isSpecificTileType(col, headTileRow, "box");

        if (isSolid || isBox) {
          player.position.y = (headTileRow + 1) * tileSize - collisionOffsetY;
          player.velocity.y = 0;
          return true;
        }
      }
    }
  }

  return false;
}

function isSpecificTileType(col, row, type) {
  if (
    col < 0 ||
    row < 0 ||
    col >= state.mapMaxColumn ||
    row >= state.mapMaxRow
  ) {
    return false;
  }
  const index = row * state.mapMaxColumn + col;
  for (const layer of state.tiles.layers) {
    const tileIndex = layer.tiles[index];
    if (tileIndex === undefined || tileIndex === state.editing.eraserBrush)
      continue;
    const label = getTileTypeLabel(tileIndex);
    if (label && label.toLowerCase().includes(type)) {
      return true;
    }
  }
  return false;
}

function getCurrentFrame(spriteSheet) {
  const player = state.player;
  const players = spriteSheet.player || [];
  const descriptor = players[player.characterIndex] ||
    players[0] || { frames: [] };

  if (player.animation === "move") {
    const idleFrame = descriptor.frames.find((f) => f.animation === "idle");
    const moveFrame = descriptor.frames.find((f) => f.animation === "move");
    if (idleFrame && moveFrame) {
      return player.frameIndex % 2 === 0 ? idleFrame : moveFrame;
    }
  }

  const frames = getFramesForAnimation(spriteSheet);
  if (!frames.length) return null;
  return frames[player.frameIndex % frames.length];
}

function getFramesForAnimation(spriteSheet) {
  const players = spriteSheet.player || [];
  const descriptor = players[state.player.characterIndex] ||
    players[0] || { frames: [] };
  const filtered = descriptor.frames.filter(
    (frame) => frame.animation === state.player.animation
  );
  return filtered.length ? filtered : descriptor.frames || [];
}

function getAnimationFrameCount() {
  const spriteSheet = state.loadedImages["characters"];
  if (!spriteSheet) return 1;
  return Math.max(getFramesForAnimation(spriteSheet).length, 1);
}

function findSignSpawnPosition() {
  if (
    !state.tiles.layers.length ||
    !state.mapMaxColumn ||
    !state.mapMaxRow ||
    !state.tiles.size
  ) {
    return null;
  }

  let signTile = null;
  for (const layer of state.tiles.layers) {
    for (let i = 0; i < layer.tiles.length; i++) {
      const tileIndex = layer.tiles[i];
      if (tileIndex === undefined || tileIndex === state.editing.eraserBrush)
        continue;
      const label = getTileTypeLabel(tileIndex);
      if (label && label.toLowerCase().includes("sign")) {
        const col = i % state.mapMaxColumn;
        const row = Math.floor(i / state.mapMaxColumn);
        if (!signTile || col < signTile.col) {
          signTile = { col, row };
        }
      }
    }
  }

  if (!signTile) return null;

  const tileSize = state.tiles.size;
  const x = signTile.col * tileSize + tileSize / 2 - state.player.width / 2;
  const y = signTile.row * tileSize - state.player.height;
  return { x, y };
}

function detectClimbSurface(tileSize) {
  if (
    !tileSize ||
    !state.tiles.layers.length ||
    !state.mapMaxColumn ||
    !state.mapMaxRow
  ) {
    return null;
  }

  const player = state.player;
  const collisionOffsetX = getCollisionOffsetX();
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  const leftCol = Math.max(
    0,
    Math.floor((player.position.x + collisionOffsetX) / tileSize)
  );
  const rightCol = Math.min(
    state.mapMaxColumn - 1,
    Math.floor(
      (player.position.x + collisionOffsetX + player.collisionWidth) / tileSize
    )
  );
  const topRow = Math.max(
    0,
    Math.floor((player.position.y + collisionOffsetY) / tileSize)
  );
  const bottomRow = Math.min(
    state.mapMaxRow - 1,
    Math.floor(
      (player.position.y + collisionOffsetY + player.collisionHeight) / tileSize
    )
  );

  const playerCollisionRect = {
    x: player.position.x + collisionOffsetX,
    y: player.position.y + collisionOffsetY,
    width: player.collisionWidth,
    height: player.collisionHeight
  };

  for (let row = topRow; row <= bottomRow; row++) {
    for (let col = leftCol; col <= rightCol; col++) {
      const label = getTileLabelAt(col, row);
      if (!label) continue;
      const lower = label.toLowerCase();
      if (lower.includes("ladder") || lower.includes("rope")) {
        const orientation =
          lower.includes("horizontal") ||
          lower.includes("left") ||
          lower.includes("right")
            ? "horizontal"
            : "vertical";
        const narrowWidth = Math.max(
          4,
          tileSize * PLAYER_CONSTANTS.climbColliderWidthRatio
        );
        const tileX = col * tileSize + (tileSize - narrowWidth) / 2;
        const tileY = row * tileSize;
        const tileRect = {
          x: tileX,
          y: tileY,
          width: narrowWidth,
          height: tileSize,
          col,
          row
        };
        if (rectsOverlap(playerCollisionRect, tileRect)) {
          return {
            orientation,
            tile: tileRect
          };
        }
      }
    }
  }
  return null;
}

function getCollisionOffsetX() {
  const player = state.player;
  const facingRight = player.facing >= 0;
  return facingRight
    ? Math.max(
        0,
        player.width -
          player.collisionWidth -
          PLAYER_CONSTANTS.frontCollisionPadding
      )
    : PLAYER_CONSTANTS.frontCollisionPadding;
}

function getTileLabelAt(col, row) {
  if (
    col < 0 ||
    row < 0 ||
    col >= state.mapMaxColumn ||
    row >= state.mapMaxRow
  ) {
    return null;
  }
  const index = row * state.mapMaxColumn + col;
  for (const layer of state.tiles.layers) {
    const tileIndex = layer.tiles[index];
    if (tileIndex === undefined || tileIndex === state.editing.eraserBrush)
      continue;
    const label = getTileTypeLabel(tileIndex);
    if (label) return label;
  }
  return null;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function detectWater(tileSize) {
  if (
    !tileSize ||
    !state.tiles.layers.length ||
    !state.mapMaxColumn ||
    !state.mapMaxRow
  ) {
    return false;
  }

  const player = state.player;
  const collisionOffsetX = getCollisionOffsetX();
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  const leftCol = Math.max(
    0,
    Math.floor((player.position.x + collisionOffsetX) / tileSize)
  );
  const rightCol = Math.min(
    state.mapMaxColumn - 1,
    Math.floor(
      (player.position.x + collisionOffsetX + player.collisionWidth) / tileSize
    )
  );
  const topRow = Math.max(
    0,
    Math.floor((player.position.y + collisionOffsetY) / tileSize)
  );
  const bottomRow = Math.min(
    state.mapMaxRow - 1,
    Math.floor(
      (player.position.y + collisionOffsetY + player.collisionHeight) / tileSize
    )
  );

  for (let row = topRow; row <= bottomRow; row++) {
    for (let col = leftCol; col <= rightCol; col++) {
      const label = getTileLabelAt(col, row);
      if (!label) continue;
      const lower = label.toLowerCase();
      if (lower.includes("water") || lower.includes("waterfall")) {
        return true;
      }
    }
  }
  return false;
}

function drawInteractionPrompt() {
  if (!state.gameplay.isPlaying || !state.ctx) return;

  const interaction = state.gameplay.interaction;
  if (!interaction || interaction.isTextModalOpen) {
    return;
  }

  const tileSize = state.tiles.size || 1;
  const playerTilePos = getPlayerTilePositionPublic(tileSize);

  let activeObject = null;
  if (interaction.activeLever) {
    if (
      playerTilePos.col === interaction.activeLever.col &&
      playerTilePos.row === interaction.activeLever.row
    ) {
      if (interaction.activeLever.type === "activate-only") {
        const leverKey = `${interaction.activeLever.col},${interaction.activeLever.row}`;
        const isActivated = interaction.leverStates?.[leverKey] || false;
        if (!isActivated) {
          activeObject = interaction.activeLever;
        }
      } else {
        activeObject = interaction.activeLever;
      }
    }
  }

  if (!activeObject && interaction.activeSign) {
    if (
      playerTilePos.col === interaction.activeSign.col &&
      playerTilePos.row === interaction.activeSign.row
    ) {
      activeObject = interaction.activeSign;
    }
  }

  if (!activeObject) {
    return;
  }

  const ctx = state.ctx;
  const player = state.player;
  const text = "[E] to interact";
  const textX = player.position.x + player.width / 2;
  const textY = player.position.y - 14;

  ctx.save();
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(text);
  const paddingX = 8;
  const paddingY = 6;
  const boxWidth = metrics.width + paddingX * 2;
  const boxHeight = 18;

  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(textX - boxWidth / 2, textY - boxHeight, boxWidth, boxHeight);

  ctx.fillStyle = "#f8f9fa";
  ctx.fillText(text, textX, textY - boxHeight / 2);

  ctx.restore();
}
