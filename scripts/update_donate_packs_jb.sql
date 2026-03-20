BEGIN;

-- J&B Donate pack update

UPDATE public.tb_donate_pack_master
SET pack_name = CASE pack_code
    WHEN 'BRONZE' THEN 'BRONZE'
    WHEN 'SILVER' THEN 'SILVER'
    WHEN 'GOLD' THEN 'GOLD'
    WHEN 'PLATINUM' THEN 'PLATINUM'
    WHEN 'DIAMOND' THEN 'DIAMOND'
    ELSE pack_name
  END,
  price = CASE pack_code
    WHEN 'BRONZE' THEN 50
    WHEN 'SILVER' THEN 100
    WHEN 'GOLD' THEN 200
    WHEN 'PLATINUM' THEN 350
    WHEN 'DIAMOND' THEN 500
    ELSE price
  END,
  sort_order = CASE pack_code
    WHEN 'BRONZE' THEN 1
    WHEN 'SILVER' THEN 2
    WHEN 'GOLD' THEN 3
    WHEN 'PLATINUM' THEN 4
    WHEN 'DIAMOND' THEN 5
    ELSE sort_order
  END,
  allow_vehicle_select = CASE pack_code
    WHEN 'GOLD' THEN true
    WHEN 'PLATINUM' THEN true
    WHEN 'DIAMOND' THEN true
    ELSE false
  END,
  allow_boat_select = CASE pack_code
    WHEN 'PLATINUM' THEN true
    WHEN 'DIAMOND' THEN true
    ELSE false
  END,
  car_insurance_total = CASE pack_code
    WHEN 'GOLD' THEN 1
    WHEN 'PLATINUM' THEN 3
    WHEN 'DIAMOND' THEN 5
    ELSE 0
  END,
  car_insurance_days = 0,
  boat_insurance_total = CASE pack_code
    WHEN 'PLATINUM' THEN 1
    WHEN 'DIAMOND' THEN 3
    ELSE 0
  END,
  boat_insurance_days = 0,
  updated_at = now(),
  updated_by = 'CHATGPT'
WHERE pack_code IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND');

