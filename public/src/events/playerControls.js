import state from "../state.js";

const KEY_MAP = {
  ArrowLeft: ["left"],
  KeyA: ["left"],
  ArrowRight: ["right"],
  KeyD: ["right"],
  ArrowUp: ["up", "jump"],
  KeyW: ["up", "jump"],
  ArrowDown: ["down"],
  KeyS: ["down"],
  Space: ["jump"],
};

export function registerPlayerControls() {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
}

function handleKeyDown(event) {
  const mapped = KEY_MAP[event.code];
  if (!mapped) return;
  if (!state.gameplay.isPlaying) return;
  event.preventDefault();
  const actions = Array.isArray(mapped) ? mapped : [mapped];
  actions.forEach((action) => {
    state.gameplay.input[action] = true;
  });
}

function handleKeyUp(event) {
  const mapped = KEY_MAP[event.code];
  if (!mapped) return;
  if (!state.gameplay.isPlaying) return;
  event.preventDefault();
  const actions = Array.isArray(mapped) ? mapped : [mapped];
  actions.forEach((action) => {
    state.gameplay.input[action] = false;
  });
}
