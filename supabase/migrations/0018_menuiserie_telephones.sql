-- =============================================================================
-- Module Menuiserie — plusieurs numéros de téléphone par bon
-- =============================================================================
-- À exécuter dans le dashboard Supabase (projet ukvuujrjyfbheaeauggr) :
-- SQL Editor > New query > coller > Run. Idempotente.
--
-- Il y a souvent plusieurs numéros par BT (locataire, gardien, agence…).
-- Jusqu'ici ils étaient tapés à la suite dans `client_phone`, impossible
-- d'appeler directement. On ajoute deux champs ; l'app détecte aussi les
-- anciens bons où plusieurs numéros sont écrits dans le premier champ.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists client_phone2 text,
  add column if not exists client_phone3 text;

-- Vérification :
--   select column_name from information_schema.columns
--    where table_name = 'menuiserie_orders' and column_name like 'client_phone%';
