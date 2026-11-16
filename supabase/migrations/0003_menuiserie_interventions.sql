-- =============================================================================
-- Module Menuiserie — Plusieurs interventions par bon
-- =============================================================================
-- Un bon devient un "regroupement" (1 client, 1 adresse, 1 chargé d'affaire,
-- 1 numéro de BT) qui contient une LISTE d'interventions. Chaque intervention
-- a son propre type, son statut, ses cotes, ses photos et ses notes.
--
-- Forme d'un élément de `interventions` :
--   {
--     id: uuid,
--     type: text,                     -- libellé d'intervention (cf. corps d'état Menuiserie)
--     status: 'todo'|'in_progress'|'completed',
--     measurements: [{id, repere, largeur, hauteur, ouvrant, notes}],
--     photos: [{id, url, category}],
--     notes: text,
--     completed_date: date | null,
--     created_at: timestamptz,
--     created_by: uuid (id de l'auteur — admin ou menuisier)
--   }
--
-- Le statut du bon entier (colonne `status`) est désormais CALCULÉ côté client
-- depuis les statuts des interventions ('todo' si tout est à faire, 'completed'
-- si tout est terminé, sinon 'in_progress').
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists interventions jsonb not null default '[]'::jsonb;

-- Note : on garde les anciennes colonnes (type, measurements, photos, notes,
-- completed_date, status) en place pour ne rien casser, mais le nouveau code
-- n'y écrit plus pour les bons multi-interventions. Pour les bons existants
-- qui n'ont qu'un seul type, on peut les migrer plus tard si besoin.
