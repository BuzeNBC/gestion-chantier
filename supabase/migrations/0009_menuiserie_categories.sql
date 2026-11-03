-- =============================================================================
-- Module Menuiserie — sous-sections (catégories de bons)
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
--   'petites_interventions' -> les bons existants (défaut)
--   'commande_portes'       -> commandes de portes
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists category text not null default 'petites_interventions';

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'menuiserie_category_check'
  ) then
    alter table public.menuiserie_orders drop constraint menuiserie_category_check;
  end if;
end $$;

alter table public.menuiserie_orders
  add constraint menuiserie_category_check
  check (category in ('petites_interventions', 'commande_portes'));

create index if not exists idx_menuiserie_category
  on public.menuiserie_orders (category);
