import Phaser from "phaser";
import { HUD_DEPTH } from "./constants";
import { NetworkManager, RoomInfo } from "./Network";
import { PlayerStash, createDefaultStash } from "./BaseScene";

export class LobbyScene extends Phaser.Scene {
  private net!: NetworkManager;
  private stash: PlayerStash = createDefaultStash();
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private hitZones: { x: number; y: number; w: number; h: number; action: () => void }[] = [];
  private pointerHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private refreshTimer: Phaser.Time.TimerEvent | null = null;
  private state: "menu" | "hosting" | "joining" | "connected" = "menu";
  private codeInput = "";
  private statusText: Phaser.GameObjects.Text | null = null;
  private roomListTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("LobbyScene");
  }

  init(data?: { stash?: PlayerStash }) {
    if (data?.stash) this.stash = data.stash;
  }

  create() {
    this.net = new NetworkManager();
    this.state = "menu";
    this.codeInput = "";
    this.drawMenu();

    this.net.setOnConnected(() => {
      this.state = "connected";
      this.drawConnected();
    });

    this.net.setOnDisconnected(() => {
      this.state = "menu";
      this.drawMenu();
    });

    this.net.setOnError((err) => {
      if (this.statusText) this.statusText.setText(err);
    });
  }

  shutdown() {
    this.cleanup();
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
    if (this.refreshTimer) this.refreshTimer.destroy();
  }

  private cleanup() {
    if (this.pointerHandler) {
      this.input.off("pointerdown", this.pointerHandler);
      this.pointerHandler = null;
    }
    for (const obj of this.uiObjects) { if (obj?.active) obj.destroy(); }
    this.uiObjects = [];
    this.hitZones = [];
    this.roomListTexts = [];
  }

  private ui<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => T; setDepth: (d: number) => T }>(obj: T, depth = HUD_DEPTH): T {
    obj.setScrollFactor(0).setDepth(depth);
    this.uiObjects.push(obj);
    return obj;
  }

  private addHit(cx: number, cy: number, w: number, h: number, action: () => void) {
    this.hitZones.push({ x: cx, y: cy, w, h, action });
  }

  private setupPointer() {
    this.pointerHandler = (pointer: Phaser.Input.Pointer) => {
      for (let i = this.hitZones.length - 1; i >= 0; i--) {
        const z = this.hitZones[i];
        if (pointer.x >= z.x - z.w / 2 && pointer.x <= z.x + z.w / 2 &&
            pointer.y >= z.y - z.h / 2 && pointer.y <= z.y + z.h / 2) {
          z.action();
          return;
        }
      }
    };
    this.input.on("pointerdown", this.pointerHandler);
  }

  // ────────────────────────────────────────────────────────────
  // Main Menu
  // ────────────────────────────────────────────────────────────

  private drawMenu() {
    this.cleanup();
    const sw = this.scale.width;
    const sh = this.scale.height;

    // Background
    this.ui(this.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0a0e06));

    // Title
    this.ui(this.add.text(sw / 2, 40, "MULTIPLAYER", {
      fontFamily: "monospace", fontSize: "20px", color: "#8ab060", fontStyle: "bold",
    }).setOrigin(0.5));

    // Back button
    this.ui(this.add.rectangle(50, 40, 70, 30, 0x2a3a22, 0.9).setStrokeStyle(1, 0x5a7a4a));
    this.ui(this.add.text(50, 40, "BACK", {
      fontFamily: "monospace", fontSize: "12px", color: "#8ab060",
    }).setOrigin(0.5));
    this.addHit(50, 40, 70, 30, () => {
      this.net.destroy();
      this.scene.start("BaseScene", { stash: this.stash });
    });

    let y = 90;

    // ── Create Room Button ──
    this.ui(this.add.rectangle(sw / 2, y, sw - 40, 50, 0x3a5a2a, 0.9).setStrokeStyle(2, 0x5c8a3c));
    this.ui(this.add.text(sw / 2, y, "CREATE ROOM", {
      fontFamily: "monospace", fontSize: "16px", color: "#c8dca8", fontStyle: "bold",
    }).setOrigin(0.5));
    this.addHit(sw / 2, y, sw - 40, 50, () => this.onCreateRoom());

    y += 66;

    // ── Join by Code section ──
    this.ui(this.add.rectangle(sw / 2, y, sw - 40, 1, 0x2a3a22, 0.5));
    y += 16;
    this.ui(this.add.text(sw / 2, y, "JOIN BY INVITE CODE", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a7a5a",
    }).setOrigin(0.5));
    y += 24;

    // Code input field
    const inputW = sw - 80;
    this.ui(this.add.rectangle(sw / 2, y, inputW, 40, 0x1a2418, 0.9).setStrokeStyle(1, 0x3a5a2a));
    const inputText = this.ui(this.add.text(sw / 2, y, this.codeInput || "Tap to enter code", {
      fontFamily: "monospace", fontSize: "16px", color: this.codeInput ? "#e0dcc8" : "#4a5a3a",
    }).setOrigin(0.5));
    this.addHit(sw / 2, y, inputW, 40, () => {
      const code = prompt("Enter room code:");
      if (code && code.trim().length > 0) {
        this.codeInput = code.trim().toUpperCase();
        inputText.setText(this.codeInput);
        inputText.setColor("#e0dcc8");
      }
    });

    y += 36;

    // Join button
    this.ui(this.add.rectangle(sw / 2, y, 120, 36, 0x2a4a5a, 0.9).setStrokeStyle(1, 0x4090b0));
    this.ui(this.add.text(sw / 2, y, "JOIN", {
      fontFamily: "monospace", fontSize: "14px", color: "#80c0e0", fontStyle: "bold",
    }).setOrigin(0.5));
    this.addHit(sw / 2, y, 120, 36, () => {
      if (this.codeInput.length >= 4) this.onJoinRoom(this.codeInput);
    });

    y += 50;

    // ── Room List ──
    this.ui(this.add.rectangle(sw / 2, y, sw - 40, 1, 0x2a3a22, 0.5));
    y += 16;
    this.ui(this.add.text(sw / 2, y, "AVAILABLE ROOMS", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a7a5a",
    }).setOrigin(0.5));
    y += 20;

    this.drawRoomList(y);

    // Auto-refresh rooms
    this.startRoomRefresh(y);

    this.setupPointer();
  }

  private drawRoomList(startY: number) {
    const sw = this.scale.width;
    // Clear old room texts
    for (const t of this.roomListTexts) { if (t?.active) t.destroy(); }
    this.roomListTexts = [];

    const rooms = NetworkManager.getAvailableRooms();
    // Remove hit zones for old room entries (keep other zones)
    this.hitZones = this.hitZones.filter(z => !(z.y > startY - 10));

    if (rooms.length === 0) {
      const t = this.ui(this.add.text(sw / 2, startY + 20, "No rooms found\nWaiting...", {
        fontFamily: "monospace", fontSize: "11px", color: "#4a5a3a", align: "center",
      }).setOrigin(0.5));
      this.roomListTexts.push(t);
      return;
    }

    let ry = startY;
    for (const room of rooms) {
      const rowY = ry + 18;
      const bg = this.ui(this.add.rectangle(sw / 2, rowY, sw - 50, 34, 0x1a2a18, 0.9).setStrokeStyle(1, 0x3a5a2a));
      this.roomListTexts.push(bg as unknown as Phaser.GameObjects.Text);

      const nameT = this.ui(this.add.text(35, rowY, `${room.hostName}`, {
        fontFamily: "monospace", fontSize: "12px", color: "#c8dca8", fontStyle: "bold",
      }).setOrigin(0, 0.5));
      this.roomListTexts.push(nameT);

      const codeT = this.ui(this.add.text(sw - 35, rowY, room.code, {
        fontFamily: "monospace", fontSize: "11px", color: "#6a9a5a",
      }).setOrigin(1, 0.5));
      this.roomListTexts.push(codeT);

      const capturedCode = room.code;
      this.addHit(sw / 2, rowY, sw - 50, 34, () => this.onJoinRoom(capturedCode));

      ry += 40;
    }
  }

  private startRoomRefresh(listY: number) {
    // BroadcastChannel for instant updates
    if (this.broadcastChannel) this.broadcastChannel.close();
    this.broadcastChannel = NetworkManager.onRoomListUpdate(() => {
      if (this.state === "menu") this.drawRoomList(listY);
    });

    // Fallback polling every 3s
    if (this.refreshTimer) this.refreshTimer.destroy();
    this.refreshTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        if (this.state === "menu") this.drawRoomList(listY);
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Hosting state
  // ────────────────────────────────────────────────────────────

  private async onCreateRoom() {
    this.state = "hosting";
    this.cleanup();

    const sw = this.scale.width;
    const sh = this.scale.height;

    this.ui(this.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0a0e06));
    this.ui(this.add.text(sw / 2, 40, "CREATING ROOM...", {
      fontFamily: "monospace", fontSize: "16px", color: "#8ab060", fontStyle: "bold",
    }).setOrigin(0.5));

    this.setupPointer();

    try {
      const code = await this.net.createRoom("Player");
      this.drawHosting(code);
    } catch (err) {
      this.state = "menu";
      this.drawMenu();
    }
  }

  private drawHosting(code: string) {
    this.cleanup();
    const sw = this.scale.width;
    const sh = this.scale.height;

    this.ui(this.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0a0e06));

    this.ui(this.add.text(sw / 2, 50, "WAITING FOR PLAYER...", {
      fontFamily: "monospace", fontSize: "14px", color: "#8ab060", fontStyle: "bold",
    }).setOrigin(0.5));

    // Room code display (large)
    this.ui(this.add.text(sw / 2, sh / 2 - 50, "INVITE CODE", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a7a5a",
    }).setOrigin(0.5));

    this.ui(this.add.rectangle(sw / 2, sh / 2, sw - 60, 70, 0x1a2a18, 0.95).setStrokeStyle(2, 0x5c8a3c));
    this.ui(this.add.text(sw / 2, sh / 2, code, {
      fontFamily: "monospace", fontSize: "36px", color: "#c8dca8", fontStyle: "bold",
    }).setOrigin(0.5));

    this.ui(this.add.text(sw / 2, sh / 2 + 50, "Share this code with your friend", {
      fontFamily: "monospace", fontSize: "9px", color: "#5a6a4a",
    }).setOrigin(0.5));

    // Waiting animation
    const dots = this.ui(this.add.text(sw / 2, sh / 2 + 80, "...", {
      fontFamily: "monospace", fontSize: "20px", color: "#3a5a2a",
    }).setOrigin(0.5));
    this.tweens.add({ targets: dots, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });

    this.statusText = this.ui(this.add.text(sw / 2, sh - 80, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#c04040",
    }).setOrigin(0.5));

    // Cancel button
    this.ui(this.add.rectangle(sw / 2, sh - 40, 120, 36, 0x5a2a2a, 0.9).setStrokeStyle(1, 0xc04040));
    this.ui(this.add.text(sw / 2, sh - 40, "CANCEL", {
      fontFamily: "monospace", fontSize: "13px", color: "#ff8080", fontStyle: "bold",
    }).setOrigin(0.5));
    this.addHit(sw / 2, sh - 40, 120, 36, () => {
      this.net.destroy();
      this.state = "menu";
      this.drawMenu();
    });

    this.setupPointer();
  }

  // ────────────────────────────────────────────────────────────
  // Joining state
  // ────────────────────────────────────────────────────────────

  private async onJoinRoom(code: string) {
    this.state = "joining";
    this.cleanup();

    const sw = this.scale.width;
    const sh = this.scale.height;

    this.ui(this.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0a0e06));
    this.ui(this.add.text(sw / 2, sh / 2, `Joining ${code}...`, {
      fontFamily: "monospace", fontSize: "14px", color: "#80c0e0", fontStyle: "bold",
    }).setOrigin(0.5));

    this.statusText = this.ui(this.add.text(sw / 2, sh / 2 + 30, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#c04040",
    }).setOrigin(0.5));

    // Cancel
    this.ui(this.add.rectangle(sw / 2, sh - 40, 120, 36, 0x5a2a2a, 0.9).setStrokeStyle(1, 0xc04040));
    this.ui(this.add.text(sw / 2, sh - 40, "CANCEL", {
      fontFamily: "monospace", fontSize: "13px", color: "#ff8080", fontStyle: "bold",
    }).setOrigin(0.5));
    this.addHit(sw / 2, sh - 40, 120, 36, () => {
      this.net.destroy();
      this.state = "menu";
      this.drawMenu();
    });

    this.setupPointer();

    try {
      await this.net.joinRoom(code);
    } catch {
      if (this.statusText?.active) {
        this.statusText.setText("Failed to join. Room may not exist.");
      }
      this.time.delayedCall(2000, () => {
        if (this.state === "joining") {
          this.state = "menu";
          this.drawMenu();
        }
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Connected - start game
  // ────────────────────────────────────────────────────────────

  private drawConnected() {
    this.cleanup();
    const sw = this.scale.width;
    const sh = this.scale.height;

    this.ui(this.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0a0e06));
    this.ui(this.add.text(sw / 2, sh / 2 - 20, "CONNECTED!", {
      fontFamily: "monospace", fontSize: "20px", color: "#5c8a3c", fontStyle: "bold",
    }).setOrigin(0.5));
    this.ui(this.add.text(sw / 2, sh / 2 + 10, "Starting raid...", {
      fontFamily: "monospace", fontSize: "12px", color: "#6a7a5a",
    }).setOrigin(0.5));

    this.setupPointer();

    // Start multiplayer raid after short delay
    this.time.delayedCall(1500, () => {
      this.scene.start("MultiRaidScene", {
        stash: this.stash,
        net: this.net,
        isHost: this.net.hosting,
      });
    });
  }
}
