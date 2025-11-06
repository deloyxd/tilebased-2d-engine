window.onload = startEngine;

let c;
let ctx = null;

let engineFirstFrame = true;
let startGame = false;

let fps = 0;
let frameCount = 0;
let lastTime = 0;

let loadingMessage = "Loading assets: ...";
let loadedImages = {};

const tiles = {
  size: 36,
  bg: [],
  empty: [-1],
};
let mapMaxRow;
let mapMaxColumn;
let maxCanvasWidth;
let maxCanvasHeight;

let palette;
let paletteHeader;
let paletteCanvas;
let paletteContext;
let paletteResizer;
let paletteRect;
let paletteBorderWidth;
let isEditing = true;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isDragging = false;
let isResizing = false;
let isScrolling = false;
let isSelecting = false;
let isMoveSelecting = false;
let isMoving = false;
let isErasing = false;
let isReplacing = false;
let replaceState = {
  state: 0,
  states: ["not", "replacing", "replaced"],
  tileIndex: 0,
};
let resizingEdge = null;
let paletteScrollX = 0;
let paletteScrollY = 0;
let paletteScrollOrigin = null;
let tileDashOffset = 0;
let selectedTileIndex = 0;
let selectionStart = null;
let selectionEnd = null;
let selectedTiles = { startX: 0, startY: 0, width: 1, height: 1 };
let eraserBrush;
let paintBrushGroup = {};
let paintBrush;
let moveSelectedTiles = {};
let moveSelectionStart = null;
let moveSelectionEnd = null;
let moveTilesData = [];
const PALETTE_TILE_SIZE_SCALE = 2;
const PALETTE_SCROLL_SPEED = 200;
const RESIZE_MARGIN = 6;

let undoStack = [];
let redoStack = [];
const MAX_UNDO_STEPS = 10000;

let gameMouseX = 0;
let gameMouseY = 0;

const importBtn = document.getElementById("importBtn");
importBtn.addEventListener("click", () => {
  document.getElementById("importFile").click();
});

const exportBtn = document.getElementById("exportBtn");
exportBtn.addEventListener("click", exportMap);

document.getElementById("importFile").addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    saveStateToUndo();
    importMap(e.target.files[0]);
    e.target.value = "";
  }
});

function startEngine() {
  c = document.getElementById("screen");
  ctx = c.getContext("2d");
  palette = document.getElementById("palette");
  paletteHeader = document.getElementById("palette-header");
  paletteCanvas = document.getElementById("palette-canvas");
  paletteContext = paletteCanvas.getContext("2d");
  paletteBorderWidth = parseInt(getComputedStyle(palette).borderWidth);
  requestAnimationFrame(gameLoop);
  loadImages(() => {
    refreshEngine();
    startGame = true;
  });
}

