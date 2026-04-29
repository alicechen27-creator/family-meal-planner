-- ============================================================
-- 家庭晚餐規劃系統 v2
-- 在 Supabase SQL Editor 執行此檔案以建立資料庫結構
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  app_access text[] not null default '{budget,meal_planner,kids_activity}',
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles
  add column if not exists app_access text[] not null default '{budget,meal_planner,kids_activity}';

alter table profiles enable row level security;

create policy "profiles: authenticated can read all"
  on profiles for select using (auth.uid() is not null);
create policy "profiles: owner can update"
  on profiles for update using (auth.uid() = id);

create or replace function prevent_profile_privilege_escalation()
returns trigger as $$
begin
  if current_setting('app.bypass_profile_guard', true) = 'on' then
    return new;
  end if;

  if auth.uid() = old.id and (
    new.role is distinct from old.role or
    new.app_access is distinct from old.app_access
  ) then
    raise exception 'cannot update privileged profile fields';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists profiles_prevent_privilege_escalation on profiles;
create trigger profiles_prevent_privilege_escalation
  before update of role, app_access on profiles
  for each row execute function prevent_profile_privilege_escalation();

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- RECIPES
-- ============================================================
create table if not exists recipes (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  photo_url text,
  type text not null check (type in ('split', 'all_in_one')),
  servings int not null default 4,
  source_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table recipes enable row level security;

create policy "recipes: authenticated can view"
  on recipes for select using (auth.uid() is not null);
create policy "recipes: admin can insert"
  on recipes for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "recipes: admin can update"
  on recipes for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "recipes: admin can delete"
  on recipes for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- Components for split recipes (starch / meat / vegetable / sauce)
create table if not exists recipe_components (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  type text not null check (type in ('starch', 'meat', 'vegetable', 'sauce')),
  name text not null,
  display_order int not null default 0
);

alter table recipe_components enable row level security;

create policy "recipe_components: authenticated can view"
  on recipe_components for select using (auth.uid() is not null);
create policy "recipe_components: admin can manage"
  on recipe_components for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- Ingredients for each component (split recipes)
create table if not exists recipe_component_ingredients (
  id uuid default gen_random_uuid() primary key,
  component_id uuid references recipe_components(id) on delete cascade not null,
  name text not null,
  amount text,
  unit text
);

alter table recipe_component_ingredients enable row level security;

create policy "rci: authenticated can view"
  on recipe_component_ingredients for select using (auth.uid() is not null);
create policy "rci: admin can manage"
  on recipe_component_ingredients for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- Ingredients for all_in_one recipes
create table if not exists recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade not null,
  name text not null,
  amount text,
  unit text
);

alter table recipe_ingredients enable row level security;

create policy "recipe_ingredients: authenticated can view"
  on recipe_ingredients for select using (auth.uid() is not null);
create policy "recipe_ingredients: admin can manage"
  on recipe_ingredients for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ============================================================
-- INGREDIENT CATALOG & INVENTORY
-- ============================================================
-- NOTE: shopping_channels table removed; channels are now hardcoded in
-- src/components/admin/recipes/ChannelSelect.tsx (CHANNEL_PRESETS)

create table if not exists ingredient_catalog (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  default_channel text,
  is_staple boolean not null default false,
  created_at timestamptz default now()
);

alter table ingredient_catalog enable row level security;

create policy "catalog: authenticated can view"
  on ingredient_catalog for select using (auth.uid() is not null);
create policy "catalog: admin can manage"
  on ingredient_catalog for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


