import state from "../state.js";

const KEY_MAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
};

export function registerPlayerControls() {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
}

function handleKeyDown(event) {
  const action = KEY_MAP[event.code];
  if (!action) return;
  if (!state.gameplay.isPlaying) return;
  event.preventDefault();
  state.gameplay.input[action] = true;
}

function handleKeyUp(event) {
  const action = KEY_MAP[event.code];
  if (!action) return;
  if (!state.gameplay.isPlaying) return;
  event.preventDefault();
  state.gameplay.input[action] = false;
}
