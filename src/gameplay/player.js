import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";

const PLAYER_CONSTANTS = {
  widthScale: 1.33,
  heightScale: 1.33,
  moveSpeed: 220,
  gravity: 2400,
  maxFallSpeed: 900,
  jumpForce: -780,
  frameDuration: 0.14,
  collisionPadding: 6,
  spawnOffsetX: 8,
};

export function initPlayer() {
  const tileSize = state.tiles.size || 32;
  state.player.width = Math.floor(tileSize * PLAYER_CONSTANTS.widthScale);
  state.player.height = Math.floor(tileSize * PLAYER_CONSTANTS.heightScale);
  state.player.collisionWidth = tileSize;
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

  if (state.gameplay.isPlaying) {
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
  ["importBtn", "exportBtn", "resetBtn"].forEach((key) => {
    const button = state.dom[key];
    if (button) {
      button.style.display = displayValue;
    }
  });
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

  const horizontalDirection = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.velocity.x = horizontalDirection * PLAYER_CONSTANTS.moveSpeed;
  if (horizontalDirection !== 0) {
    player.facing = horizontalDirection;
  }
  const nextX = player.position.x + player.velocity.x * dt;
  if (!resolveHorizontalCollisions(nextX, tileSize)) {
    player.position.x = nextX;
  }
  player.position.x = Math.max(
    0,
    Math.min(player.position.x, state.canvas.width - player.width)
  );

  player.velocity.y += PLAYER_CONSTANTS.gravity * dt;
  player.velocity.y = Math.min(
    player.velocity.y,
    PLAYER_CONSTANTS.maxFallSpeed
  );

  if (input.jump && player.onGround) {
    player.velocity.y = PLAYER_CONSTANTS.jumpForce;
    player.onGround = false;
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

  if (player.position.y + player.height >= state.canvas.height) {
    player.position.y = state.canvas.height - player.height;
    player.velocity.y = 0;
    player.onGround = true;
  }
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
}

function resolveHorizontalCollisions(nextX, tileSize) {
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow)
    return false;
  const player = state.player;
  const movingRight = nextX > player.position.x;
  const collisionOffsetX = (player.width - player.collisionWidth) / 2;
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
    if (
      isSpecificTileType(tileCol, row, "solid") ||
      isSpecificTileType(tileCol, row, "platform")
    ) {
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
  const collisionOffsetX = (player.width - player.collisionWidth) / 2;
  const collisionOffsetY = (player.height - player.collisionHeight) / 2;
  const collisionY = player.position.y + collisionOffsetY;
  const nextCollisionY = nextY + collisionOffsetY;
  const collisionEdge = falling
    ? nextCollisionY + player.collisionHeight
    : nextCollisionY;
  const tileRow = Math.floor(collisionEdge / tileSize);
  const padding = PLAYER_CONSTANTS.collisionPadding;
  const leftCol = Math.floor(
    (player.position.x + collisionOffsetX + padding) / tileSize
  );
  const rightCol = Math.floor(
    (player.position.x + collisionOffsetX + player.collisionWidth - padding) /
      tileSize
  );

  if (
    tileRow < 0 ||
    tileRow >= state.mapMaxRow ||
    rightCol < 0 ||
    leftCol >= state.mapMaxColumn
  ) {
    return false;
  }

  for (let col = leftCol; col <= rightCol; col++) {
    if (isSpecificTileType(col, tileRow, "solid")) {
      if (falling) {
        player.position.y =
          tileRow * tileSize - player.collisionHeight - collisionOffsetY;
        player.velocity.y = 0;
        player.onGround = true;
      } else {
        player.position.y = (tileRow + 1) * tileSize - collisionOffsetY;
        player.velocity.y = 0;
      }
      return true;
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
  const x =
    signTile.col * tileSize +
    tileSize +
    PLAYER_CONSTANTS.spawnOffsetX -
    state.player.width / 2;
  const y = signTile.row * tileSize - state.player.height;
  return { x, y };
}
