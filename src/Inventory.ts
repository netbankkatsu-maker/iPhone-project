import Phaser from "phaser";
import { HUD_DEPTH, WeaponType, WEAPONS } from "./constants";

// ─── Item Definitions ────────────────────────────────────────
export interface ItemDef {
  id: string;
  name: string;
  width: number;  // grid cells
  height: number;
  color: number;
  stackable: boolean;
  maxStack: number;
  type: "weapon" | "ammo" | "medical" | "food" | "material" | "armor";
  weaponType?: WeaponType;
  healAmount?: number;
  armorValue?: number;
}

export const ITEM_DEFS: Record<string, ItemDef> = {
  pistol: { id: "pistol", name: "Pistol", width: 2, height: 1, color: 0xffeb3b, stackable: false, maxStack: 1, type: "weapon", weaponType: "pistol" },
  smg: { id: "smg", name: "SMG", width: 3, height: 1, color: 0xff9800, stackable: false, maxStack: 1, type: "weapon", weaponType: "smg" },
  shotgun: { id: "shotgun", name: "Shotgun", width: 3, height: 1, color: 0xff5722, stackable: false, maxStack: 1, type: "weapon", weaponType: "shotgun" },
  rifle: { id: "rifle", name: "Rifle", width: 4, height: 1, color: 0x4caf50, stackable: false, maxStack: 1, type: "weapon", weaponType: "rifle" },
  ammo_pistol: { id: "ammo_pistol", name: "9mm Ammo", width: 1, height: 1, color: 0xfdd835, stackable: true, maxStack: 60, type: "ammo" },
  ammo_rifle: { id: "ammo_rifle", name: "7.62 Ammo", width: 1, height: 1, color: 0x8bc34a, stackable: true, maxStack: 40, type: "ammo" },
  ammo_shotgun: { id: "ammo_shotgun", name: "12ga Shells", width: 1, height: 1, color: 0xff7043, stackable: true, maxStack: 24, type: "ammo" },
  bandage: { id: "bandage", name: "Bandage", width: 1, height: 1, color: 0xeeeeee, stackable: true, maxStack: 5, type: "medical", healAmount: 20 },
  medkit: { id: "medkit", name: "Medkit", width: 2, height: 1, color: 0xef5350, stackable: false, maxStack: 1, type: "medical", healAmount: 50 },
  painkiller: { id: "painkiller", name: "Painkiller", width: 1, height: 1, color: 0xce93d8, stackable: true, maxStack: 3, type: "medical", healAmount: 15 },
  canned_food: { id: "canned_food", name: "Canned Food", width: 1, height: 1, color: 0xa1887f, stackable: true, maxStack: 3, type: "food" },
  water: { id: "water", name: "Water", width: 1, height: 1, color: 0x4fc3f7, stackable: true, maxStack: 3, type: "food" },
  scrap_metal: { id: "scrap_metal", name: "Scrap Metal", width: 1, height: 1, color: 0x78909c, stackable: true, maxStack: 10, type: "material" },
  armor_light: { id: "armor_light", name: "Light Armor", width: 2, height: 2, color: 0x546e7a, stackable: false, maxStack: 1, type: "armor", armorValue: 15 },
  armor_heavy: { id: "armor_heavy", name: "Heavy Armor", width: 2, height: 2, color: 0x37474f, stackable: false, maxStack: 1, type: "armor", armorValue: 30 },
};

// ─── Inventory Item Instance ─────────────────────────────────
export interface InvItem {
  defId: string;
  quantity: number;
  gridX: number;  // position in grid (-1 if not placed)
  gridY: number;
}

