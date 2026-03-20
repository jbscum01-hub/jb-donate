export const BOOSTS = {
  ELITE_OPERATOR: {
    price: 399,
    title: "⭐ Elite Operator",
    effects: [
      "STR +2 / CON +2 / DEX +2 / INT +2",
      "SkillLevel +1",
      "Fame +500",
    ],
    oncePerIgn: true,
  },
};

export const VIP_PACKS = {
  BASIC: {
    price: 199,
    days: 999,
    roleKey: "VIP_BASIC_ROLE_ID",
    displayItems: ["SCUM$ 20,000", "Bunker Key Card x2", "Phoenix Tears x3", "Screwdriver x5"],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 20000",
      "#spawnitem KeyCard 2",
      "#spawnitem Phoenix_Tears 3",
      "#spawnitem Screwdriver 5",
    ],
  },
  PRO: {
    price: 300,
    days: 999,
    roleKey: "VIP_PRO_ROLE_ID",
    displayItems: ["SCUM$ 30,000", "Bunker Key Card x5", "Phoenix Tears x10", "Screwdriver x20"],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 30000",
      "#spawnitem KeyCard 5",
      "#spawnitem Phoenix_Tears 10",
      "#spawnitem Screwdriver 20",
    ],
  },
  ELITE: {
    price: 500,
    days: 999,
    roleKey: "VIP_ELITE_ROLE_ID",
    displayItems: ["SCUM$ 50,000", "Bunker Key Card x10", "Phoenix Tears x25", "Screwdriver x40"],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 50000",
      "#spawnitem KeyCard 10",
      "#spawnitem Phoenix_Tears 25",
      "#spawnitem Screwdriver 40",
    ],
  },
};
