import state from "../state.js";

export function loadImages(callback) {
  const images = [
    {
      name: "tileset",
      extension: "png",
      size: 18,
      empty: {
        type: "null",
      },
      paint: {
        tile: [
          {
            x: 2,
            y: 6,
          },
        ],
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
    {
      name: "characters",
      extension: "png",
      size: 24,
      player: [
        {
          index: 0,
          frames: [
            {
              animation: "idle",
              x: 0,
              y: 0,
            },
            {
              animation: "move",
              x: 1,
              y: 0,
            },
          ],
        },
        {
          index: 1,
          frames: [
            {
              animation: "idle",
              x: 2,
              y: 0,
            },
            {
              animation: "move",
              x: 3,
              y: 0,
            },
          ],
        },
        {
          index: 2,
          frames: [
            {
              animation: "idle",
              x: 4,
              y: 0,
            },
            {
              animation: "move",
              x: 5,
              y: 0,
            },
          ],
        },
        {
          index: 3,
          frames: [
            {
              animation: "idle",
              x: 6,
              y: 0,
            },
            {
              animation: "move",
              x: 7,
              y: 0,
            },
          ],
        },
        {
          index: 4,
          frames: [
            {
              animation: "idle",
              x: 0,
              y: 1,
            },
            {
              animation: "move",
              x: 1,
              y: 1,
            },
          ],
        },
      ],
    },
  ];
  let loaded = 0;
  const maxLoad = images.length;
  updateLoadingMessage(loaded, maxLoad);
  images.forEach((data) => {
    const image = new Image();
    image.src = `./images/${data.name}.${data.extension}`;
    image.onload = () => {
      data.image = image;
      state.loadedImages[data.name] = data;
      loaded++;
      updateLoadingMessage(loaded, maxLoad);
      if (loaded === maxLoad) {
        callback();
      }
    };
  });

  function updateLoadingMessage(a, b) {
    state.loadingMessage = `Loading assets: ${(a / b) * 100}%`;
  }
}
