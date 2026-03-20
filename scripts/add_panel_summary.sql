ALTER TABLE public.tb_donate_pack_master
ADD COLUMN IF NOT EXISTS panel_summary text;

-- ตัวอย่างอัปเดตข้อความสรุปหน้าพาเนล
UPDATE public.tb_donate_pack_master
SET panel_summary = CASE pack_code
  WHEN 'BRONZE' THEN 'SCUM$ 10,000'
  WHEN 'SILVER' THEN 'SCUM$ 25,000 + Phoenix Tears x1'
  WHEN 'GOLD' THEN 'SCUM$ 50,000 + Phoenix Tears x3
เลือกรถ 1 คัน + ประกัน 1 ครั้ง'
  WHEN 'PLATINUM' THEN 'SCUM$ 100,000 + ของพรีเมียม
เลือกรถ 1 คัน + เรือ 1 คัน'
  WHEN 'DIAMOND' THEN 'SCUM$ 200,000 + ของครบสุด
เลือกรถ 1 คัน + เรือ 1 คัน'
  ELSE panel_summary
END
WHERE pack_code IN ('BRONZE','SILVER','GOLD','PLATINUM','DIAMOND');
