import Peer, { DataConnection } from "peerjs";

export interface RoomInfo {
  code: string;
  hostName: string;
  createdAt: number;
}

export interface NetMessage {
  type: string;
  data: unknown;
}

export type NetEventHandler = (msg: NetMessage) => void;

const ROOM_STORAGE_KEY = "mp_rooms_v1";
const ROOM_TTL = 60000; // rooms expire after 60s without refresh

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class NetworkManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private roomCode = "";
  private isHost = false;
  private onMessage: NetEventHandler | null = null;
  private onConnected: (() => void) | null = null;
  private onDisconnected: (() => void) | null = null;
  private onError: ((err: string) => void) | null = null;
  private roomRefreshInterval: number | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  get connected(): boolean { return this.conn !== null && this.conn.open; }
  get hosting(): boolean { return this.isHost; }
  get code(): string { return this.roomCode; }

  setOnMessage(handler: NetEventHandler) { this.onMessage = handler; }
  setOnConnected(handler: () => void) { this.onConnected = handler; }
  setOnDisconnected(handler: () => void) { this.onDisconnected = handler; }
  setOnError(handler: (err: string) => void) { this.onError = handler; }

  async createRoom(hostName: string): Promise<string> {
    this.roomCode = generateRoomCode();
    this.isHost = true;

    return new Promise((resolve, reject) => {
      const peerId = `ss_${this.roomCode}`;
      this.peer = new Peer(peerId, { debug: 0 });

      this.peer.on("open", () => {
        this.publishRoom(hostName);
        this.startRoomRefresh(hostName);
        resolve(this.roomCode);
      });

      this.peer.on("connection", (conn) => {
        this.conn = conn;
        this.setupConnection();
      });

      this.peer.on("error", (err) => {
        if (err.type === "unavailable-id") {
          this.roomCode = generateRoomCode();
          this.peer?.destroy();
          this.createRoom(hostName).then(resolve).catch(reject);
        } else {
          this.onError?.(`Connection error: ${err.type}`);
          reject(err);
        }
      });
    });
  }

  async joinRoom(code: string): Promise<void> {
    this.roomCode = code.toUpperCase();
    this.isHost = false;

    return new Promise((resolve, reject) => {
      this.peer = new Peer({ debug: 0 });

      this.peer.on("open", () => {
        const peerId = `ss_${this.roomCode}`;
        this.conn = this.peer!.connect(peerId, { reliable: true });

        this.conn.on("open", () => {
          this.setupConnection();
          resolve();
        });

        this.conn.on("error", (err) => {
          this.onError?.(`Join failed: ${err}`);
          reject(err);
        });

        setTimeout(() => {
          if (!this.conn?.open) {
            reject(new Error("Connection timeout"));
            this.onError?.("Connection timeout - room may not exist");
          }
        }, 8000);
      });

      this.peer.on("error", (err) => {
        this.onError?.(`Peer error: ${err.type}`);
        reject(err);
      });
    });
  }

  send(msg: NetMessage) {
    if (this.conn?.open) {
      this.conn.send(msg);
    }
  }

  private setupConnection() {
    if (!this.conn) return;

    this.conn.on("data", (data) => {
      this.onMessage?.(data as NetMessage);
    });

    this.conn.on("close", () => {
      this.conn = null;
      this.onDisconnected?.();
    });

    this.conn.on("error", () => {
      this.conn = null;
      this.onDisconnected?.();
    });

    this.onConnected?.();
  }

  destroy() {
    this.stopRoomRefresh();
    this.removeRoom();
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
  }

  // ── Room listing via BroadcastChannel + localStorage ──

  private publishRoom(hostName: string) {
    const rooms = NetworkManager.getAvailableRooms();
    rooms.push({ code: this.roomCode, hostName, createdAt: Date.now() });
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(rooms));
    this.broadcastRoomUpdate();
  }

  private removeRoom() {
    const rooms = NetworkManager.getAvailableRooms().filter(r => r.code !== this.roomCode);
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(rooms));
    this.broadcastRoomUpdate();
  }

  private startRoomRefresh(hostName: string) {
    this.roomRefreshInterval = window.setInterval(() => {
      const rooms = NetworkManager.getAvailableRooms().filter(r => r.code !== this.roomCode);
      rooms.push({ code: this.roomCode, hostName, createdAt: Date.now() });
      localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(rooms));
      this.broadcastRoomUpdate();
    }, 10000);
  }

  private stopRoomRefresh() {
    if (this.roomRefreshInterval !== null) {
      clearInterval(this.roomRefreshInterval);
      this.roomRefreshInterval = null;
    }
  }

  private broadcastRoomUpdate() {
    if (!this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel("ss_rooms");
    }
    this.broadcastChannel.postMessage("update");
  }

  static getAvailableRooms(): RoomInfo[] {
    try {
      const raw = localStorage.getItem(ROOM_STORAGE_KEY);
      if (!raw) return [];
      const rooms: RoomInfo[] = JSON.parse(raw);
      const now = Date.now();
      return rooms.filter(r => now - r.createdAt < ROOM_TTL);
    } catch {
      return [];
    }
  }

  static onRoomListUpdate(callback: () => void): BroadcastChannel {
    const ch = new BroadcastChannel("ss_rooms");
    ch.onmessage = () => callback();
    return ch;
  }
}