// ─── Grid Inventory ──────────────────────────────────────────
export class GridInventory {
  readonly cols: number;
  readonly rows: number;
  items: InvItem[] = [];
  private grid: (InvItem | null)[][];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  canPlace(item: InvItem, gx: number, gy: number): boolean {
    const def = ITEM_DEFS[item.defId];
    if (!def) return false;
    if (gx < 0 || gy < 0 || gx + def.width > this.cols || gy + def.height > this.rows) return false;
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        const cell = this.grid[gy + dy][gx + dx];
        if (cell && cell !== item) return false;
      }
    }
    return true;
  }

  place(item: InvItem, gx: number, gy: number): boolean {
    if (!this.canPlace(item, gx, gy)) return false;
    // Remove from old position
    this.removeFromGrid(item);
    const def = ITEM_DEFS[item.defId];
    item.gridX = gx;
    item.gridY = gy;
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        this.grid[gy + dy][gx + dx] = item;
      }
    }
    if (!this.items.includes(item)) this.items.push(item);
    return true;
  }

  removeFromGrid(item: InvItem) {
    if (item.gridX < 0 || item.gridY < 0) return;
    const def = ITEM_DEFS[item.defId];
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        const cy = item.gridY + dy;
        const cx = item.gridX + dx;
        if (cy < this.rows && cx < this.cols && this.grid[cy][cx] === item) {
          this.grid[cy][cx] = null;
        }
      }
    }
  }

  removeItem(item: InvItem) {
    this.removeFromGrid(item);
    this.items = this.items.filter((i) => i !== item);
    item.gridX = -1;
    item.gridY = -1;
  }

  autoAdd(defId: string, quantity = 1): boolean {
    const def = ITEM_DEFS[defId];
    if (!def) return false;

    // Try stacking first
    if (def.stackable) {
      for (const existing of this.items) {
        if (existing.defId === defId && existing.quantity < def.maxStack) {
          const canAdd = Math.min(quantity, def.maxStack - existing.quantity);
          existing.quantity += canAdd;
          quantity -= canAdd;
          if (quantity <= 0) return true;
        }
      }
    }

    // Find empty spot
    while (quantity > 0) {
      const spot = this.findEmptySpot(def.width, def.height);
      if (!spot) return false;
      const newItem: InvItem = {
        defId,
        quantity: Math.min(quantity, def.maxStack),
        gridX: -1,
        gridY: -1,
      };
      this.place(newItem, spot.x, spot.y);
      quantity -= newItem.quantity;
    }
    return true;
  }

  private findEmptySpot(w: number, h: number): { x: number; y: number } | null {
    for (let gy = 0; gy <= this.rows - h; gy++) {
      for (let gx = 0; gx <= this.cols - w; gx++) {
        let fits = true;
        outer: for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (this.grid[gy + dy][gx + dx]) { fits = false; break outer; }
          }
        }
        if (fits) return { x: gx, y: gy };
      }
    }
    return null;
  }

  hasItem(defId: string): InvItem | null {
    return this.items.find((i) => i.defId === defId) || null;
  }

  countItem(defId: string): number {
    return this.items
      .filter((i) => i.defId === defId)
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  consumeItem(defId: string, amount = 1): boolean {
    let remaining = amount;
    for (const item of [...this.items]) {
      if (item.defId !== defId) continue;
      if (item.quantity <= remaining) {
        remaining -= item.quantity;
        this.removeItem(item);
      } else {
        item.quantity -= remaining;
        remaining = 0;
      }
      if (remaining <= 0) return true;
    }
    return remaining <= 0;
  }
}

// ─── Inventory UI (Tetris-style overlay) ─────────────────────
const CELL_SIZE = 36;
const GRID_PAD = 8;

export class InventoryUI {
  private scene: Phaser.Scene;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private inventory: GridInventory;
  private lootInventory: GridInventory | null = null;
  private isOpen = false;
  private onEquipCallback: ((slot: string, item: InvItem | null) => void) | null = null;
  private equippedItems: Map<string, InvItem> = new Map();

  // Equipment slots layout
  private equipSlotDefs = [
    { key: "weapon1", label: "Weapon 1", x: 0, y: 0, w: 4, h: 1 },
    { key: "weapon2", label: "Weapon 2", x: 0, y: 1.3, w: 4, h: 1 },
    { key: "armor", label: "Armor", x: 0, y: 2.6, w: 2, h: 2 },
  ];

  constructor(scene: Phaser.Scene, inventory: GridInventory) {
    this.scene = scene;
    this.inventory = inventory;
  }

  onEquip(cb: (slot: string, item: InvItem | null) => void) {
    this.onEquipCallback = cb;
  }

