// ─── Quest / Task System ─────────────────────────────────────

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: "kill" | "extract" | "collect" | "survive";
  target: number;
  progress: number;
  completed: boolean;
  reward: { xp: number; money: number };
}

export function createStartingQuests(): Quest[] {
  return [
    {
      id: "q_kill_5",
      title: "Pest Control",
      description: "Kill 5 enemies in a single raid",
      type: "kill",
      target: 5,
      progress: 0,
      completed: false,
      reward: { xp: 50, money: 200 },
    },
    {
      id: "q_extract_1",
      title: "First Extraction",
      description: "Successfully extract from a raid",
      type: "extract",
      target: 1,
      progress: 0,
      completed: false,
      reward: { xp: 30, money: 100 },
    },
    {
      id: "q_kill_15",
      title: "Veteran",
      description: "Kill 15 enemies total",
      type: "kill",
      target: 15,
      progress: 0,
      completed: false,
      reward: { xp: 100, money: 500 },
    },
    {
      id: "q_extract_5",
      title: "Survivor",
      description: "Extract 5 times",
      type: "extract",
      target: 5,
      progress: 0,
      completed: false,
      reward: { xp: 200, money: 1000 },
    },
  ];
}

export function updateQuestProgress(
  quests: Quest[],
  event: "kill" | "extract",
  amount = 1
): Quest[] {
  const completed: Quest[] = [];
  for (const q of quests) {
    if (q.completed) continue;
    if (q.type === event) {
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) {
        q.completed = true;
        completed.push(q);
      }
    }
  }
  return completed;
}
