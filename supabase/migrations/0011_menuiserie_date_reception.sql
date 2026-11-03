-- =============================================================================
-- Module Menuiserie — date de réception du bon
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- La liste des bons (admin et menuisier) est triée par date de réception
-- (le plus ancien reçu en premier), après les urgences et les relances.
-- Les bons existants sont initialisés avec leur date de création.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists received_date date;

update public.menuiserie_orders
  set received_date = created_at::date
  where received_date is null;

create index if not exists idx_menuiserie_received
  on public.menuiserie_orders (received_date);