function engineFirstTime() {
  engineFirstFrame = false;

  paletteHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    paletteHeader.style.cursor = "grabbing";
    dragOffsetX = e.clientX - palette.offsetLeft;
    dragOffsetY = e.clientY - palette.offsetTop;
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target.id === "screen") {
      if (isMoveSelecting && !isMoving) {
        const tileX = Math.floor(gameMouseX / tiles.size);
        const tileY = Math.floor(gameMouseY / tiles.size);
        moveSelectionStart = { x: tileX, y: tileY };
        moveSelectionEnd = { x: tileX, y: tileY };
      } else if (!isMoveSelecting) {
        if (replaceState.state === 0) replaceState.state = 1;
        if (!isReplacing) isReplacing = true;
      }
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      paletteHeader.style.cursor = "grab";
    }
    if (isResizing) {
      isResizing = false;
      resizingEdge = null;
      paletteRect = null;
    }
    if (isScrolling) {
      isScrolling = false;
      paletteScrollOrigin = null;
    }
    if (isSelecting) {
      isSelecting = false;
      if (selectionStart && selectionEnd) {
        const tilesPerRow =
          loadedImages["tileset"].image.width / loadedImages["tileset"].size;
        const startTileX = Math.min(selectionStart.x, selectionEnd.x);
        const startTileY = Math.min(selectionStart.y, selectionEnd.y);
        const endTileX = Math.max(selectionStart.x, selectionEnd.x);
        const endTileY = Math.max(selectionStart.y, selectionEnd.y);
        selectedTiles = {
          startX: startTileX,
          startY: startTileY,
          width: endTileX - startTileX + 1,
          height: endTileY - startTileY + 1,
        };
        selectedTileIndex = startTileY * tilesPerRow + startTileX;
        paintBrushGroup = selectedTiles;
        paintBrush = selectedTileIndex;
      }
      selectionStart = null;
      selectionEnd = null;
    }
    if (
      isMoveSelecting &&
      moveSelectionStart &&
      moveSelectionEnd &&
      !isMoving
    ) {
      saveMap();
      saveStateToUndo();
      const startX = Math.min(moveSelectionStart.x, moveSelectionEnd.x);
      const startY = Math.min(moveSelectionStart.y, moveSelectionEnd.y);
      const endX = Math.max(moveSelectionStart.x, moveSelectionEnd.x);
      const endY = Math.max(moveSelectionStart.y, moveSelectionEnd.y);

      moveSelectedTiles = {
        startX: startX,
        startY: startY,
        width: endX - startX + 1,
        height: endY - startY + 1,
      };

      moveTilesData = [];
      for (let h = 0; h < moveSelectedTiles.height; h++) {
        for (let w = 0; w < moveSelectedTiles.width; w++) {
          const tileX = startX + w;
          const tileY = startY + h;
          if (
            tileX >= 0 &&
            tileX < mapMaxColumn &&
            tileY >= 0 &&
            tileY < mapMaxRow
          ) {
            const mapIndex = tileY * mapMaxColumn + tileX;
            moveTilesData.push(tiles.map[mapIndex]);
            tiles.map[mapIndex] = eraserBrush;
          }
        }
      }

      isMoving = true;
      moveSelectionStart = null;
      moveSelectionEnd = null;
    } else if (isMoving) {
      const offsetX = Math.floor(moveSelectedTiles.width / 2);
      const offsetY = Math.floor(moveSelectedTiles.height / 2);
      const startTileX = Math.floor(gameMouseX / tiles.size) - offsetX;
      const startTileY = Math.floor(gameMouseY / tiles.size) - offsetY;

      let dataIndex = 0;
      for (let h = 0; h < moveSelectedTiles.height; h++) {
        for (let w = 0; w < moveSelectedTiles.width; w++) {
          const tileX = startTileX + w;
          const tileY = startTileY + h;

          if (
            tileX >= 0 &&
            tileX < mapMaxColumn &&
            tileY >= 0 &&
            tileY < mapMaxRow
          ) {
            const mapIndex = tileY * mapMaxColumn + tileX;
            if (!tiles.empty.includes(moveTilesData[dataIndex])) {
              tiles.map[mapIndex] = moveTilesData[dataIndex];
            }
          }
          dataIndex++;
        }
      }

      isMoving = false;
      isMoveSelecting = false;
      moveSelectedTiles = {};
      moveTilesData = [];
    }
    if (replaceState.state === 2) {
      replaceState.state = 0;
    }
    if (isReplacing) isReplacing = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (e.target.id === "screen" && loadedImages["tileset"]) {
      paletteHeader.innerText = `${loadedImages["tileset"].name}.${loadedImages["tileset"].extension} | Selected tile #${selectedTileIndex}`;
      gameMouseX = e.clientX;
      gameMouseY = e.clientY;

      if (isMoveSelecting && !isMoving) {
        const tileX = Math.floor(gameMouseX / tiles.size);
        const tileY = Math.floor(gameMouseY / tiles.size);
        moveSelectionEnd = { x: tileX, y: tileY };
      }
    }
    if (isDragging)
      movePaletteWindow(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
    if (isResizing && paletteRect) {
      const minSize = 100;
      const maxWidth = loadedImages["tileset"].image.width * 2;
      const maxHeight =
        loadedImages["tileset"].image.height * 2 + paletteHeader.clientHeight;
      let newWidth;
      let newHeight;
      if (resizingEdge.includes("right")) {
        newWidth = Math.max(
          Math.min(e.clientX - paletteRect.left, maxWidth),
          minSize
        );
      }
      if (resizingEdge.includes("bottom")) {
        newHeight = Math.max(
          Math.min(e.clientY - paletteRect.top, maxHeight),
          minSize
        );
      }
      if (resizingEdge.includes("left")) {
        newWidth = Math.max(
          Math.min(
            paletteRect.right - e.clientX - paletteBorderWidth * 2,
            maxWidth
          ),
          minSize
        );
        palette.style.left =
          Math.min(
            Math.max(
              e.clientX,
              paletteRect.right - maxWidth - paletteBorderWidth * 2
            ),
            paletteRect.right - minSize
          ) + "px";
      }
      if (resizingEdge.includes("top")) {
        newHeight = Math.max(
          Math.min(
            paletteRect.bottom - e.clientY - paletteBorderWidth * 2,
            maxHeight
          ),
          minSize
        );
        palette.style.top =
          Math.min(
            Math.max(
              e.clientY,
              paletteRect.bottom - maxHeight - paletteBorderWidth * 2
            ),
            paletteRect.bottom - minSize
          ) + "px";
      }
      resizePaletteWindow(newWidth, newHeight);
    }
  });

  palette.addEventListener("mousemove", (e) => {
    if (isResizing) return;

    const paletteTileSize =
      loadedImages["tileset"].size * PALETTE_TILE_SIZE_SCALE;
    const rect = palette.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - paletteBorderWidth;
    let mouseY =
      e.clientY - rect.top - paletteBorderWidth - paletteHeader.clientHeight;
    const tilesPerRow =
      loadedImages["tileset"].image.width / loadedImages["tileset"].size;
    const tileX = Math.floor(
      (mouseX + paletteScrollX * 2 * paletteTileSize) / paletteTileSize
    );
    const tileY = Math.floor(
      (mouseY + paletteScrollY * 2 * paletteTileSize) / paletteTileSize
    );
    const tileIndex = tileY * tilesPerRow + tileX;
    paletteHeader.innerText = `Ctrl + drag to scroll${
      tileIndex < 0 ? "" : " | Tile #" + tileIndex
    }`;

    if (isSelecting && selectionStart) {
      selectionEnd = { x: tileX, y: tileY };
    }

    if (isScrolling && paletteScrollOrigin) {
      const dx = e.clientX - paletteScrollOrigin.x;
      const dy = e.clientY - paletteScrollOrigin.y;
      paletteScrollOrigin.x = e.clientX;
      paletteScrollOrigin.y = e.clientY;
      const scaledTilesetWidth =
        loadedImages["tileset"].image.width * PALETTE_TILE_SIZE_SCALE;
      const scaledTilesetHeight =
        loadedImages["tileset"].image.height * PALETTE_TILE_SIZE_SCALE;
      const maxScrollX =
        (scaledTilesetWidth - paletteCanvas.clientWidth) / paletteTileSize / 2;
      const maxScrollY =
        (scaledTilesetHeight - paletteCanvas.clientHeight) /
        paletteTileSize /
        2;
      paletteScrollX = Math.max(
        0,
        Math.min(
          paletteScrollX - dx * PALETTE_SCROLL_SPEED * 0.0001,
          maxScrollX
        )
      );
      paletteScrollY = Math.max(
        0,
        Math.min(
          paletteScrollY - dy * PALETTE_SCROLL_SPEED * 0.0001,
          maxScrollY
        )
      );
      return;
    }

    mouseY += paletteHeader.clientHeight;
    resizingEdge = null;

    if (mouseX < RESIZE_MARGIN) resizingEdge = "left";
    else if (mouseX > rect.width - RESIZE_MARGIN) resizingEdge = "right";

    if (mouseY < RESIZE_MARGIN)
      resizingEdge = resizingEdge ? "top-" + resizingEdge : "top";
    else if (mouseY > rect.height - RESIZE_MARGIN)
      resizingEdge = resizingEdge ? "bottom-" + resizingEdge : "bottom";

    palette.style.cursor = resizeCursor(resizingEdge);

    function resizeCursor(edge) {
      switch (edge) {
        case "left":
        case "right":
          return "ew-resize";
        case "top":
        case "bottom":
          return "ns-resize";
        case "top-left":
        case "bottom-right":
          return "nwse-resize";
        case "top-right":
        case "bottom-left":
          return "nesw-resize";
        default:
          return "default";
      }
    }
  });

  palette.addEventListener("mousedown", (e) => {
    if (resizingEdge) {
      isResizing = true;
      paletteRect = palette.getBoundingClientRect();
    } else if (!isDragging) {
      if (e.ctrlKey) {
        isScrolling = true;
        paletteScrollOrigin = { x: e.clientX, y: e.clientY };
      } else {
        isSelecting = true;
        const paletteTileSize =
          loadedImages["tileset"].size * PALETTE_TILE_SIZE_SCALE;
        const rect = palette.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - paletteBorderWidth;
        const mouseY =
          e.clientY -
          rect.top -
          paletteBorderWidth -
          paletteHeader.clientHeight;
        const tileX = Math.floor(
          (mouseX + paletteScrollX * 2 * paletteTileSize) / paletteTileSize
        );
        const tileY = Math.floor(
          (mouseY + paletteScrollY * 2 * paletteTileSize) / paletteTileSize
        );
        selectionStart = { x: tileX, y: tileY };
        selectionEnd = { x: tileX, y: tileY };
        const tilesPerRow =
          loadedImages["tileset"].image.width / loadedImages["tileset"].size;
        const tileIndex = tileY * tilesPerRow + tileX;
        isErasing = tiles.empty.includes(tileIndex);
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey) {
      if (e.key === "z" && !e.shiftKey) {
        undo();
        return;
      } else if (e.key === "Z" && e.shiftKey) {
        redo();
        return;
      }
    }
    if (
      !(
        e.key === "e" ||
        e.key === "b" ||
        e.key === "m" ||
        e.key === "d" ||
        e.key === "Escape"
      )
    )
      return;
    isErasing = false;
    switch (e.key) {
      case "e":
        if (isMoveSelecting) {
          isMoveSelecting = false;
        }
        isErasing = true;
        selectedTileIndex = eraserBrush;
        selectedTiles = {
          startX:
            loadedImages["tileset"].empty.type === "null"
              ? -1
              : loadedImages["tileset"].empty.tile[0].x,
          startY:
            loadedImages["tileset"].empty.type === "null"
              ? -1
              : loadedImages["tileset"].empty.tile[0].y,
          width: 1,
          height: 1,
        };
        break;
      case "b":
        if (isMoveSelecting) {
          isMoveSelecting = false;
        }
        if (
          (paintBrushGroup.startX ===
            (loadedImages["tileset"].empty.type === "null"
              ? -1
              : loadedImages["tileset"].empty.tile[0].x) &&
            paintBrushGroup.startY ===
              (loadedImages["tileset"].empty.type === "null"
                ? -1
                : loadedImages["tileset"].empty.tile[0].y)) ||
          (paintBrushGroup !== null &&
            Object.keys(paintBrushGroup).length === 0)
        ) {
          selectedTileIndex = 0;
          selectedTiles = {
            startX: 0,
            startY: 0,
            width: 1,
            height: 1,
          };
        } else {
          selectedTileIndex = paintBrush;
          selectedTiles = paintBrushGroup;
        }
        break;
      case "m":
        if (!isMoveSelecting) {
          isMoveSelecting = true;
          if (!moveSelectionStart) {
            const tileX = Math.floor(gameMouseX / tiles.size);
            const tileY = Math.floor(gameMouseY / tiles.size);
            moveSelectionEnd = { x: tileX, y: tileY };
          }
        }
        break;
      case "Escape":
      case "d":
        if (isMoving) {
          const startX = moveSelectedTiles.startX;
          const startY = moveSelectedTiles.startY;
          let dataIndex = 0;
          for (let h = 0; h < moveSelectedTiles.height; h++) {
            for (let w = 0; w < moveSelectedTiles.width; w++) {
              const tileX = startX + w;
              const tileY = startY + h;
              if (
                tileX >= 0 &&
                tileX < mapMaxColumn &&
                tileY >= 0 &&
                tileY < mapMaxRow
              ) {
                const mapIndex = tileY * mapMaxColumn + tileX;
                tiles.map[mapIndex] = moveTilesData[dataIndex];
              }
              dataIndex++;
            }
          }
          saveMap();
          saveStateToUndo();
        }
        isMoveSelecting = false;
        isMoving = false;
        moveSelectedTiles = {};
        moveTilesData = [];
        moveSelectionStart = null;
        break;
    }
    paletteHeader.innerText = `${loadedImages["tileset"].name}.${loadedImages["tileset"].extension} | Selected tile #${selectedTileIndex}`;
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Control" && isScrolling) {
      isScrolling = false;
    }
  });
}