DELETE FROM public.tb_donate_pack_master_item
WHERE pack_id IN (SELECT pack_id FROM public.tb_donate_pack_master WHERE pack_code IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND'));

INSERT INTO public.tb_donate_pack_master_item
(pack_id, item_code, item_name, quantity, item_group, sort_order, is_active, created_at, updated_at)
SELECT p.pack_id, x.item_code, x.item_name, x.quantity, x.item_group, x.sort_order, true, now(), now()
FROM public.tb_donate_pack_master p
JOIN (
  SELECT 'BRONZE' pack_code, 'SCUM_MONEY' item_code, 'SCUM$' item_name, 10000 quantity, 'CURRENCY' item_group, 1 sort_order
  UNION ALL SELECT 'SILVER','SCUM_MONEY','SCUM$',25000,'CURRENCY',1
  UNION ALL SELECT 'SILVER','PHOENIX_TEARS','Phoenix Tears',1,'ITEM',2
  UNION ALL SELECT 'GOLD','SCUM_MONEY','SCUM$',50000,'CURRENCY',1
  UNION ALL SELECT 'GOLD','PHOENIX_TEARS','Phoenix Tears',3,'ITEM',2
  UNION ALL SELECT 'GOLD','BUNKER_KEYCARD','Bunker Key Card',1,'ITEM',3
  UNION ALL SELECT 'PLATINUM','SCUM_MONEY','SCUM$',100000,'CURRENCY',1
  UNION ALL SELECT 'PLATINUM','PHOENIX_TEARS','Phoenix Tears',7,'ITEM',2
  UNION ALL SELECT 'PLATINUM','SCREWDRIVER','Screwdriver',5,'ITEM',3
  UNION ALL SELECT 'PLATINUM','LOCKPICK_ADVANCED','Lockpick Advanced',5,'ITEM',4
  UNION ALL SELECT 'PLATINUM','BUNKER_KEYCARD','Bunker Key Card',3,'ITEM',5
  UNION ALL SELECT 'DIAMOND','SCUM_MONEY','SCUM$',200000,'CURRENCY',1
  UNION ALL SELECT 'DIAMOND','PHOENIX_TEARS','Phoenix Tears',10,'ITEM',2
  UNION ALL SELECT 'DIAMOND','SCREWDRIVER','Screwdriver',13,'ITEM',3
  UNION ALL SELECT 'DIAMOND','FOOD_WATER_SET','Food & Water Set',10,'ITEM',4
  UNION ALL SELECT 'DIAMOND','LOCKPICK_ADVANCED','Lockpick Advanced',13,'ITEM',5
  UNION ALL SELECT 'DIAMOND','BUNKER_KEYCARD','Bunker Key Card',7,'ITEM',6
) x ON x.pack_code = p.pack_code;

DELETE FROM public.tb_donate_pack_master_vehicle
WHERE pack_id IN (SELECT pack_id FROM public.tb_donate_pack_master WHERE pack_code IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND'));

INSERT INTO public.tb_donate_pack_master_vehicle
(pack_id, vehicle_code, vehicle_name, vehicle_model, vehicle_kind, insurance_total, insurance_days, sort_order, is_active, created_at, updated_at)
SELECT p.pack_id, x.vehicle_code, x.vehicle_name, x.vehicle_model, x.vehicle_kind, x.insurance_total, 0, x.sort_order, true, now(), now()
FROM public.tb_donate_pack_master p
JOIN (
  SELECT 'GOLD' pack_code, 'SIDECAR' vehicle_code, 'Sidecar' vehicle_name, 'Sidecar' vehicle_model, 'CAR' vehicle_kind, 1 insurance_total, 1 sort_order
  UNION ALL SELECT 'GOLD','RIS','RIS','RIS','CAR',1,2
  UNION ALL SELECT 'PLATINUM','SIDECAR','Sidecar','Sidecar','CAR',3,1
  UNION ALL SELECT 'PLATINUM','RIS','RIS','RIS','CAR',3,2
  UNION ALL SELECT 'PLATINUM','LAIKA','Laika','Laika','CAR',3,3
  UNION ALL SELECT 'PLATINUM','WOLFS','Wolfs','Wolfs','CAR',3,4
  UNION ALL SELECT 'DIAMOND','SIDECAR','Sidecar','Sidecar','CAR',5,1
  UNION ALL SELECT 'DIAMOND','RIS','RIS','RIS','CAR',5,2
  UNION ALL SELECT 'DIAMOND','RAGER','Rager','Rager','CAR',5,3
  UNION ALL SELECT 'DIAMOND','LAIKA','Laika','Laika','CAR',5,4
  UNION ALL SELECT 'DIAMOND','WOLFS','Wolfs','Wolfs','CAR',5,5
) x ON x.pack_code = p.pack_code;

DELETE FROM public.tb_donate_pack_master_boat
WHERE pack_id IN (SELECT pack_id FROM public.tb_donate_pack_master WHERE pack_code IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND'));

INSERT INTO public.tb_donate_pack_master_boat
(pack_id, boat_code, boat_name, boat_model, insurance_total, insurance_days, sort_order, is_active, created_at, updated_at)
SELECT p.pack_id, x.boat_code, x.boat_name, x.boat_model, x.insurance_total, 0, x.sort_order, true, now(), now()
FROM public.tb_donate_pack_master p
JOIN (
  SELECT 'PLATINUM' pack_code, 'MOTORBOAT' boat_code, 'Motorboat' boat_name, 'Motorboat' boat_model, 1 insurance_total, 1 sort_order
  UNION ALL SELECT 'DIAMOND','MOTORBOAT','Motorboat','Motorboat',3,1
  UNION ALL SELECT 'DIAMOND','DINGHY','Dinghy','Dinghy',3,2
) x ON x.pack_code = p.pack_code;

DELETE FROM public.tb_donate_pack_master_benefit
WHERE pack_id IN (SELECT pack_id FROM public.tb_donate_pack_master WHERE pack_code IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND'));

INSERT INTO public.tb_donate_pack_master_benefit
(pack_id, benefit_text, sort_order, is_active, created_at, updated_at)
SELECT p.pack_id, x.benefit_text, x.sort_order, true, now(), now()
FROM public.tb_donate_pack_master p
JOIN (
  SELECT 'BRONZE' pack_code, 'SCUM$ 10,000' benefit_text, 1 sort_order
  UNION ALL SELECT 'SILVER','SCUM$ 25,000',1
  UNION ALL SELECT 'SILVER','Phoenix Tears x1',2
  UNION ALL SELECT 'GOLD','SCUM$ 50,000',1
  UNION ALL SELECT 'GOLD','Phoenix Tears x3',2
  UNION ALL SELECT 'GOLD','Bunker Key Card x1',3
  UNION ALL SELECT 'GOLD','เลือกรถ 1 คัน (Sidecar / RIS) + ประกัน 1 ครั้ง',4
  UNION ALL SELECT 'PLATINUM','SCUM$ 100,000',1
  UNION ALL SELECT 'PLATINUM','Phoenix Tears x7',2
  UNION ALL SELECT 'PLATINUM','Screwdriver x5',3
  UNION ALL SELECT 'PLATINUM','Lockpick Advanced x5',4
  UNION ALL SELECT 'PLATINUM','Bunker Key Card x3',5
  UNION ALL SELECT 'PLATINUM','เลือกรถ 1 คัน (Sidecar / RIS / Laika / Wolfs) + ประกัน 3 ครั้ง',6
  UNION ALL SELECT 'PLATINUM','เลือกเรือ 1 คัน (Motorboat) + ประกัน 1 ครั้ง',7
  UNION ALL SELECT 'DIAMOND','SCUM$ 200,000',1
  UNION ALL SELECT 'DIAMOND','Phoenix Tears x10',2
  UNION ALL SELECT 'DIAMOND','Screwdriver x13',3
  UNION ALL SELECT 'DIAMOND','Food & Water Set x10',4
  UNION ALL SELECT 'DIAMOND','Lockpick Advanced x13',5
  UNION ALL SELECT 'DIAMOND','Bunker Key Card x7',6
  UNION ALL SELECT 'DIAMOND','เลือกรถ 1 คัน (Sidecar / RIS / Rager / Laika / Wolfs) + ประกัน 5 ครั้ง',7
  UNION ALL SELECT 'DIAMOND','เลือกเรือ 1 คัน (Motorboat / Dinghy) + ประกัน 3 ครั้ง',8
) x ON x.pack_code = p.pack_code;

COMMIT;
