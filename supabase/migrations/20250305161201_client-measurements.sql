-- Drop the existing table if it exists
drop table if exists "Measurements";

-- Create Measurements table with the correct structure
create table "Measurements" (
  id bigint primary key generated always as identity,
  client_id bigint,
  finger_position text,
  nail_bed_width numeric,
  nail_bed_curve numeric,
  nail_bed_length numeric,
  date_measured timestamp with time zone default timezone('utc'::text, now()) not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table "Measurements" enable row level security;

-- Policies
create policy "Enable read for authenticated users"
on "Measurements"
for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on "Measurements"
for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on "Measurements"
for update
to authenticated
using (true)
with check (true);