create table if not exists home_inventory (
  id uuid default gen_random_uuid() primary key,
  ingredient_name text not null unique,
  quantity text,
  unit text,
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

alter table home_inventory enable row level security;

create policy "home_inventory: authenticated can view"
  on home_inventory for select using (auth.uid() is not null);
create policy "home_inventory: admin can manage"
  on home_inventory for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- ============================================================
-- WEEK PLANNING
-- ============================================================
create table if not exists week_plans (
  id uuid default gen_random_uuid() primary key,
  week_start date not null unique,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  notified_full_at timestamptz
);

alter table week_plans add column if not exists notified_full_at timestamptz;

alter table week_plans enable row level security;

create policy "week_plans: authenticated can view"
  on week_plans for select using (auth.uid() is not null);
create policy "week_plans: admin can manage"
  on week_plans for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


create table if not exists meal_slots (
  id uuid default gen_random_uuid() primary key,
  week_plan_id uuid references week_plans(id) on delete cascade not null,
  slot_date date not null,
  weekday text not null,
  is_available boolean not null default true,
  unique (week_plan_id, slot_date)
);

alter table meal_slots enable row level security;

create policy "meal_slots: authenticated can view"
  on meal_slots for select using (auth.uid() is not null);
create policy "meal_slots: admin can manage"
  on meal_slots for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- UNIQUE on meal_slot_id = database-level lock: only one selection per slot
create table if not exists meal_selections (
  id uuid default gen_random_uuid() primary key,
  meal_slot_id uuid references meal_slots(id) on delete cascade not null unique,
  user_id uuid references profiles(id) not null,
  selection_type text not null check (selection_type in ('split', 'all_in_one')),
  starch_component_id uuid references recipe_components(id),
  meat_component_id uuid references recipe_components(id),
  veggie_component_id uuid references recipe_components(id),
  sauce_component_id uuid references recipe_components(id),
  recipe_id uuid references recipes(id),
  created_at timestamptz default now()
);

alter table meal_selections enable row level security;

create policy "meal_selections: authenticated can view"
  on meal_selections for select using (auth.uid() is not null);
create policy "meal_selections: user can insert own"
  on meal_selections for insert with check (auth.uid() = user_id);
create policy "meal_selections: user can update own"
  on meal_selections for update using (auth.uid() = user_id);
create policy "meal_selections: user can delete own"
  on meal_selections for delete using (auth.uid() = user_id);
create policy "meal_selections: admin can delete any"
  on meal_selections for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );


-- Shopping list: persisted after week closes
create table if not exists shopping_list_items (
  id uuid default gen_random_uuid() primary key,
  week_plan_id uuid references week_plans(id) on delete cascade not null,
  ingredient_name text not null,
  total_amount text,
  unit text,
  channel_name text,
  is_staple boolean not null default false,
  for_recipe_title text,
  for_date date,
  is_checked boolean not null default false
);

alter table shopping_list_items enable row level security;

create policy "shopping_list_items: authenticated can view"
  on shopping_list_items for select using (auth.uid() is not null);
create policy "shopping_list_items: admin can manage"
  on shopping_list_items for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "shopping_list_items: authenticated can update is_checked"
  on shopping_list_items for update using (auth.uid() is not null);


-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table meal_selections;
alter publication supabase_realtime add table meal_slots;
alter publication supabase_realtime add table week_plans;


-- ============================================================
-- TRIGGER: notify when all slots filled
-- ============================================================
create or replace function check_all_slots_filled()
returns trigger as $$
declare
  v_week_plan_id uuid;
  v_total_available int;
  v_total_filled int;
begin
  select ms.week_plan_id into v_week_plan_id
  from meal_slots ms where ms.id = new.meal_slot_id;

  select count(*) into v_total_available
  from meal_slots
  where week_plan_id = v_week_plan_id and is_available = true;

  select count(*) into v_total_filled
  from meal_selections msel
  join meal_slots ms2 on ms2.id = msel.meal_slot_id
  where ms2.week_plan_id = v_week_plan_id;

  if v_total_available > 0 and v_total_filled >= v_total_available then
    perform pg_notify('all_slots_filled', v_week_plan_id::text);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_selection_inserted on meal_selections;
create trigger on_selection_inserted
  after insert on meal_selections
  for each row execute function check_all_slots_filled();
