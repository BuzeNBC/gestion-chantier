-- =============================================================================
-- Module Menuiserie — annulation d'un bon (sans suppression)
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Un bon annulé garde toutes ses données, quitte sa sous-section et rejoint
-- l'onglet « Terminés » avec la raison de l'annulation (traçabilité :
-- pourquoi on n'est pas intervenu).
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists cancelled boolean not null default false,
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_date date;
