alter table tb_donate_vehicles
add column if not exists plate_card_message_id varchar(32);

create index if not exists idx_vehicles_plate_card_message_id
on tb_donate_vehicles(plate_card_message_id);
