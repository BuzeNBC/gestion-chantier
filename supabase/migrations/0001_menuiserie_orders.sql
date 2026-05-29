-- =============================================================================
-- Module Menuiserie — table des bons d'intervention + sécurité (RLS)
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Rôles (colonne profiles.role) :
--   'admin'     -> accès total (crée, assigne, supprime)
--   'menuisier' -> voit et met à jour SES bons (cotes, photos, statut)
--   'worker'    -> aucun accès à la menuiserie
-- =============================================================================

-- 1) Table -------------------------------------------------------------------
create table if not exists public.menuiserie_orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  reference     text,                              -- ex: BM-2026-001 (optionnel)
  type          text not null default 'autre',     -- reparation_vr | prise_cote | remplacement | autre
  status        text not null default 'todo',      -- todo | in_progress | completed

  client_name   text,
  client_phone  text,
  address       text,
  description    text,

  -- Cotes : tableau d'objets
  --   { id, repere, largeur, hauteur, ouvrant, notes }
  measurements  jsonb not null default '[]'::jsonb,

  -- Photos : tableau d'objets
  --   { id, url, category }  (category: 'avant' | 'apres' | 'autre')
  photos        jsonb not null default '[]'::jsonb,

  notes         text,

  assigned_to    uuid references public.profiles(id) on delete set null,
  scheduled_date date,
  completed_date date
);

-- Index pour filtrer rapidement par menuisier et par statut
create index if not exists idx_menuiserie_assigned_to on public.menuiserie_orders (assigned_to);
create index if not exists idx_menuiserie_status      on public.menuiserie_orders (status);

-- 2) updated_at automatique --------------------------------------------------
create or replace function public.set_menuiserie_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_menuiserie_updated_at on public.menuiserie_orders;
create trigger trg_menuiserie_updated_at
  before update on public.menuiserie_orders
  for each row execute function public.set_menuiserie_updated_at();

-- 3) Row Level Security ------------------------------------------------------
alter table public.menuiserie_orders enable row level security;

-- Helper : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  );
$$ language sql security definer stable;

-- Helper : l'utilisateur courant est-il menuisier ?
create or replace function public.is_menuisier()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'menuisier'
  );
$$ language sql security definer stable;

-- Admin : accès total
drop policy if exists "menuiserie_admin_all" on public.menuiserie_orders;
create policy "menuiserie_admin_all"
  on public.menuiserie_orders
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Menuisier : peut LIRE les bons qui lui sont assignés
drop policy if exists "menuiserie_menuisier_select" on public.menuiserie_orders;
create policy "menuiserie_menuisier_select"
  on public.menuiserie_orders
  for select
  using (public.is_menuisier() and assigned_to = auth.uid());

-- Menuisier : peut METTRE À JOUR les bons qui lui sont assignés
-- (cotes, photos, statut, notes — l'assignation reste contrôlée par l'admin via
--  with check qui empêche de se réassigner un bon ou de le voler)
drop policy if exists "menuiserie_menuisier_update" on public.menuiserie_orders;
create policy "menuiserie_menuisier_update"
  on public.menuiserie_orders
  for update
  using (public.is_menuisier() and assigned_to = auth.uid())
  with check (public.is_menuisier() and assigned_to = auth.uid());

-- Note : les menuisiers n'ont PAS de policy INSERT ni DELETE → seul l'admin
-- peut créer et supprimer des bons (workflow "admin crée, menuisier exécute").
