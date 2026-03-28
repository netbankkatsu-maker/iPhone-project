import Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { RaidScene } from "./RaidScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: document.body,
    width: "100%",
    height: "100%",
  },
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BaseScene, RaidScene],
  input: {
    activePointers: 3,
  },
};

new Phaser.Game(config);

// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/iPhone-project/sw.js")
      .catch((err) => console.warn("SW registration failed:", err));
  });
}
