-- =============================================================================
-- Module Menuiserie — statut « terrain » (affichage sur la carte)
-- =============================================================================
-- À exécuter dans le dashboard Supabase (projet ukvuujrjyfbheaeauggr) :
-- SQL Editor > New query > coller > Run. Idempotente.
--
-- La carte des menuisiers, « Autour de moi », les bons à proximité et la liste
-- « À planifier » ne montrent que les bons où il faut encore se rendre.
-- La règle est automatique (terminé / annulé / devis fait / en attente de
-- devis / devis validé…) ; `field_status` permet de la forcer à la main :
--   'auto'       -> règle automatique (défaut)
--   'a_faire'    -> toujours affiché (il faut y aller)
--   'en_attente' -> masqué (dossier au bureau : devis, retour client…)
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists field_status text not null default 'auto';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menuiserie_field_status_check') then
    alter table public.menuiserie_orders
      add constraint menuiserie_field_status_check
      check (field_status in ('auto', 'a_faire', 'en_attente'));
  end if;
end $$;

-- Vérification :
--   select column_name from information_schema.columns
--    where table_name = 'menuiserie_orders' and column_name = 'field_status';
