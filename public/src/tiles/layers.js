import state from "../state.js";

let layerIdCounter = 0;

const defaultLayerName = (index) => `Layer ${index + 1}`;

const getFillValue = () =>
  typeof state.editing?.eraserBrush === "number"
    ? state.editing.eraserBrush
    : -1;

const getMapSize = () => state.mapMaxColumn * state.mapMaxRow;

function generateLayerId(index = 0) {
  layerIdCounter += 1;
  return `layer-${Date.now()}-${index}-${layerIdCounter}`;
}

function padTilesToSize(sourceTiles = [], targetSize) {
  const fillValue = getFillValue();
  if (targetSize <= 0) return [];
  if (Array.isArray(sourceTiles) && sourceTiles.length === targetSize) {
    return sourceTiles.slice();
  }
  const normalized = new Array(targetSize).fill(fillValue);
  if (Array.isArray(sourceTiles) && sourceTiles.length) {
    const limit = Math.min(targetSize, sourceTiles.length);
    for (let i = 0; i < limit; i++) {
      normalized[i] = sourceTiles[i];
    }
  }
  return normalized;
}

function createEmptyLayer(index) {
  const size = getMapSize();
  return {
    id: generateLayerId(index),
    name: defaultLayerName(index),
    visible: true,
    tiles: new Array(size).fill(getFillValue()),
  };
}

export function initializeLayersFromData(layersData = [], activeIndex = 0) {
  const size = getMapSize();
  const defaultCount = Math.max(state.constants?.DEFAULT_LAYER_COUNT || 1, 1);
  const incomingLayers = Array.isArray(layersData) ? layersData : [];
  const desiredLayerCount = Math.max(defaultCount, incomingLayers.length);

  const normalizedLayers = Array.from(
    { length: desiredLayerCount },
    (_, idx) => {
      const layer = incomingLayers[idx] || createEmptyLayer(idx);
      return {
        id: layer.id || generateLayerId(idx),
        name: layer.name || defaultLayerName(idx),
        visible: layer.visible !== undefined ? layer.visible : true,
        tiles: padTilesToSize(layer.tiles, size),
      };
    },
  );

  state.tiles.layers = normalizedLayers;
  setActiveLayerIndex(
    Math.min(
      Math.max(activeIndex, 0),
      Math.max(normalizedLayers.length - 1, 0),
    ),
  );
}

export function setActiveLayerIndex(index) {
  if (!state.tiles.layers.length) {
    state.editing.activeLayerIndex = 0;
    state.tiles.map = [];
    return;
  }
  const clamped = Math.max(0, Math.min(index, state.tiles.layers.length - 1));
  state.editing.activeLayerIndex = clamped;
  state.tiles.map = state.tiles.layers[clamped].tiles;
}

export function cycleActiveLayer(direction = 1) {
  if (!state.tiles.layers.length) return;
  const total = state.tiles.layers.length;
  const nextIndex =
    (state.editing.activeLayerIndex + direction + total) % total;
  setActiveLayerIndex(nextIndex);
}

export function getActiveLayer() {
  if (!state.tiles.layers.length) return null;
  return state.tiles.layers[state.editing.activeLayerIndex];
}

export function getActiveLayerTiles() {
  const layer = getActiveLayer();
  return layer ? layer.tiles : state.tiles.map;
}

export function resizeLayers(newColumns, newRows) {
  if (!state.tiles.layers.length) return;
  const fillValue = getFillValue();
  const oldColumns = state.mapMaxColumn;
  const oldRows = state.mapMaxRow;
  const newTilesLength = newColumns * newRows;

  state.tiles.layers = state.tiles.layers.map((layer) => {
    const newTiles = new Array(newTilesLength).fill(fillValue);
    const oldTiles = layer.tiles.slice();
    for (let y = 0; y < oldRows; y++) {
      for (let x = 0; x < oldColumns; x++) {
        const newX = x;
        const newY = y;
        if (newX >= newColumns || newY >= newRows) continue;
        const oldIndex = y * oldColumns + x;
        const newIndex = newY * newColumns + newX;
        newTiles[newIndex] = oldTiles[oldIndex];
      }
    }
    return { ...layer, tiles: newTiles };
  });

  setActiveLayerIndex(
    Math.min(state.editing.activeLayerIndex, state.tiles.layers.length - 1),
  );
}

export function cloneLayers(layers = state.tiles.layers) {
  return layers.map((layer) => ({
    ...layer,
    tiles: layer.tiles.slice(),
  }));
}

export function getLayerStatusText() {
  if (!state.tiles.layers.length) return "Layer 0/0";
  return `Layer: ${state.editing.activeLayerIndex + 1}/${
    state.tiles.layers.length
  }`;
}