function loadImages(callback) {
  const images = [
    {
      name: "tileset",
      extension: "png",
      size: 18,
      empty: {
        type: "null",
      },
      bg: {
        name: "bg",
        extension: "png",
        type: "source",
        size: 24,
        tile: [
          {
            x: 6,
            y: 0,
          },
        ],
      },
    },
  ];
  let loaded = 0;
  let maxLoad = images.length;
  updateLoadingMessage(loaded, maxLoad);
  images.forEach((data) => {
    const image = new Image();
    image.src = `./images/${data.name}.${data.extension}`;
    image.onload = () => {
      data.image = image;
      loadedImages[data.name] = data;
      loaded++;
      updateLoadingMessage(loaded, maxLoad);
      if (loaded === maxLoad) {
        callback();
      }
    };
  });
  function updateLoadingMessage(a, b) {
    loadingMessage = `Loading assets: ${(a / b) * 100}%`;
  }
}

function gameLoop() {
  if (engineFirstFrame) engineFirstTime();
  clearScreen();
  calculateFPS();
  if (!startGame) {
    displayLoading();
  } else {
    displayGame();
    if (isEditing) {
      if (isMoveSelecting || isMoving) {
        palette.style.display = "none";
      } else {
        palette.style.display = "flex";
        displayPalette();
        displayTileSelections();
      }
      displayMoveSelection();
    }
    displayInfo();
  }
  requestAnimationFrame(gameLoop);
}

