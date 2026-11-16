-- =============================================================================
-- Module Menuiserie — étape « En cours de facturation »
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Le parcours de facturation devient :
--   devis_a_faire -> devis_fait -> a_facturer -> en_cours_facturation -> facture
-- =============================================================================

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'menuiserie_billing_status_check'
  ) then
    alter table public.menuiserie_orders drop constraint menuiserie_billing_status_check;
  end if;
end $$;

alter table public.menuiserie_orders
  add constraint menuiserie_billing_status_check
  check (billing_status in (
    'devis_a_faire', 'devis_fait', 'a_facturer', 'en_cours_facturation', 'facture'
  ));
