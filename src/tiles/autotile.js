import state from "../state.js";
import { getActiveLayerTiles } from "../tiles/layers.js";

// Autotile groups configuration
// Each group defines the tile indices for all 16 possible combinations
const autotileGroups = {
  // Tree leaves autotile group
  leaves: {
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
  },
  // Ground tiles autotile group
  ground: {
    0: 0, // isolated tile
    1: 161, // N
    2: 1, // E
    3: 162, // NE
    4: 23, // S
    5: 138, // NS
    6: 24, // ES
    7: 139, // NES
    8: 3, // W
    9: 164, // NW
    10: 2, // EW
    11: 163, // NEW
    12: 26, // SW
    13: 141, // NSW
    14: 25, // ESW
    15: 140, // full
  },
};

// Create Sets of all autotile variant indices for each group for quick lookup
// Filter out -1 (placeholder/empty values) to avoid conflicts
const autotileGroupSets = {};
Object.keys(autotileGroups).forEach((groupName) => {
  const variants = autotileGroups[groupName];
  const validIndices = Object.values(variants).filter((idx) => idx !== -1);
  autotileGroupSets[groupName] = new Set(validIndices);
});

export function placeTileAt(mapIdx, tileIdx) {
  const activeLayerTiles = getActiveLayerTiles();
  activeLayerTiles[mapIdx] = tileIdx;

  if (isAutotileGroup(tileIdx)) {
    updateAutotile(mapIdx);
  }

  const x = mapIdx % state.mapMaxColumn;
  const y = Math.floor(mapIdx / state.mapMaxColumn);
  const neighbors = [
    [x, y - 1],
    [x + 1, y],
    [x, y + 1],
    [x - 1, y],
  ];

  neighbors.forEach(([nx, ny]) => {
    if (isValidCoordinate(nx, ny)) {
      const index = ny * state.mapMaxColumn + nx;
      const neighborTile = getTileByIndex(index);
      if (isAutotileGroup(neighborTile)) {
        updateAutotile(index);
      }
    }
  });
}

function updateAutotile(mapIdx) {
  const tileIdx = getTileByIndex(mapIdx);

  const groupName = getAutotileGroup(tileIdx);
  if (!groupName) {
    return;
  }

  const mask = getAutotileMask(mapIdx, groupName);
  const activeLayerTiles = getActiveLayerTiles();
  const variants = autotileGroups[groupName];
  activeLayerTiles[mapIdx] = variants[mask];
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
  return getAutotileGroup(tileIdx) !== null;
}

function getAutotileGroup(tileIdx) {
  if (tileIdx === undefined || tileIdx === null) {
    return null;
  }

  for (const [groupName, variantSet] of Object.entries(autotileGroupSets)) {
    if (variantSet.has(tileIdx)) {
      return groupName;
    }
  }
  return null;
}

function getAutotileMask(mapIdx, groupName) {
  let mask = 0;

  const x = mapIdx % state.mapMaxColumn;
  const y = Math.floor(mapIdx / state.mapMaxColumn);

  const northTile = getTileByXY(x, y - 1);
  const eastTile = getTileByXY(x + 1, y);
  const southTile = getTileByXY(x, y + 1);
  const westTile = getTileByXY(x - 1, y);

  if (getAutotileGroup(northTile) === groupName) mask |= 1; // N
  if (getAutotileGroup(eastTile) === groupName) mask |= 2; // E
  if (getAutotileGroup(southTile) === groupName) mask |= 4; // S
  if (getAutotileGroup(westTile) === groupName) mask |= 8; // W

  return mask;
}