function clearScreen() {
  let screenSizeChanged = false;
  if (c.width !== window.innerWidth) {
    screenSizeChanged = true;
    c.width = window.innerWidth;
  }
  if (c.height !== window.innerHeight) {
    screenSizeChanged = true;
    c.height = window.innerHeight;
  }
  if (screenSizeChanged) {
    if (c.width > maxCanvasWidth) maxCanvasWidth = c.width;
    if (c.height > maxCanvasHeight) maxCanvasHeight = c.height;
    const newMapMaxColumn = Math.ceil(maxCanvasWidth / tiles.size);
    const newMapMaxRow = Math.ceil(maxCanvasHeight / tiles.size);
    if (newMapMaxColumn > mapMaxColumn || newMapMaxRow > mapMaxRow) {
      const oldMap = tiles.map.slice();
      tiles.map = new Array(newMapMaxColumn * newMapMaxRow).fill(eraserBrush);
      for (let y = 0; y < mapMaxRow; y++) {
        for (let x = 0; x < mapMaxColumn; x++) {
          tiles.map[y * newMapMaxColumn + x] = oldMap[y * mapMaxColumn + x];
        }
      }
      mapMaxColumn = newMapMaxColumn;
      mapMaxRow = newMapMaxRow;
      saveMap();
      saveStateToUndo();
    }
    refreshEngine();
  }
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  if (isEditing) {
    paletteContext.clearRect(0, 0, paletteCanvas.width, paletteCanvas.height);
    paletteContext.imageSmoothingEnabled = false;
  } else {
    palette.style.display = "none";
  }
}

function calculateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = Math.min(frameCount, 60);
    frameCount = 0;
    lastTime = now;
  }
}

function displayLoading() {
  if (ctx.fillStyle !== "black") ctx.fillStyle = "black";
  if (ctx.font !== "bold 20px monospace") ctx.font = "bold 20px monospace";
  ctx.fillText(loadingMessage, 15, c.height - 20);
}

function displayGame() {
  displayBackground();
  displayGameMap();
}

function displayInfo() {
  if (ctx.fillStyle !== "black") ctx.fillStyle = "black";
  ctx.font = "bold 20px monospace";
  ctx.fillText(`FPS: ${fps}`, 15, 30);
  ctx.font = "16px monospace";
  ctx.fillText(`[B]rush`, 15, 60);
  ctx.fillText(`[E]raser`, 15, 90);
  ctx.fillText(`[M]ove`, 15, 120);
  ctx.fillText(`[D]eselect`, 15, 150);
  ctx.fillText(`[Ctrl + Z] Undo`, 15, 180);
  ctx.fillText(`[Ctrl + Shift + Z] Redo`, 15, 210);
}

function refreshEngine() {
  const tileset = loadedImages["tileset"];
  if (!tileset) return;
  paletteHeader.innerText = `${loadedImages["tileset"].name}.${loadedImages["tileset"].extension}`;
  const tilesetSize = tileset.size;
  eraserBrush =
    tileset.empty.type === "null"
      ? -1
      : tileset.empty.tile[0].x +
        (tileset.image.width / tilesetSize) * tileset.empty.tile[0].y;
  paintBrush = eraserBrush;
  selectedTileIndex = eraserBrush;
  selectedTiles = {
    startX: tileset.empty.type === "null" ? -1 : tileset.empty.tile[0].x,
    startY: tileset.empty.type === "null" ? -1 : tileset.empty.tile[0].y,
    width: 1,
    height: 1,
  };
  loadMap();
  const tilesetBG = tileset.bg;
  tiles.bg = [];
  const canvasMaxColumn = Math.ceil(c.width / tiles.size);
  const canvasMaxRow = Math.ceil(c.height / tiles.size);
  switch (tilesetBG.type) {
    case "normal":
      break;
    case "random":
      break;
    case "group":
      const groupWidth = tilesetBG.tile[0].w;
      const groupHeight = tilesetBG.tile[0].h;
      for (let y = 0; y < canvasMaxRow; y += groupHeight) {
        for (let x = 0; x < canvasMaxColumn; x += groupWidth) {
          for (let h = 0; h < groupHeight; h++) {
            for (let w = 0; w < groupWidth; w++) {
              const tileX = x + w;
              const tileY = y + h;
              if (tileX >= canvasMaxColumn || tileY >= canvasMaxRow) continue;
              const srcX = (tilesetBG.tile[0].x + w) * tilesetSize;
              const srcY = (tilesetBG.tile[0].y + h) * tilesetSize;
              tiles.bg.push({
                srcX,
                srcY,
                desX: tileX * tiles.size,
                desY: tileY * tiles.size,
              });
            }
          }
        }
      }
      break;
    case "source":
      for (let y = 0; y < canvasMaxRow; y++) {
        for (let x = 0; x < canvasMaxColumn; x++) {
          tiles.bg.push({
            desX: x * tiles.size,
            desY: y * tiles.size,
          });
        }
      }
      const bgImage = new Image();
      bgImage.src = `./images/${loadedImages["tileset"].bg.name}.${loadedImages["tileset"].bg.extension}`;
      bgImage.onload = () => {
        loadedImages["tileset"].bg.image = bgImage;
      };
      break;
  }
  palette.style.display = isEditing ? "flex" : "none";
  if (isEditing) {
    resizePaletteWindow(
      loadedImages["tileset"].image.width * 2,
      loadedImages["tileset"].image.height * 2 + paletteHeader.clientHeight
    );
    movePaletteWindow(
      c.width / 2 - palette.clientWidth / 2,
      c.height / 2 - palette.clientHeight / 2
    );
  }
}

function movePaletteWindow(x, y) {
  palette.style.left = x + "px";
  palette.style.top = y + "px";
}

