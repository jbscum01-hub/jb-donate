alter table vehicles
add column if not exists plate_card_message_id text;

create index if not exists idx_vehicles_plate_card_message_id
on vehicles(plate_card_message_id);
