-- =============================================================================
-- Module Menuiserie — journal des appels passés depuis l'app
-- =============================================================================
-- À exécuter dans le dashboard Supabase (projet ukvuujrjyfbheaeauggr) :
-- SQL Editor > New query > coller > Run. Idempotente.
--
-- call_log : tableau d'appels [{ id, at (ISO), by (uuid), by_name }]
-- Chaque clic sur « Appeler » dans l'app ajoute une entrée ; la pastille
-- « Appelé le 21/10 à 14:32 (Franck) » s'affiche sur le bon.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists call_log jsonb not null default '[]'::jsonb;

-- Vérification :
--   select column_name from information_schema.columns
--    where table_name = 'menuiserie_orders' and column_name = 'call_log';
