-- =============================================================================
-- Module Menuiserie — Ajout chargé d'affaire + numéro de BT
-- =============================================================================
-- À exécuter dans le dashboard Supabase (SQL Editor) une fois la migration
-- 0001_menuiserie_orders.sql déjà appliquée.
-- =============================================================================

-- 1) Nouvelle table : référentiel des chargé(e)s d'affaire ------------------
create table if not exists public.charge_affaires (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- 2) Seed initial des 6 chargé(e)s d'affaire connus -------------------------
insert into public.charge_affaires (name) values
  ('Océane Dupont'),
  ('Evelyne Dezeque'),
  ('Carol Castel'),
  ('Manon Castel'),
  ('Ludivine Verbeke'),
  ('Nathalie Volcoff')
on conflict (name) do nothing;

-- 3) Row Level Security -----------------------------------------------------
alter table public.charge_affaires enable row level security;

drop policy if exists "charge_affaires_admin_all" on public.charge_affaires;
create policy "charge_affaires_admin_all"
  on public.charge_affaires
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Le menuisier peut lire le nom de son chargé d'affaire (affiché sur le bon).
drop policy if exists "charge_affaires_menuisier_select" on public.charge_affaires;
create policy "charge_affaires_menuisier_select"
  on public.charge_affaires
  for select
  using (public.is_menuisier());

-- 4) Nouvelles colonnes sur menuiserie_orders --------------------------------
-- - bt_number      : référence externe du bon de travail (ex : BT-2026-042)
-- - charge_affaire : nom (texte libre) du chargé d'affaire référencé sur le bon
--   On stocke par nom (pas de FK) pour rester souple : si le référentiel
--   change/supprime un nom, les bons existants gardent leur valeur.
alter table public.menuiserie_orders
  add column if not exists bt_number       text,
  add column if not exists charge_affaire  text;

create index if not exists idx_menuiserie_bt_number      on public.menuiserie_orders (bt_number);
create index if not exists idx_menuiserie_charge_affaire on public.menuiserie_orders (charge_affaire);
