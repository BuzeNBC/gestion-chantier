-- =============================================================================
-- Module Menuiserie — validation du devis (commandes de portes)
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Une commande de portes dont le devis est validé par le client passe dans
-- l'onglet « Portes validées » (prête pour la production). L'onglet
-- « Commande de portes » ne garde que celles en attente de validation.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists devis_valide boolean not null default false,
  add column if not exists devis_valide_date date;
