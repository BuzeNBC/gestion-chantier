-- =============================================================================
-- Module Menuiserie — Accès lecture/écriture pour les ouvriers (workers)
-- =============================================================================
-- Les ouvriers (role='worker') doivent pouvoir voir TOUS les bons menuiserie
-- (pour se coordonner avec le menuisier sur leurs chantiers) et avoir les mêmes
-- droits d'édition (cotes, photos, statut, ajout d'interventions sur place).
-- =============================================================================

-- Helper : l'utilisateur courant est-il ouvrier ?
create or replace function public.is_worker()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'worker'
  );
$$ language sql security definer stable;

-- Worker : SELECT sur tous les bons de menuiserie
drop policy if exists "menuiserie_worker_select" on public.menuiserie_orders;
create policy "menuiserie_worker_select"
  on public.menuiserie_orders
  for select
  using (public.is_worker());

-- Worker : UPDATE sur tous les bons (cotes, photos, statut, interventions, notes)
-- Pas d'INSERT ni DELETE : la création/suppression reste réservée à l'admin.
drop policy if exists "menuiserie_worker_update" on public.menuiserie_orders;
create policy "menuiserie_worker_update"
  on public.menuiserie_orders
  for update
  using (public.is_worker())
  with check (public.is_worker());

-- Worker : SELECT sur la table charge_affaires (pour afficher les noms dans
-- l'éventuel formulaire d'ajout d'intervention côté ouvrier).
drop policy if exists "charge_affaires_worker_select" on public.charge_affaires;
create policy "charge_affaires_worker_select"
  on public.charge_affaires
  for select
  using (public.is_worker());