function resizePaletteWindow(width = null, height = null) {
  if (width) {
    palette.style.width = width + "px";
    paletteCanvas.width = palette.clientWidth;
  }
  if (height) {
    palette.style.height = height + "px";
    paletteCanvas.height = palette.clientHeight - paletteHeader.clientHeight;
  }
}

function displayPalette() {
  const paletteTileSize =
    loadedImages["tileset"].size * PALETTE_TILE_SIZE_SCALE;
  const scaledTilesetWidth =
    loadedImages["tileset"].image.width * PALETTE_TILE_SIZE_SCALE;
  const scaledTilesetHeight =
    loadedImages["tileset"].image.height * PALETTE_TILE_SIZE_SCALE;
  paletteContext.drawImage(
    loadedImages["tileset"].image,
    paletteScrollX * paletteTileSize,
    paletteScrollY * paletteTileSize,
    loadedImages["tileset"].image.width,
    loadedImages["tileset"].image.height,
    0,
    0,
    scaledTilesetWidth,
    scaledTilesetHeight
  );
}

function displayMoveSelection() {
  if (!isMoveSelecting && !isMoving) return;

  const tilesPerRow =
    loadedImages["tileset"].image.width / loadedImages["tileset"].size;

  if (isMoveSelecting && moveSelectionEnd && !isMoving) {
    const startX = moveSelectionStart
      ? Math.min(moveSelectionStart.x, moveSelectionEnd.x)
      : moveSelectionEnd.x;
    const startY = moveSelectionStart
      ? Math.min(moveSelectionStart.y, moveSelectionEnd.y)
      : moveSelectionEnd.y;
    const endX = moveSelectionStart
      ? Math.max(moveSelectionStart.x, moveSelectionEnd.x)
      : moveSelectionEnd.x;
    const endY = moveSelectionStart
      ? Math.max(moveSelectionStart.y, moveSelectionEnd.y)
      : moveSelectionEnd.y;

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
    ctx.fillRect(
      startX * tiles.size,
      startY * tiles.size,
      (endX - startX + 1) * tiles.size,
      (endY - startY + 1) * tiles.size
    );
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = tileDashOffset;
    ctx.strokeRect(
      startX * tiles.size,
      startY * tiles.size,
      (endX - startX + 1) * tiles.size,
      (endY - startY + 1) * tiles.size
    );
    ctx.restore();
  }

  if (isMoving && moveSelectedTiles.width) {
    const offsetX = Math.floor(moveSelectedTiles.width / 2);
    const offsetY = Math.floor(moveSelectedTiles.height / 2);
    const previewX = Math.floor(gameMouseX / tiles.size) - offsetX;
    const previewY = Math.floor(gameMouseY / tiles.size) - offsetY;

    let dataIndex = 0;
    for (let h = 0; h < moveSelectedTiles.height; h++) {
      for (let w = 0; w < moveSelectedTiles.width; w++) {
        const tileIdx = moveTilesData[dataIndex];
        if (tileIdx !== eraserBrush) {
          ctx.drawImage(
            loadedImages["tileset"].image,
            (tileIdx % tilesPerRow) * loadedImages["tileset"].size,
            Math.floor(tileIdx / tilesPerRow) * loadedImages["tileset"].size,
            loadedImages["tileset"].size,
            loadedImages["tileset"].size,
            (previewX + w) * tiles.size,
            (previewY + h) * tiles.size,
            tiles.size,
            tiles.size
          );
        }
        dataIndex++;
      }
    }

    ctx.save();
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = tileDashOffset;
    ctx.strokeRect(
      previewX * tiles.size,
      previewY * tiles.size,
      moveSelectedTiles.width * tiles.size,
      moveSelectedTiles.height * tiles.size
    );
    ctx.restore();
  }
}

