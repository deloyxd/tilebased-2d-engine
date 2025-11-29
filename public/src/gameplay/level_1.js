import state from "../state.js";
import { getTileTypeLabel } from "../tiles/types.js";

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
        console.log("Lever activated at", tileData.col, tileData.row);
      }
    }
  }
};

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
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow) {
    state.gameplay.collectibles.diamondsTotal = 0;
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

        allTiles.push({
          col,
          row,
          tileIndex
        });
      }
    }
  }

  state.gameplay.collectibles.diamondsTotal = diamondsTotal;

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

    console.log("Level 1: Global tile touch handler", tileData);
  },
  activateLever: activateLever
};
