export const DONATE_PACKS = {
  BRONZE: {
    price: 50,
    // ใช้โชว์ใน Ticket/Log
    displayItems: [
      "SCUM$ 10,000",
      "Phoenix Tears x2",
    ],
    // ใช้สำหรับคำสั่งเสก (ถ้าชื่อไอเทมไม่ตรงเซิร์ฟคุณ ให้แก้ id ทางขวา)
    spawnItems: [
      "#spawnitem Cash 1 StackCount 10000",
      "#spawnitem Phoenix_Tears 2",
    ],
    vehicleChoices: [],
    boatChoices: [],
    carInsurance: null,
    boatInsurance: null,
  },

  SILVER: {
    price: 100,
    displayItems: [
      "SCUM$ 25,000",
      "Phoenix Tears x5",
    ],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 25000",
      "#spawnitem Phoenix_Tears 5",
    ],
    vehicleChoices: [],
    boatChoices: [],
    carInsurance: null,
    boatInsurance: null,
  },

  GOLD: {
    price: 200,
    displayItems: [
      "SCUM$ 50,000",
      "Phoenix Tears x13",
      "Bunker Key Card x2",
      "เลือกรถ 1 คัน (Sidecar / RIS)",
      "ประกันรถ 1 ครั้ง (อายุ 7 วัน)",
    ],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 50000",
      "#spawnitem Phoenix_Tears 13",
      "#spawnitem KeyCard 2",
    ],
    vehicleChoices: ["Sidecar", "RIS"],
    boatChoices: [],
    carInsurance: { total: 1, days: 7 },
    boatInsurance: null,
  },

  PLATINUM: {
    price: 350,
    displayItems: [
      "SCUM$ 100,000",
      "Phoenix Tears x26",
      "Screwdriver x5",
      "Lockpick Advanced x5",
      "Bunker Key Card x3",
      "เลือกรถ 1 คัน (Sidecar / RIS / Laika / Wolfs)",
      "ประกันรถ 3 ครั้ง (14 วัน)",
      "เลือกเรือ 1 ลำ (Motorboat)",
      "ประกันเรือ 1 ครั้ง (14 วัน)",
    ],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 100000",
      "#spawnitem Phoenix_Tears 26",
      "#spawnitem Screwdriver 5",
      "#spawnitem Lockpick_Advanced 5",
      "#spawnitem KeyCard 3",
    ],
    vehicleChoices: ["Sidecar", "RIS", "Laika", "Wolfs"],
    boatChoices: ["Motorboat"],
    carInsurance: { total: 3, days: 14 },
    boatInsurance: { total: 1, days: 14 },
  },

  DIAMOND: {
    price: 500,
    displayItems: [
      "SCUM$ 200,000",
      "Phoenix Tears x35",
      "Screwdriver x13",
      "Food & Water Set x10",
      "Lockpick Advanced x13",
      "Bunker Key Card x7",
      "เลือกรถ 1 คัน (Sidecar / RIS / Rager / Laika / Wolfs)",
      "ประกันรถ 5 ครั้ง (30 วัน)",
      "เลือกเรือ 1 ลำ (Motorboat / Dinghy)",
      "ประกันเรือ 3 ครั้ง (30 วัน)",
    ],
    spawnItems: [
      "#spawnitem Cash 1 StackCount 200000",
      "#spawnitem Phoenix_Tears 35",
      "#spawnitem Screwdriver 13",
      "#spawnitem MRE_TunaSalad 10",
      "#spawnitem Energy_Drink_Red_Ghoul 10",
      "#spawnitem Lockpick_Advanced 13",
      "#spawnitem KeyCard 7",
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
  Sidecar: "#spawnvehicle BPC_SidecarBike 1",
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
    days: 30,
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
    days: 30,
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