function displayTileSelections() {
  if (isMoveSelecting || isMoving) return;

  const paletteTileSize =
    loadedImages["tileset"].size * PALETTE_TILE_SIZE_SCALE;
  const hoveredTileIndex = paletteHeader.innerText.split("Tile #")[1];
  const tilesPerRow =
    loadedImages["tileset"].image.width / loadedImages["tileset"].size;
  tileDashOffset -= 0.3;

  if (isSelecting && selectionStart && selectionEnd) {
    const startX = Math.min(selectionStart.x, selectionEnd.x);
    const startY = Math.min(selectionStart.y, selectionEnd.y);
    const endX = Math.max(selectionStart.x, selectionEnd.x);
    const endY = Math.max(selectionStart.y, selectionEnd.y);
    const rectX =
      startX * paletteTileSize - paletteScrollX * 2 * paletteTileSize;
    const rectY =
      startY * paletteTileSize - paletteScrollY * 2 * paletteTileSize;
    const rectWidth = (endX - startX + 1) * paletteTileSize;
    const rectHeight = (endY - startY + 1) * paletteTileSize;

    paletteContext.save();
    paletteContext.fillStyle = "rgba(255, 255, 255, 0.2)";
    paletteContext.fillRect(rectX, rectY, rectWidth, rectHeight);
    paletteContext.strokeStyle = "white";
    paletteContext.lineWidth = 2;
    paletteContext.setLineDash([6, 4]);
    paletteContext.lineDashOffset = tileDashOffset;
    paletteContext.strokeRect(rectX, rectY, rectWidth, rectHeight);
    paletteContext.restore();
  }

  if (hoveredTileIndex && !isResizing && !isSelecting) {
    const hoverX =
      (hoveredTileIndex % tilesPerRow) * paletteTileSize -
      paletteScrollX * 2 * paletteTileSize;
    const hoverY =
      Math.floor(hoveredTileIndex / tilesPerRow) * paletteTileSize -
      paletteScrollY * 2 * paletteTileSize;
    paletteContext.save();
    paletteContext.strokeStyle = "white";
    paletteContext.lineWidth = 1;
    paletteContext.setLineDash([6, 4]);
    paletteContext.lineDashOffset = tileDashOffset;
    paletteContext.strokeRect(hoverX, hoverY, paletteTileSize, paletteTileSize);
    paletteContext.restore();
  }

  if (!isSelecting) {
    if (selectedTileIndex === -1) {
      selectedTiles.startX = 0;
      selectedTiles.startY = 0;
    }

    if (selectedTileIndex >= 0) {
      const selectX =
        selectedTiles.startX * paletteTileSize -
        paletteScrollX * 2 * paletteTileSize;
      const selectY =
        selectedTiles.startY * paletteTileSize -
        paletteScrollY * 2 * paletteTileSize;
      const selectWidth = selectedTiles.width * paletteTileSize;
      const selectHeight = selectedTiles.height * paletteTileSize;

      paletteContext.save();
      paletteContext.strokeStyle = "white";
      paletteContext.lineWidth = 2;
      paletteContext.setLineDash([6, 4]);
      paletteContext.lineDashOffset = tileDashOffset;
      paletteContext.strokeRect(selectX, selectY, selectWidth, selectHeight);
      paletteContext.restore();
    }

    const isOutsidePalette =
      !isResizing && paletteHeader.innerText.split("Selected tile #")[1];
    if (isOutsidePalette) {
      const offsetX = Math.floor(selectedTiles.width / 2);
      const offsetY = Math.floor(selectedTiles.height / 2);
      if (selectedTileIndex >= 0) {
        for (let h = 0; h < selectedTiles.height; h++) {
          for (let w = 0; w < selectedTiles.width; w++) {
            const tileX = selectedTiles.startX + w;
            const tileY = selectedTiles.startY + h;
            const tileIdx = tileY * tilesPerRow + tileX;

            ctx.drawImage(
              loadedImages["tileset"].image,
              (tileIdx % tilesPerRow) * loadedImages["tileset"].size,
              Math.floor(tileIdx / tilesPerRow) * loadedImages["tileset"].size,
              loadedImages["tileset"].size,
              loadedImages["tileset"].size,
              (Math.floor(gameMouseX / tiles.size) - offsetX + w) * tiles.size,
              (Math.floor(gameMouseY / tiles.size) - offsetY + h) * tiles.size,
              tiles.size,
              tiles.size
            );
          }
        }
      }

      ctx.save();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = tileDashOffset;
      ctx.strokeRect(
        (Math.floor(gameMouseX / tiles.size) - offsetX) * tiles.size,
        (Math.floor(gameMouseY / tiles.size) - offsetY) * tiles.size,
        tiles.size * selectedTiles.width,
        tiles.size * selectedTiles.height
      );
      ctx.restore();

      const startTileX = Math.floor(gameMouseX / tiles.size) - offsetX;
      const startTileY = Math.floor(gameMouseY / tiles.size) - offsetY;

      let hasChanges = false;

      if (isReplacing) {
        importBtn.parentElement.style.display = "none";
        for (let h = 0; h < selectedTiles.height; h++) {
          for (let w = 0; w < selectedTiles.width; w++) {
            const tileX = startTileX + w;
            const tileY = startTileY + h;
            const replacingIndex = tileY * mapMaxColumn + tileX;

            if (
              tileX >= 0 &&
              tileX < mapMaxColumn &&
              tileY >= 0 &&
              tileY < mapMaxRow &&
              replaceState.state === 1
            ) {
              const sourceTileX = selectedTiles.startX + w;
              const sourceTileY = selectedTiles.startY + h;
              const sourceTileIdx =
                selectedTileIndex >= 0
                  ? sourceTileY * tilesPerRow + sourceTileX
                  : -1;
              if (tiles.map[replacingIndex] !== sourceTileIdx) {
                if (!hasChanges) {
                  hasChanges = true;
                  saveStateToUndo();
                }
                if (isErasing || !tiles.empty.includes(sourceTileIdx)) {
                  tiles.map[replacingIndex] = sourceTileIdx;
                }
                saveMap();
              }
            }

            if (replaceState.state === 1) {
              replaceState.state = 2;
            }
            if (replaceState.tileIndex !== replacingIndex) {
              if (replaceState.tileIndex !== "") {
                replaceState.state = 1;
              }
              replaceState.tileIndex = replacingIndex;
            }
          }
        }
      } else {
        importBtn.parentElement.style.display = "block";
      }
    }
  }
}

