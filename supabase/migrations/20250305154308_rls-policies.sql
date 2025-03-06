-- Enable RLS on all tables
alter table "Brand" enable row level security;
alter table "Nail Tip Sets" enable row level security;
alter table "Nail Tip Sizes" enable row level security;

-- Brand table policies
create policy "Enable read for authenticated users"
on "Brand"
for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on "Brand"
for insert
to authenticated
with check (true);

-- Nail Tip Sets table policies
create policy "Enable read for authenticated users"
on "Nail Tip Sets"
for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on "Nail Tip Sets"
for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on "Nail Tip Sets"
for update
to authenticated
using (true);

-- Nail Tip Sizes table policies
create policy "Enable read for authenticated users"
on "Nail Tip Sizes"
for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on "Nail Tip Sizes"
for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on "Nail Tip Sizes"
for update
to authenticated
using (true);

create policy "Enable delete for authenticated users"
on "Nail Tip Sizes"
for delete
to authenticated
using (true);
