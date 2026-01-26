# SCUM Donate + VIP + Insurance Bot (Discord)

Node.js + discord.js v14 + PostgreSQL/Supabase + Render

This repo is a ready-to-deploy **starter** implementing the architecture and file layout we designed:
- Donate Shop -> Ticket workflow
- Staff panel in ticket: **APPROVE / GEN / SET PLATE / CLOSE / CANCEL**
- **Vehicle Card** posted/edited in Plate Log channel (ทะเบียนรวม) with **USE CAR/BOAT INSURANCE**
- VIP scheduled job (every 6 hours) - summary-only (no console commands sent to users)
- Admin dashboard placeholders

> You still need to fill in some server-specific IDs in `.env` and adjust catalog as needed.

---

## Requirements
- Node.js 20+
- A Discord bot application with intents enabled:
  - Server Members Intent (for role sync, optional)
- PostgreSQL database (Supabase recommended)

---

## 1) Setup
```bash
npm install
cp .env.example .env
```

Fill `.env` with your values.

---

## 2) Database
Use the SQL in:
- `supabase/migrations/0001_init_drop_create.sql` (drop + create)
- `supabase/migrations/0002_add_vehicle_card_message_id.sql` (adds `plate_card_message_id` column)

---

## 3) Run locally
```bash
npm run dev
```

---

## 4) One-time: Post shop panel
```bash
npm run post:shop
```

---

## 5) Render deployment
- Web service command: `npm start`
- Scheduled job (every 6 hours): `node src/jobs/vipTick.js`

Optional: use `render.yaml` as a blueprint.

---

## Notes
- This starter uses **message component interactions** (selects/buttons/modals).
- Staff permissions are enforced using `ADMIN_ROLE_ID`.
- Plate is **6 digits** and **unique**.
- Insurance is **per plate** (per vehicle), not per user.

---

## Folder map (high level)
- `src/discord/handlers/*` : interaction handlers
- `src/discord/panels/*`   : embed/component builders (Shop / Staff / Vehicle Card)
- `src/db/repo/*`          : database access layer
- `src/jobs/*`             : scheduled tasks

