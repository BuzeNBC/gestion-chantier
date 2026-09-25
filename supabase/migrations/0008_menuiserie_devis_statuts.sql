-- =============================================================================
-- Module Menuiserie — statuts de devis dans le parcours de facturation
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Le parcours de la secrétaire devient :
--   devis_a_faire -> devis_fait -> a_facturer -> facture
--
-- Conversion des données existantes :
--   'a_facturer'   (ancien défaut, jamais choisi explicitement) -> 'devis_a_faire'
--   'devis_envoye' -> 'devis_fait'
-- =============================================================================

-- 1) Lever l'ancienne contrainte AVANT la conversion
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'menuiserie_billing_status_check'
  ) then
    alter table public.menuiserie_orders drop constraint menuiserie_billing_status_check;
  end if;
end $$;

-- 2) Convertir les valeurs existantes
update public.menuiserie_orders
  set billing_status = 'devis_a_faire'
  where billing_status = 'a_facturer';

update public.menuiserie_orders
  set billing_status = 'devis_fait'
  where billing_status = 'devis_envoye';

-- 3) Nouveau défaut + nouvelle contrainte
alter table public.menuiserie_orders
  alter column billing_status set default 'devis_a_faire';

alter table public.menuiserie_orders
  add constraint menuiserie_billing_status_check
  check (billing_status in ('devis_a_faire', 'devis_fait', 'a_facturer', 'facture'));
