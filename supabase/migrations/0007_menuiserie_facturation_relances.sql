-- =============================================================================
-- Module Menuiserie — facturation + relances
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
--
-- Ajouts :
--   billing_status  -> 'a_facturer' | 'devis_envoye' | 'facture'
--   invoice_number  -> n° de devis/facture (texte libre pour la secrétaire)
--   billed_date     -> date de facturation
--   relances        -> historique des relances reçues :
--                      [{ id, date, note, created_at }]
--
-- Les prix sont stockés PAR INTERVENTION dans le jsonb `interventions`
-- (champ `price_ht` de chaque intervention) — pas de colonne dédiée.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists billing_status text not null default 'a_facturer',
  add column if not exists invoice_number text,
  add column if not exists billed_date    date,
  add column if not exists relances       jsonb not null default '[]'::jsonb;

-- Garde-fou sur les valeurs de statut de facturation
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
  check (billing_status in ('a_facturer', 'devis_envoye', 'facture'));

-- Filtrage rapide côté admin (« tout ce qui reste à facturer »)
create index if not exists idx_menuiserie_billing_status
  on public.menuiserie_orders (billing_status);
