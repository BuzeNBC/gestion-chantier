-- =============================================================================
-- Module Menuiserie — géolocalisation des adresses (latitude / longitude)
-- =============================================================================
-- À exécuter dans le dashboard Supabase : SQL Editor > New query > coller > Run.
-- Idempotente : peut être relancée sans risque.
--
-- Les adresses libres sont géocodées côté client (API Adresse / BAN, gratuite,
-- sans clé). On stocke le résultat pour la carte et le calcul de proximité.
--   latitude / longitude : WGS84 (null = adresse non localisée)
--   geocode_label        : adresse normalisée renvoyée par le géocodeur
--   geocode_score        : confiance 0..1 renvoyée par le géocodeur
--   geocode_address      : texte d'adresse qui a servi au géocodage. Si
--                          `address` change, l'app sait qu'il faut re-géocoder.
--   geocode_source       : 'ban' (automatique) | 'manual' (position corrigée)
--   geocoded_at          : date de la dernière tentative (succès OU échec :
--                          latitude null + geocoded_at non null = échec)
-- Aucune modification RLS : menuisiers / ouvriers ont déjà UPDATE sur toutes
-- les colonnes, l'admin a tous les droits.
-- =============================================================================

alter table public.menuiserie_orders
  add column if not exists latitude        double precision,
  add column if not exists longitude       double precision,
  add column if not exists geocode_label   text,
  add column if not exists geocode_score   double precision,
  add column if not exists geocode_address text,
  add column if not exists geocode_source  text,
  add column if not exists geocoded_at     timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menuiserie_latlng_check') then
    alter table public.menuiserie_orders
      add constraint menuiserie_latlng_check
      check (
        ((latitude is null) = (longitude is null))
        and (latitude  is null or latitude  between  -90 and  90)
        and (longitude is null or longitude between -180 and 180)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'menuiserie_geocode_source_check') then
    alter table public.menuiserie_orders
      add constraint menuiserie_geocode_source_check
      check (geocode_source is null or geocode_source in ('ban', 'manual'));
  end if;
end $$;

-- =============================================================================
-- Vérification (à coller après exécution) :
--   select column_name, data_type from information_schema.columns
--    where table_name='menuiserie_orders'
--      and (column_name like 'geocode%' or column_name in ('latitude','longitude'));
--   -- adresses sans code postal (à corriger à la main si le géocodage échoue) :
--   select client_name, address from public.menuiserie_orders
--    where address is not null and address !~ '\d{5}' and coalesce(cancelled,false) = false;
-- =============================================================================
