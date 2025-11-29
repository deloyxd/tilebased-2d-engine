import state from "../state.js";
import { getPlayerTilePositionPublic } from "../gameplay/levels.js";

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

function renderGameText(container, text) {
  container.innerHTML = "";

  const TAGS = {
    fun: { open: "<fun>", close: "</fun>" },
    bloody: { open: "<bloody>", close: "</bloody>" },
  };

  let i = 0;
  let mode = null;
  let buffer = "";

  function flushBuffer() {
    if (!buffer) return;

    if (!mode) {
      // Plain text: preserve new lines.
      const parts = buffer.split("\n");
      parts.forEach((part, index) => {
        if (part) {
          container.appendChild(document.createTextNode(part));
        }
        if (index < parts.length - 1) {
          container.appendChild(document.createElement("br"));
        }
      });
    } else if (mode === "fun" || mode === "bloody") {
      const groupSpan = document.createElement("span");
      const textToRender = buffer;
      let letterIndex = 0;

      for (const ch of textToRender) {
        if (ch === "\n") {
          groupSpan.appendChild(document.createElement("br"));
          continue;
        }
        if (ch === " ") {
          groupSpan.appendChild(document.createTextNode(" "));
          continue;
        }
        const letterSpan = document.createElement("span");
        letterSpan.textContent = ch;
        if (mode === "fun") {
          letterSpan.classList.add("game-text-fun-letter");
          letterSpan.style.animationDelay = `${letterIndex * 0.08}s`;
        } else if (mode === "bloody") {
          letterSpan.classList.add("game-text-bloody-letter");
        }
        groupSpan.appendChild(letterSpan);
        letterIndex++;
      }

      container.appendChild(groupSpan);
    }

    buffer = "";
  }

  while (i < text.length) {
    const remaining = text.slice(i);
    if (remaining.startsWith(TAGS.fun.open)) {
      flushBuffer();
      mode = "fun";
      i += TAGS.fun.open.length;
      continue;
    }
    if (remaining.startsWith(TAGS.fun.close)) {
      flushBuffer();
      mode = null;
      i += TAGS.fun.close.length;
      continue;
    }
    if (remaining.startsWith(TAGS.bloody.open)) {
      flushBuffer();
      mode = "bloody";
      i += TAGS.bloody.open.length;
      continue;
    }
    if (remaining.startsWith(TAGS.bloody.close)) {
      flushBuffer();
      mode = null;
      i += TAGS.bloody.close.length;
      continue;
    }

    buffer += text[i];
    i++;
  }

  flushBuffer();
}

function showGameTextModal(text) {
  const modal = state.dom.gameTextModal;
  const content = state.dom.gameTextModalContent;
  if (!modal || !content) return;

  renderGameText(content, text || "");
  modal.style.display = "flex";

  if (!state.gameplay.interaction) {
    state.gameplay.interaction = {
      activeSign: null,
      isTextModalOpen: false,
    };
  }
  state.gameplay.interaction.isTextModalOpen = true;
}

function hideGameTextModal() {
  const modal = state.dom.gameTextModal;
  if (!modal) return;

  modal.style.display = "none";

  if (!state.gameplay.interaction) return;
  state.gameplay.interaction.isTextModalOpen = false;
}

function handleKeyDown(event) {
  if (!state.gameplay.isPlaying) return;

  if (event.code === "KeyE") {
    event.preventDefault();

    const interaction = state.gameplay.interaction;
    if (!interaction) return;

    // If a text modal is already open, close it on E press.
    if (interaction.isTextModalOpen) {
      hideGameTextModal();
      return;
    }

    // Otherwise, only open the modal if the player is standing on the active sign tile.
    if (!interaction.activeSign) return;

    const tileSize = state.tiles.size || 1;
    const playerTilePos = getPlayerTilePositionPublic(tileSize);

    if (
      playerTilePos.col === interaction.activeSign.col &&
      playerTilePos.row === interaction.activeSign.row
    ) {
      showGameTextModal(interaction.activeSign.text || "");
    }

    return;
  }

  const mapped = KEY_MAP[event.code];
  if (!mapped) return;
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
