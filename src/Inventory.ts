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

// ─── Inventory UI (responsive, mobile-friendly) ─────────────
// Item type color map for visual distinction
const TYPE_COLORS: Record<string, { bg: number; border: number; icon: string }> = {
  weapon:   { bg: 0x5a4030, border: 0xa07050, icon: "W" },
  ammo:     { bg: 0x4a4a20, border: 0x908830, icon: "A" },
  medical:  { bg: 0x304030, border: 0x50a050, icon: "+" },
  food:     { bg: 0x3a3020, border: 0x907040, icon: "F" },
  material: { bg: 0x303040, border: 0x606080, icon: "M" },
  armor:    { bg: 0x2a3540, border: 0x5080a0, icon: "D" },
};

export class InventoryUI {
  private scene: Phaser.Scene;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private inventory: GridInventory;
  private lootInventory: GridInventory | null = null;
  private isOpen = false;
  private onEquipCallback: ((slot: string, item: InvItem | null) => void) | null = null;
  private equippedItems: Map<string, InvItem> = new Map();
  private pointerHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private hitZones: { x: number; y: number; w: number; h: number; action: () => void }[] = [];

  private equipSlotDefs = [
    { key: "weapon1", label: "WEAPON 1", w: 4, h: 1 },
    { key: "weapon2", label: "WEAPON 2", w: 4, h: 1 },
    { key: "armor",   label: "ARMOR",    w: 2, h: 2 },
  ];

  constructor(scene: Phaser.Scene, inventory: GridInventory) {
    this.scene = scene;
    this.inventory = inventory;
  }

  onEquip(cb: (slot: string, item: InvItem | null) => void) {
    this.onEquipCallback = cb;
  }

  toggle(lootInv?: GridInventory) {
    this.isOpen ? this.close() : this.open(lootInv);
  }

  open(lootInv?: GridInventory) {
    this.lootInventory = lootInv || null;
    this.isOpen = true;
    this.rebuild();
  }

  close() {
    this.isOpen = false;
    this.removePointerHandler();
    for (const obj of this.uiObjects) { if (obj?.active) obj.destroy(); }
    this.uiObjects = [];
    this.hitZones = [];
  }

  getIsOpen() { return this.isOpen; }

  private removePointerHandler() {
    if (this.pointerHandler) {
      this.scene.input.off("pointerdown", this.pointerHandler);
      this.pointerHandler = null;
    }
  }