function displayBackground() {
  if (loadedImages["tileset"].bg.type === "color") {
    ctx.fillStyle = loadedImages["tileset"].bg.tile[0].hex;
    ctx.fillRect(0, 0, c.width, c.height);
    return;
  }
  if (loadedImages["tileset"].bg.type === "source") {
    if (!loadedImages["tileset"].bg.image) return;
    for (const tile of tiles.bg) {
      ctx.drawImage(
        loadedImages["tileset"].bg.image,
        loadedImages["tileset"].bg.tile[0].x * loadedImages["tileset"].bg.size,
        loadedImages["tileset"].bg.tile[0].y * loadedImages["tileset"].bg.size,
        loadedImages["tileset"].bg.size,
        loadedImages["tileset"].bg.size,
        tile.desX,
        tile.desY,
        tiles.size,
        tiles.size
      );
    }
    return;
  }
  for (const tile of tiles.bg) {
    ctx.drawImage(
      loadedImages["tileset"].image,
      tile.srcX,
      tile.srcY,
      loadedImages["tileset"].size,
      loadedImages["tileset"].size,
      tile.desX,
      tile.desY,
      tiles.size,
      tiles.size
    );
  }
}

function loadMap() {
  maxCanvasWidth = window.innerWidth;
  maxCanvasHeight = window.innerHeight;
  const savedMap = localStorage.getItem("map");
  if (!savedMap) {
    mapMaxColumn = Math.ceil(window.innerWidth / tiles.size);
    mapMaxRow = Math.ceil(window.innerHeight / tiles.size);
    tiles.map = new Array(mapMaxColumn * mapMaxRow).fill(eraserBrush);
    saveMap();
    return;
  }
  const data = JSON.parse(savedMap);
  mapMaxColumn = data.mapMaxColumn;
  mapMaxRow = data.mapMaxRow;
  tiles.map = data.tiles;
}

function saveMap() {
  const data = {
    mapMaxColumn,
    mapMaxRow,
    tiles: tiles.map,
  };
  localStorage.setItem("map", JSON.stringify(data));
}

function saveStateToUndo() {
  const state = {
    map: [...tiles.map],
    mapMaxColumn,
    mapMaxRow,
  };

  undoStack.push(state);

  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }

  redoStack = [];
}

function undo() {
  if (undoStack.length === 0) return;

  const currentState = {
    map: [...tiles.map],
    mapMaxColumn,
    mapMaxRow,
  };
  redoStack.push(currentState);

  const previousState = undoStack.pop();
  tiles.map = previousState.map;
  mapMaxColumn = previousState.mapMaxColumn;
  mapMaxRow = previousState.mapMaxRow;

  saveMap();
}

function redo() {
  if (redoStack.length === 0) return;

  const currentState = {
    map: [...tiles.map],
    mapMaxColumn,
    mapMaxRow,
  };
  undoStack.push(currentState);

  const nextState = redoStack.pop();
  tiles.map = nextState.map;
  mapMaxColumn = nextState.mapMaxColumn;
  mapMaxRow = nextState.mapMaxRow;

  saveMap();
}

function importMap(file) {
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    mapMaxColumn = data.mapMaxColumn;
    mapMaxRow = data.mapMaxRow;
    tiles.map = data.tiles;
    saveMap();
  };
}

function exportMap() {
  const data = {
    mapMaxColumn,
    mapMaxRow,
    tiles: tiles.map,
  };
  const blob = new Blob([JSON.stringify(data)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "map.json";
  a.click();
  URL.revokeObjectURL(url);
}

function displayGameMap() {
  for (let i = 0; i < tiles.map.length; i++) {
    const tileIndex = tiles.map[i];
    if (tileIndex === eraserBrush) continue;
    const tilesPerRow =
      loadedImages["tileset"].image.width / loadedImages["tileset"].size;
    ctx.drawImage(
      loadedImages["tileset"].image,
      (tileIndex % tilesPerRow) * loadedImages["tileset"].size,
      Math.floor(tileIndex / tilesPerRow) * loadedImages["tileset"].size,
      loadedImages["tileset"].size,
      loadedImages["tileset"].size,
      (i % mapMaxColumn) * tiles.size,
      Math.floor(i / mapMaxColumn) * tiles.size,
      tiles.size,
      tiles.size
    );
  }
}
