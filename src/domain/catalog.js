export const DONATE_PACKS = {
  BRONZE: {
    price: 50,
    items: [
      "SCUM$ 10,000",
      "Phoenix Tears x2",
      "Food & Water Set x5",
      "Lockpick Advanced x3",
    ],
    vehicleChoices: [],
    boatChoices: [],
    carInsurance: null,
    boatInsurance: null,
  },
  SILVER: {
    price: 100,
    items: [
      "SCUM$ 25,000",
      "Phoenix Tears x5",
      "Screwdriver x2",
      "Food & Water Set x10",
      "Lockpick Advanced x5",
    ],
    vehicleChoices: [],
    boatChoices: [],
    carInsurance: null,
    boatInsurance: null,
  },
  GOLD: {
    price: 200,
    items: [
      "SCUM$ 50,000",
      "Phoenix Tears x20",
      "Screwdriver x15",
      "Food & Water Set x30",
      "Lockpick Advanced x20",
      "Bunker Key Card x2",
      "เลือกรถ 1 คัน (Sidecar / RIS)",
      "ประกันรถ 1 ครั้ง (อายุ 7 วัน)",
    ],
    vehicleChoices: ["Sidecar", "RIS"],
    boatChoices: [],
    carInsurance: { total: 1, days: 7 },
    boatInsurance: null,
  },
  PLATINUM: {
    price: 350,
    items: [
      "SCUM$ 100,000",
      "Phoenix Tears x30",
      "Screwdriver x30",
      "Food & Water Set x60",
      "Lockpick Advanced x30",
      "Bunker Key Card x5",
      "เลือกรถ 1 คัน (Sidecar / RIS / Laika / Wolfs)",
      "ประกันรถ 3 ครั้ง (14 วัน)",
      "เลือกเรือ 1 คัน (Motorboat)",
      "ประกันเรือ 1 ครั้ง (14 วัน)",
    ],
    vehicleChoices: ["Sidecar", "RIS", "Laika", "Wolfs"],
    boatChoices: ["Motorboat"],
    carInsurance: { total: 3, days: 14 },
    boatInsurance: { total: 1, days: 14 },
  },
  DIAMOND: {
    price: 500,
    items: [
      "SCUM$ 200,000",
      "Phoenix Tears x50",
      "Screwdriver x50",
      "Food & Water Set x100",
      "Lockpick Advanced x50",
      "Bunker Key Card x10",
      "เลือกรถ 1 คัน (Sidecar / RIS / Rager / Laika / Wolfs)",
      "ประกันรถ 5 ครั้ง (30 วัน)",
      "เลือกเรือ 1 คัน (Motorboat / Dinghy)",
      "ประกันเรือ 3 ครั้ง (30 วัน)",
    ],
    vehicleChoices: ["Sidecar", "RIS", "Rager", "Laika", "Wolfs"],
    boatChoices: ["Motorboat", "Dinghy"],
    carInsurance: { total: 5, days: 30 },
    boatInsurance: { total: 3, days: 30 },
  },
};

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

export const VEHICLE_COMMANDS = {
  Sidecar: "#SpawnVehicle BPC_SidecarBike 1",
  RIS: "#spawnvehicle BPC_RIS 1",
  Laika: "#spawnvehicle BPC_Laika 1",
  Wolfs: "#spawnvehicle BPC_WolfsWagen 1",
  Rager: "#spawnvehicle BPC_Rager 1",
  Motorboat: "#spawnvehicle BPC_Barba 1",
  Dinghy: "#spawnvehicle BPC_Dinghy 1",
};

export const VIP_PACKS = {
  BASIC: {
    price: 199,
    days: 30,
    weeklyItems: ["SCUM$ 20,000", "Bunker Key Card x2", "Phoenix Tears x3", "Screwdriver x5"],
    roleKey: "VIP_BASIC_ROLE_ID",
  },
  PRO: {
    price: 300,
    days: 30,
    weeklyItems: ["SCUM$ 30,000", "Bunker Key Card x5", "Phoenix Tears x10", "Screwdriver x20"],
    roleKey: "VIP_PRO_ROLE_ID",
  },
  ELITE: {
    price: 500,
    days: 30,
    weeklyItems: ["SCUM$ 50,000", "Bunker Key Card x10", "Phoenix Tears x25", "Screwdriver x40"],
    roleKey: "VIP_ELITE_ROLE_ID",
  },
};
