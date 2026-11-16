-- =============================================================================
-- Ajout de Marie-Alice dans le planning menuiserie (compte menuisier)
-- =============================================================================
-- À coller dans le dashboard Supabase (projet ukvuujrjyfbheaeauggr) :
-- SQL Editor > New query > coller > Run. Relançable sans risque.
--
-- Crée le compte marie-alice@alliancenordmenuiserie.fr (identifiant, pas une
-- vraie boîte mail) avec le profil « Marie-Alice », rôle menuisier : elle
-- apparaît aussitôt dans le planning, les filtres et « Menuisier assigné ».
-- Le mot de passe initial est aléatoire : voir le bloc 2 si elle doit se
-- connecter à l'app.
-- =============================================================================

-- 1) Compte + profil -----------------------------------------------------------
do $$
declare
  v_email text := 'marie-alice@alliancenordmenuiserie.fr';
  v_id    uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'Le compte % existe déjà : rien à faire.', v_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    -- champs techniques en chaîne vide (sinon le dashboard ne charge pas l'utilisateur)
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, role, "Name", created_at, updated_at)
  values (v_id, 'menuisier', 'Marie-Alice', now(), now());

  raise notice 'Compte % créé.', v_email;
end $$;

-- Vérification :
select u.email, p."Name", p.role
from public.profiles p join auth.users u on u.id = p.id
where p.role = 'menuisier' order by p."Name";

-- 2) (Seulement si elle doit se connecter) définir son mot de passe ----------
-- Remplace METS_LE_MOT_DE_PASSE_ICI (garde les apostrophes), puis Run :
--
-- update auth.users
-- set encrypted_password = extensions.crypt('METS_LE_MOT_DE_PASSE_ICI', extensions.gen_salt('bf'))
-- where email = 'marie-alice@alliancenordmenuiserie.fr';