  private ui<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number, y?: number) => T; setDepth: (d: number) => T }>(obj: T, depth = HUD_DEPTH + 50): T {
    obj.setScrollFactor(0).setDepth(depth);
    this.uiObjects.push(obj);
    return obj;
  }

  private addHitZone(cx: number, cy: number, w: number, h: number, action: () => void) {
    this.hitZones.push({ x: cx - w / 2, y: cy - h / 2, w, h, action });
  }

  private rebuild() {
    for (const obj of this.uiObjects) { if (obj?.active) obj.destroy(); }
    this.uiObjects = [];
    this.hitZones = [];
    this.removePointerHandler();

    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const isLandscape = sw > sh;

    // Dynamic cell size based on screen
    const cellSize = isLandscape
      ? Math.floor(Math.min((sh - 80) / (this.inventory.rows + (this.lootInventory ? 4 : 0)), (sw * 0.45) / this.inventory.cols))
      : Math.floor(Math.min((sw - 20) / this.inventory.cols, (sh - 120) / (this.inventory.rows + 6)));
    const cs = Math.max(28, Math.min(cellSize, 52));

    // Background
    this.ui(this.scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0x0e1210, 0.92));

    // Header bar
    this.ui(this.scene.add.rectangle(sw / 2, 18, sw, 36, 0x1a2018, 0.95), HUD_DEPTH + 51);
    this.ui(this.scene.add.text(sw / 2, 18, "INVENTORY", {
      fontFamily: "monospace", fontSize: "16px", color: "#7a9e5a", fontStyle: "bold",
    }).setOrigin(0.5), HUD_DEPTH + 52);

    // Close button
    const closeCx = sw - 30;
    const closeCy = 18;
    this.ui(this.scene.add.rectangle(closeCx, closeCy, 52, 30, 0x8b3030, 0.8), HUD_DEPTH + 52)
      .setStrokeStyle(1, 0xc04040);
    this.ui(this.scene.add.text(closeCx, closeCy, "X", {
      fontFamily: "monospace", fontSize: "20px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5), HUD_DEPTH + 53);
    this.addHitZone(closeCx, closeCy, 52, 30, () => this.close());

    if (isLandscape) {
      // ── Landscape: equip left, grid center, loot right ──
      const equipX = 10;
      const equipY = 44;
      this.drawEquipSlots(equipX, equipY, cs);

      const invX = equipX + 5 * cs + 14;
      const invY = 44;
      this.drawSectionLabel(invX, invY - 2, "BACKPACK");
      this.drawGrid(invX, invY + 14, this.inventory, "player", cs);

      if (this.lootInventory) {
        const lootX = invX + this.inventory.cols * cs + 14;
        this.drawSectionLabel(lootX, invY - 2, "LOOT");
        this.drawGrid(lootX, invY + 14, this.lootInventory, "loot", cs);
      }
    } else {
      // ── Portrait: equip top, grid middle, loot bottom ──
      const contentX = Math.max(6, (sw - this.inventory.cols * cs) / 2);
      let curY = 42;

      // Equip slots (horizontal row)
      this.drawEquipSlotsHorizontal(contentX, curY, cs);
      curY += 2.5 * cs + 10;

      // Backpack
      this.drawSectionLabel(contentX, curY, "BACKPACK");
      curY += 14;
      this.drawGrid(contentX, curY, this.inventory, "player", cs);
      curY += this.inventory.rows * cs + 8;

      // Loot
      if (this.lootInventory) {
        this.drawSectionLabel(contentX, curY, "LOOT");
        curY += 14;
        this.drawGrid(contentX, curY, this.lootInventory, "loot", cs);
      }
    }

    // Pointer handler
    this.pointerHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.isOpen) return;
      const px = pointer.x;
      const py = pointer.y;
      for (let i = this.hitZones.length - 1; i >= 0; i--) {
        const z = this.hitZones[i];
        if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
          z.action();
          return;
        }
      }
      this.close();
    };
    this.scene.input.on("pointerdown", this.pointerHandler);
  }

  private drawSectionLabel(x: number, y: number, text: string) {
    this.ui(this.scene.add.text(x, y, text, {
      fontFamily: "monospace", fontSize: "10px", color: "#607050", fontStyle: "bold",
    }), HUD_DEPTH + 51);
  }

  private drawEquipSlots(startX: number, startY: number, cs: number) {
    this.drawSectionLabel(startX, startY - 2, "EQUIP");

    let slotY = startY + 14;
    for (const slotDef of this.equipSlotDefs) {
      const slotW = slotDef.w * cs;
      const slotH = slotDef.h * cs;
      const cx = startX + slotW / 2;
      const cy = slotY + slotH / 2;

      // Slot background
      this.ui(this.scene.add.rectangle(cx, cy, slotW - 2, slotH - 2, 0x1a2018, 0.9))
        .setStrokeStyle(1, 0x3a4a30);
      // Slot label
      this.ui(this.scene.add.text(startX + 4, slotY + 2, slotDef.label, {
        fontFamily: "monospace", fontSize: "8px", color: "#4a5a40",
      }));

      const equipped = this.equippedItems.get(slotDef.key);
      if (equipped) {
        this.drawEquippedItem(cx, cy, slotW, slotH, slotDef.key, equipped);
      }
      slotY += slotH + 4;
    }
  }

  private drawEquipSlotsHorizontal(startX: number, startY: number, cs: number) {
    this.drawSectionLabel(startX, startY, "EQUIP");
    let sx = startX;
    const sy = startY + 14;
    for (const slotDef of this.equipSlotDefs) {
      const slotW = slotDef.w * cs;
      const slotH = slotDef.h * cs;
      const cx = sx + slotW / 2;
      const cy = sy + slotH / 2;

      this.ui(this.scene.add.rectangle(cx, cy, slotW - 2, slotH - 2, 0x1a2018, 0.9))
        .setStrokeStyle(1, 0x3a4a30);
      this.ui(this.scene.add.text(sx + 3, sy + 2, slotDef.label, {
        fontFamily: "monospace", fontSize: "7px", color: "#4a5a40",
      }));

      const equipped = this.equippedItems.get(slotDef.key);
      if (equipped) {
        this.drawEquippedItem(cx, cy, slotW, slotH, slotDef.key, equipped);
      }
      sx += slotW + 6;
    }
  }

  private drawEquippedItem(cx: number, cy: number, w: number, h: number, key: string, item: InvItem) {
    const def = ITEM_DEFS[item.defId];
    const tc = TYPE_COLORS[def.type] || TYPE_COLORS.material;
    this.ui(this.scene.add.rectangle(cx, cy, w - 6, h - 6, tc.bg, 0.9), HUD_DEPTH + 51)
      .setStrokeStyle(2, tc.border);
    this.ui(this.scene.add.text(cx, cy, def.name, {
      fontFamily: "monospace", fontSize: "10px", color: "#e0d8c8", fontStyle: "bold",
    }).setOrigin(0.5), HUD_DEPTH + 51);

    const capturedKey = key;
    const capturedItem = item;
    this.addHitZone(cx, cy, w, h, () => {
      this.equippedItems.delete(capturedKey);
      this.inventory.autoAdd(capturedItem.defId, capturedItem.quantity);
      if (this.onEquipCallback) this.onEquipCallback(capturedKey, null);
      this.rebuild();
    });
  }

  private drawGrid(startX: number, startY: number, inv: GridInventory, source: "player" | "loot", cs: number) {
    // Grid background
    const gridW = inv.cols * cs;
    const gridH = inv.rows * cs;
    this.ui(this.scene.add.rectangle(startX + gridW / 2, startY + gridH / 2, gridW + 2, gridH + 2, 0x0a0f0a, 0.5));

    // Cells
    for (let gy = 0; gy < inv.rows; gy++) {
      for (let gx = 0; gx < inv.cols; gx++) {
        const cx = startX + gx * cs + cs / 2;
        const cy = startY + gy * cs + cs / 2;
        this.ui(this.scene.add.rectangle(cx, cy, cs - 2, cs - 2, 0x161e14, 0.9))
          .setStrokeStyle(1, 0x2a3628);
      }
    }

    // Items
    const drawn = new Set<InvItem>();
    for (const item of inv.items) {
      if (drawn.has(item)) continue;
      drawn.add(item);
      const def = ITEM_DEFS[item.defId];
      if (!def || item.gridX < 0) continue;

      const ix = startX + item.gridX * cs;
      const iy = startY + item.gridY * cs;
      const iw = def.width * cs;
      const ih = def.height * cs;
      const cx = ix + iw / 2;
      const cy = iy + ih / 2;

      const tc = TYPE_COLORS[def.type] || TYPE_COLORS.material;

      // Item background
      this.ui(this.scene.add.rectangle(cx, cy, iw - 4, ih - 4, tc.bg, 0.85), HUD_DEPTH + 51)
        .setStrokeStyle(2, tc.border);

      // Type icon (top-left corner)
      this.ui(this.scene.add.text(ix + 4, iy + 2, tc.icon, {
        fontFamily: "monospace", fontSize: "9px", color: "#ffffff",
        backgroundColor: `#${tc.border.toString(16).padStart(6, "0")}`,
        padding: { x: 2, y: 0 },
      }), HUD_DEPTH + 52);

      // Item name (center, larger font)
      const fontSize = iw > cs * 1.5 ? "10px" : "9px";
      this.ui(this.scene.add.text(cx, cy - (def.stackable && item.quantity > 1 ? 4 : 0), def.name, {
        fontFamily: "monospace", fontSize, color: "#e0d8c8", fontStyle: "bold",
      }).setOrigin(0.5), HUD_DEPTH + 52);

      // Quantity badge (bottom-right)
      if (def.stackable && item.quantity > 1) {
        this.ui(this.scene.add.text(ix + iw - 6, iy + ih - 6, `${item.quantity}`, {
          fontFamily: "monospace", fontSize: "10px", color: "#d4a840", fontStyle: "bold",
          backgroundColor: "#00000088",
          padding: { x: 2, y: 0 },
        }).setOrigin(1, 1), HUD_DEPTH + 52);
      }

      // Hit zone
      this.addHitZone(cx, cy, iw, ih, () => {
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
