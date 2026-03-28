// ─── Survival Status System ──────────────────────────────────
// Hunger, thirst, radiation, bleeding, broken bones

export interface StatusEffects {
  bleeding: boolean;
  bleedRate: number;    // HP/s lost
  fracture: boolean;    // reduces move speed
  radiation: number;    // 0-100, damages HP when high
}

export interface SurvivalStats {
  hunger: number;       // 0-100, 0 = starving
  thirst: number;       // 0-100, 0 = dehydrated
  stamina: number;      // 0-100
  effects: StatusEffects;
}

export function createSurvivalStats(): SurvivalStats {
  return {
    hunger: 80,
    thirst: 80,
    stamina: 100,
    effects: {
      bleeding: false,
      bleedRate: 0,
      fracture: false,
      radiation: 0,
    },
  };
}

// Called every frame
export function updateSurvival(
  stats: SurvivalStats,
  deltaSec: number,
  isMoving: boolean,
  isSprinting: boolean
): { hpDrain: number; speedMult: number } {
  let hpDrain = 0;
  let speedMult = 1;

  // Hunger decays over time
  const hungerRate = isMoving ? 0.4 : 0.2; // per second
  stats.hunger = Math.max(0, stats.hunger - hungerRate * deltaSec);

  // Thirst decays faster
  const thirstRate = isMoving ? 0.6 : 0.3;
  stats.thirst = Math.max(0, stats.thirst - thirstRate * deltaSec);

  // Starving = HP drain
  if (stats.hunger <= 0) {
    hpDrain += 2 * deltaSec;
  } else if (stats.hunger < 20) {
    speedMult *= 0.85;
  }

  // Dehydrated = HP drain (faster)
  if (stats.thirst <= 0) {
    hpDrain += 3 * deltaSec;
  } else if (stats.thirst < 20) {
    speedMult *= 0.8;
  }

  // Bleeding
  if (stats.effects.bleeding) {
    hpDrain += stats.effects.bleedRate * deltaSec;
  }

  // Fracture slows player
  if (stats.effects.fracture) {
    speedMult *= 0.5;
  }

  // Radiation damage when high
  if (stats.effects.radiation > 50) {
    hpDrain += ((stats.effects.radiation - 50) / 50) * 4 * deltaSec;
  }
  // Radiation slowly decays
  stats.effects.radiation = Math.max(
    0,
    stats.effects.radiation - 0.1 * deltaSec
  );

  // Stamina
  if (isSprinting && isMoving) {
    stats.stamina = Math.max(0, stats.stamina - 20 * deltaSec);
    if (stats.stamina <= 0) speedMult *= 0.6;
  } else {
    stats.stamina = Math.min(100, stats.stamina + 10 * deltaSec);
  }

  return { hpDrain, speedMult };
}

// Apply food/water/medical effects
export function applyItem(
  stats: SurvivalStats,
  itemId: string
): number {
  // Returns HP healed
  switch (itemId) {
    case "bandage":
      stats.effects.bleeding = false;
      stats.effects.bleedRate = 0;
      return 20;
    case "medkit":
      stats.effects.bleeding = false;
      stats.effects.bleedRate = 0;
      stats.effects.fracture = false;
      return 50;
    case "painkiller":
      stats.effects.fracture = false;
      return 15;
    case "canned_food":
      stats.hunger = Math.min(100, stats.hunger + 35);
      return 0;
    case "water":
      stats.thirst = Math.min(100, stats.thirst + 40);
      return 0;
    default:
      return 0;
  }
}

// Chance to cause status effects on taking damage
export function onDamageTaken(
  stats: SurvivalStats,
  damage: number
) {
  // Higher damage = more likely to bleed
  if (damage >= 10 && Math.random() < 0.3) {
    stats.effects.bleeding = true;
    stats.effects.bleedRate = Math.min(5, stats.effects.bleedRate + damage * 0.1);
  }
  // Heavy hits can fracture
  if (damage >= 20 && Math.random() < 0.15) {
    stats.effects.fracture = true;
  }
}

// Enter radiation zone
export function addRadiation(stats: SurvivalStats, amount: number) {
  stats.effects.radiation = Math.min(100, stats.effects.radiation + amount);
}
