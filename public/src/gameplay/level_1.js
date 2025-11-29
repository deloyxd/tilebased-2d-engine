import state from "../state.js";

const SIGN_TEXT = {
  17: {
    19: "Welcome to <fun>Island Venture</fun>! It seems you know how to move around and interact with objects already! Your goal? Simple. You just have to escape this island <bloody>ALIVE</bloody>. Goodluck!",
  },
};

function getAllTilesFromMap() {
  const allTiles = [];
  if (!state.tiles.layers.length || !state.mapMaxColumn || !state.mapMaxRow) {
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
        allTiles.push({
          col,
          row,
          tileIndex,
        });
      }
    }
  }

  return allTiles;
}

export default {
  getAllTiles: getAllTilesFromMap,
  tiles: [
    {
      col: 17,
      row: 19,
      onTouch: (tileData) => {
        if (!state.gameplay.interaction) {
          state.gameplay.interaction = {
            activeSign: null,
            isTextModalOpen: false,
          };
        }

        const text =
          SIGN_TEXT[tileData.col]?.[tileData.row] ||
          "The sign doesn't have any text yet.";

        state.gameplay.interaction.activeSign = {
          col: tileData.col,
          row: tileData.row,
          text,
        };
      },
    },
  ],
  onTileTouch: (tileData) => {
    console.log("Level 1: Global tile touch handler", tileData);
  },
};