  toggle(lootInv?: GridInventory) {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(lootInv);
    }
  }

  open(lootInv?: GridInventory) {
    this.lootInventory = lootInv || null;
    this.isOpen = true;
    this.rebuild();
  }

  close() {
    this.isOpen = false;
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];
  }

  getIsOpen() { return this.isOpen; }

  /** Helper: add a game object to the scene, set scrollFactor(0), track for cleanup */
  private ui<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number, y?: number) => T; setDepth: (d: number) => T }>(obj: T): T {
    obj.setScrollFactor(0).setDepth(HUD_DEPTH + 50);
    this.uiObjects.push(obj);
    return obj;
  }

  private rebuild() {
    // Destroy old UI
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];

    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    // Background - tap to close
    const bg = this.ui(this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0x000000, 0.85));
    bg.setInteractive();
    bg.on("pointerdown", () => this.close());

    // Title
    this.ui(this.scene.add.text(sw / 2, 12, "INVENTORY", {
      fontFamily: "monospace", fontSize: "14px", color: "#7a9e5a",
    }).setOrigin(0.5, 0));

    // Calculate layout
    const invH = this.inventory.rows * CELL_SIZE;

    // Equipment slots (left side)
    const equipX = GRID_PAD;
    const equipY = 35;
    this.drawEquipSlots(equipX, equipY);

    // Player inventory grid (center)
    const invX = equipX + 5 * CELL_SIZE + GRID_PAD;
    const invY = 35;
    this.drawGrid(invX, invY, this.inventory, "player");

    // Loot grid (below)
    if (this.lootInventory) {
      this.ui(this.scene.add.text(invX, invY + invH + 8, "LOOT", {
        fontFamily: "monospace", fontSize: "11px", color: "#b08030",
      }));
      const lootY = invY + invH + 24;
      this.drawGrid(invX, lootY, this.lootInventory, "loot");
    }

    // Close button (large tap target) - top-right X
    const closeBg = this.ui(this.scene.add.rectangle(sw - 28, 22, 48, 36, 0xc04040, 0.6));
    closeBg.setStrokeStyle(1, 0xc04040);
    closeBg.setInteractive();
    closeBg.setDepth(HUD_DEPTH + 52);
    this.ui(this.scene.add.text(sw - 28, 22, "X", {
      fontFamily: "monospace", fontSize: "18px", color: "#ffffff",
    }).setOrigin(0.5)).setDepth(HUD_DEPTH + 53);
    closeBg.on("pointerdown", () => this.close());
  }

  private drawEquipSlots(startX: number, startY: number) {
    this.ui(this.scene.add.text(startX, startY - 2, "EQUIP", {
      fontFamily: "monospace", fontSize: "10px", color: "#888888",
    }));

    for (const slotDef of this.equipSlotDefs) {
      const sx = startX + slotDef.x * CELL_SIZE;
      const sy = startY + 14 + slotDef.y * CELL_SIZE;
      const slotW = slotDef.w * CELL_SIZE;
      const slotH = slotDef.h * CELL_SIZE;

      const slotBg = this.ui(this.scene.add.rectangle(sx + slotW / 2, sy + slotH / 2, slotW - 2, slotH - 2, 0x222233, 0.8));
      slotBg.setStrokeStyle(1, 0x444455);
      slotBg.setInteractive();

      this.ui(this.scene.add.text(sx + 2, sy + 2, slotDef.label, {
        fontFamily: "monospace", fontSize: "7px", color: "#555566",
      }));

      // Show equipped item
      const equipped = this.equippedItems.get(slotDef.key);
      if (equipped) {
        const def = ITEM_DEFS[equipped.defId];
        this.ui(this.scene.add.rectangle(sx + slotW / 2, sy + slotH / 2, slotW - 6, slotH - 6, def.color, 0.7));
        this.ui(this.scene.add.text(sx + slotW / 2, sy + slotH / 2, def.name, {
          fontFamily: "monospace", fontSize: "8px", color: "#ffffff",
        }).setOrigin(0.5));

        // Tap to unequip
        slotBg.on("pointerdown", () => {
          this.equippedItems.delete(slotDef.key);
          this.inventory.autoAdd(equipped.defId, equipped.quantity);
          if (this.onEquipCallback) this.onEquipCallback(slotDef.key, null);
          this.rebuild();
        });
      }
    }
  }

  private drawGrid(
    startX: number,
    startY: number,
    inv: GridInventory,
    source: "player" | "loot"
  ) {
    // Grid cells
    for (let gy = 0; gy < inv.rows; gy++) {
      for (let gx = 0; gx < inv.cols; gx++) {
        const cx = startX + gx * CELL_SIZE + CELL_SIZE / 2;
        const cy = startY + gy * CELL_SIZE + CELL_SIZE / 2;
        const cell = this.ui(this.scene.add.rectangle(cx, cy, CELL_SIZE - 2, CELL_SIZE - 2, 0x1a1a2e, 0.8));
        cell.setStrokeStyle(1, 0x333355);
      }
    }

    // Draw items
    const drawn = new Set<InvItem>();
    for (const item of inv.items) {
      if (drawn.has(item)) continue;
      drawn.add(item);
      const def = ITEM_DEFS[item.defId];
      if (!def || item.gridX < 0) continue;

      const ix = startX + item.gridX * CELL_SIZE;
      const iy = startY + item.gridY * CELL_SIZE;
      const iw = def.width * CELL_SIZE;
      const ih = def.height * CELL_SIZE;

      const itemRect = this.ui(this.scene.add.rectangle(ix + iw / 2, iy + ih / 2, iw - 4, ih - 4, def.color, 0.6));
      itemRect.setStrokeStyle(1, 0xffffff, 0.3);
      itemRect.setInteractive();
      itemRect.setDepth(HUD_DEPTH + 51);

      this.ui(this.scene.add.text(ix + iw / 2, iy + ih / 2 - 5, def.name, {
        fontFamily: "monospace", fontSize: "7px", color: "#ffffff",
      }).setOrigin(0.5)).setDepth(HUD_DEPTH + 51);

      if (def.stackable && item.quantity > 1) {
        this.ui(this.scene.add.text(ix + iw / 2, iy + ih / 2 + 6, `x${item.quantity}`, {
          fontFamily: "monospace", fontSize: "8px", color: "#d4a840",
        }).setOrigin(0.5)).setDepth(HUD_DEPTH + 51);
      }

      // Tap to interact
      itemRect.on("pointerdown", () => {
        this.onItemTap(item, source, inv);
      });
    }
  }

  private onItemTap(item: InvItem, source: "player" | "loot", inv: GridInventory) {
    const def = ITEM_DEFS[item.defId];

    if (source === "loot" && this.lootInventory) {
      // Move from loot to player inventory
      if (this.inventory.autoAdd(item.defId, item.quantity)) {
        this.lootInventory.removeItem(item);
        this.rebuild();
      }
      return;
    }

    // Player inventory tap
    if (def.type === "weapon") {
      // Equip to weapon slot
      const slot = !this.equippedItems.has("weapon1") ? "weapon1" : "weapon2";
      this.equippedItems.set(slot, item);
      inv.removeItem(item);
      if (this.onEquipCallback) this.onEquipCallback(slot, item);
      this.rebuild();
    } else if (def.type === "armor") {
      this.equippedItems.set("armor", item);
      inv.removeItem(item);
      if (this.onEquipCallback) this.onEquipCallback("armor", item);
      this.rebuild();
    } else if (def.type === "medical") {
      // Use medical item - signal via callback
      if (this.onEquipCallback) this.onEquipCallback("use_medical", item);
      item.quantity--;
      if (item.quantity <= 0) inv.removeItem(item);
      this.rebuild();
    } else if (source === "player" && this.lootInventory) {
      // Move to loot (drop)
      if (this.lootInventory.autoAdd(item.defId, item.quantity)) {
        inv.removeItem(item);
        this.rebuild();
      }
    }
  }

  equipItem(slot: string, item: InvItem) {
    this.equippedItems.set(slot, item);
  }

  getEquipped(slot: string): InvItem | null {
    return this.equippedItems.get(slot) || null;
  }
}
