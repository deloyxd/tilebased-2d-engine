import state from "../state.js";
import { getActiveLayerTiles } from "../tiles/layers.js";

const autotileVariants = {
  0: 123, // isolated tile
  1: 168, // N
  2: 169, // E
  3: 165, // NE
  4: 122, // S
  5: 145, // NS
  6: 119, // ES
  7: 142, // NES
  8: 170, // W
  9: 167, // NW
  10: 146, // EW
  11: 166, // NEW
  12: 121, // SW
  13: 144, // NSW
  14: 120, // ESW
  15: 143, // full
};

// Create a Set of all autotile variant indices for quick lookup
const autotileVariantSet = new Set(Object.values(autotileVariants));

export function placeTileAt(mapIdx, tileIdx) {
  const activeLayerTiles = getActiveLayerTiles();
  activeLayerTiles[mapIdx] = tileIdx;

  // Only update autotile if the placed tile is part of the autotile group
  if (isAutotileGroup(tileIdx)) {
    updateAutotile(mapIdx);
  }

  // Update neighbors that are part of the autotile group
  const x = mapIdx % state.mapMaxColumn;
  const y = Math.floor(mapIdx / state.mapMaxColumn);
  const neighbors = [
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];

  neighbors.forEach(([nx, ny]) => {
    // Check bounds before accessing
    if (isValidCoordinate(nx, ny)) {
      const index = ny * state.mapMaxColumn + nx;
      const neighborTile = getTileByIndex(index);
      // Update neighbor if it's part of the autotile group
      if (isAutotileGroup(neighborTile)) {
        updateAutotile(index);
      }
    }
  });
}

function updateAutotile(mapIdx) {
  const tileIdx = getTileByIndex(mapIdx);

  // Only update if the tile is part of the autotile group
  if (!isAutotileGroup(tileIdx)) {
    return;
  }

  const mask = getAutotileMask(mapIdx);
  const activeLayerTiles = getActiveLayerTiles();
  activeLayerTiles[mapIdx] = autotileVariants[mask];
}

function getTileByIndex(index) {
  const tiles = getActiveLayerTiles();
  if (index < 0 || index >= tiles.length) {
    return undefined;
  }
  return tiles[index];
}

function getTileByXY(x, y) {
  if (!isValidCoordinate(x, y)) {
    return undefined;
  }
  const index = y * state.mapMaxColumn + x;
  return getTileByIndex(index);
}

function isValidCoordinate(x, y) {
  return x >= 0 && x < state.mapMaxColumn && y >= 0 && y < state.mapMaxRow;
}

function isAutotileGroup(tileIdx) {
  return autotileVariantSet.has(tileIdx);
}

function getAutotileMask(mapIdx) {
  let mask = 0;

  const x = mapIdx % state.mapMaxColumn;
  const y = Math.floor(mapIdx / state.mapMaxColumn);

  // Check each neighbor - if it's part of the autotile group, set the corresponding bit
  const northTile = getTileByXY(x, y - 1);
  const eastTile = getTileByXY(x + 1, y);
  const southTile = getTileByXY(x, y + 1);
  const westTile = getTileByXY(x - 1, y);

  if (isAutotileGroup(northTile)) mask |= 1; // N
  if (isAutotileGroup(eastTile)) mask |= 2; // E
  if (isAutotileGroup(southTile)) mask |= 4; // S
  if (isAutotileGroup(westTile)) mask |= 8; // W

  return mask;
}
