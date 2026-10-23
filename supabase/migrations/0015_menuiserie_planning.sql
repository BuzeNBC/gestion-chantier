-- =============================================================================
-- Module Menuiserie — heure de rendez-vous, durée, planning partagé, Realtime
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
-- Idempotente : peut être relancée sans risque.
--
-- 1) scheduled_time / duration_minutes : un bon = un rendez-vous dans le
--    planning. scheduled_date seule (scheduled_time null) = « journée ».
--    `time` (heure murale Europe/Paris) : aucun piège UTC / heure d'été.
-- 2) Realtime : la table rejoint la publication supabase_realtime pour que
--    le planning se rafraîchisse chez tout le monde (admin + menuisiers).
-- 3) profiles : les menuisiers / ouvriers peuvent lister les menuisiers
--    (noms) pour le filtre du planning et le choix du menuisier.
-- 4) Traçabilité : qui a replanifié, et quand (trigger, zéro code client).
-- =============================================================================

-- 1) Colonnes ----------------------------------------------------------------
alter table public.menuiserie_orders
  add column if not exists scheduled_time      time,
  add column if not exists duration_minutes    integer not null default 120,
  add column if not exists planning_updated_at timestamptz,
  add column if not exists planning_updated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menuiserie_duration_check') then
    alter table public.menuiserie_orders
      add constraint menuiserie_duration_check
      check (duration_minutes between 15 and 720);
  end if;
end $$;

create index if not exists idx_menuiserie_scheduled
  on public.menuiserie_orders (scheduled_date)
  where scheduled_date is not null;

-- 2) Realtime ----------------------------------------------------------------
-- Équivalent du bouton « Realtime » de l'éditeur de table.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    raise notice 'supabase_realtime est FOR ALL TABLES : rien à faire';
  elsif not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'menuiserie_orders'
  ) then
    alter publication supabase_realtime add table public.menuiserie_orders;
  end if;
end $$;

-- 3) profiles : lecture des menuisiers par le personnel ----------------------
-- Additif (les policies existantes restent, elles se combinent en OR).
-- Les helpers is_* sont security definer : pas de récursion RLS sur profiles.
-- Si la RLS n'est pas activée sur profiles, cette policy est sans effet.
drop policy if exists "profiles_staff_select_menuisiers" on public.profiles;
create policy "profiles_staff_select_menuisiers"
  on public.profiles
  for select
  using (
    role = 'menuisier'
    and (public.is_admin() or public.is_menuisier() or public.is_worker())
  );

-- 4) Traçabilité du planning -------------------------------------------------
create or replace function public.set_menuiserie_planning_audit()
returns trigger as $$
begin
  if (new.scheduled_date   is distinct from old.scheduled_date)
  or (new.scheduled_time   is distinct from old.scheduled_time)
  or (new.duration_minutes is distinct from old.duration_minutes)
  or (new.assigned_to      is distinct from old.assigned_to) then
    new.planning_updated_at = now();
    new.planning_updated_by = auth.uid();   -- null depuis le SQL Editor
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_menuiserie_planning_audit on public.menuiserie_orders;
create trigger trg_menuiserie_planning_audit
  before update on public.menuiserie_orders
  for each row execute function public.set_menuiserie_planning_audit();

-- =============================================================================
-- Vérification (à coller après exécution) :
--   select column_name, data_type from information_schema.columns
--    where table_name='menuiserie_orders'
--      and column_name in ('scheduled_time','duration_minutes','planning_updated_at','planning_updated_by');
--   select tablename from pg_publication_tables where pubname='supabase_realtime';
--   select policyname from pg_policies where tablename='profiles';
-- =============================================================================
