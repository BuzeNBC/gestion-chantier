-- =============================================================================
-- Module Menuiserie — marquage « chantier urgent »
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Un bon marqué urgent s'affiche en rouge tout en haut de la liste,
-- côté admin comme côté menuisier.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists is_urgent boolean not null default false;

create index if not exists idx_menuiserie_urgent
  on public.menuiserie_orders (is_urgent);
