import state from "../state.js";
import { getActiveLayerTiles } from "../tiles/layers.js";

// Helper to build autotile group variants from a base group
function createAutotileGroup(baseVariants = {}, overrides = {}) {
  return { ...baseVariants, ...overrides };
}

// Autotile groups configuration
// Each group defines the tile indices for all 16 possible combinations
const baseGroundVariants = {
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
};

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
  // Ground tiles autotile group (grass surface)
  groundGrass: baseGroundVariants,
  groundSnow: createAutotileGroup(baseGroundVariants, {
    0: 92, // isolated tile
    2: 93, // E
    4: 115, // S
    6: 116, // ES
    8: 95, // W
    10: 94, // EW
    12: 118, // SW
    14: 117, // ESW
  }),
  groundDirt: createAutotileGroup(baseGroundVariants, {
    0: 46, // isolated tile
    2: 47, // E
    4: 69, // S
    6: 70, // ES
    8: 49, // W
    10: 48, // EW
    12: 72, // SW
    14: 71, // ESW
  }),
};

// Create Sets of all autotile variant indices for each group for quick lookup
// Filter out -1 (placeholder/empty values) to avoid conflicts
const autotileGroupSets = {};
Object.keys(autotileGroups).forEach((groupName) => {
  const variants = autotileGroups[groupName];
  const validIndices = Object.values(variants).filter((idx) => idx !== -1);
  autotileGroupSets[groupName] = new Set(validIndices);
});

// Track per-layer autotile group assignments so we remember which surface was painted.
const layerGroupAssignments = new WeakMap();

function getActiveLayerAssignments() {
  const tiles = getActiveLayerTiles();
  let assignments = layerGroupAssignments.get(tiles);
  if (!assignments || assignments.length !== tiles.length) {
    assignments = new Array(tiles.length).fill(null);
    layerGroupAssignments.set(tiles, assignments);
  }
  return assignments;
}

function setTileGroupAssignment(mapIdx, groupName) {
  const assignments = getActiveLayerAssignments();
  assignments[mapIdx] = groupName;
}

function getTileGroupAssignment(mapIdx) {
  const assignments = getActiveLayerAssignments();
  return assignments[mapIdx] || null;
}

export function placeTileAt(mapIdx, tileIdx) {
  const activeLayerTiles = getActiveLayerTiles();
  activeLayerTiles[mapIdx] = tileIdx;

  if (!state.editing.isAutotilingEnabled) return;

  const groupName = getAutotileGroup(tileIdx);
  if (groupName) {
    setTileGroupAssignment(mapIdx, groupName);
    updateAutotile(mapIdx);
  } else {
    setTileGroupAssignment(mapIdx, null);
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
    if (!isValidCoordinate(nx, ny)) return;
    const index = ny * state.mapMaxColumn + nx;
    const neighborTile = getTileByIndex(index);
    if (isAutotileNeighbor(index, neighborTile, groupName)) {
      updateAutotile(index);
    }
  });
}

function updateAutotile(mapIdx) {
  const tileIdx = getTileByIndex(mapIdx);

  const groupName = getTileGroup(mapIdx, tileIdx);
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

function isAutotileNeighbor(mapIdx, tileIdx, referenceGroup) {
  const neighborGroup = getTileGroup(mapIdx, tileIdx);
  return neighborGroup && neighborGroup === referenceGroup;
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

function getTileGroup(mapIdx, tileIdx) {
  const assignment = getTileGroupAssignment(mapIdx);
  if (assignment) {
    return assignment;
  }
  const detectedGroup = getAutotileGroup(tileIdx);
  if (detectedGroup) {
    setTileGroupAssignment(mapIdx, detectedGroup);
  }
  return detectedGroup;
}

function getAutotileMask(mapIdx, groupName) {
  let mask = 0;

  const x = mapIdx % state.mapMaxColumn;
  const y = Math.floor(mapIdx / state.mapMaxColumn);

  const northTile = getTileByXY(x, y - 1);
  const eastTile = getTileByXY(x + 1, y);
  const southTile = getTileByXY(x, y + 1);
  const westTile = getTileByXY(x - 1, y);

  if (
    isAutotileNeighbor((y - 1) * state.mapMaxColumn + x, northTile, groupName)
  )
    mask |= 1; // N
  if (isAutotileNeighbor(y * state.mapMaxColumn + (x + 1), eastTile, groupName))
    mask |= 2; // E
  if (
    isAutotileNeighbor((y + 1) * state.mapMaxColumn + x, southTile, groupName)
  )
    mask |= 4; // S
  if (isAutotileNeighbor(y * state.mapMaxColumn + (x - 1), westTile, groupName))
    mask |= 8; // W

  return mask;
}
