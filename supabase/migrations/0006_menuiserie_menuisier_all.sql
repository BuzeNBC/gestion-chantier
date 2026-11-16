-- =============================================================================
-- Module Menuiserie — Le menuisier voit et modifie TOUS les bons
-- =============================================================================
-- L'app n'a qu'un seul menuisier (ou une petite équipe interchangeable) :
-- exiger que chaque bon soit explicitement assigné est source d'oublis.
-- On élargit donc les policies pour que le menuisier voie et édite l'ensemble
-- des bons, quel que soit le champ `assigned_to`.
-- =============================================================================

-- SELECT : n'importe quel bon
drop policy if exists "menuiserie_menuisier_select" on public.menuiserie_orders;
create policy "menuiserie_menuisier_select"
  on public.menuiserie_orders
  for select
  using (public.is_menuisier());

-- UPDATE : n'importe quel bon (cotes, photos, statut, interventions, notes)
-- On garde INSERT et DELETE réservés à l'admin (pas de policy pour le menuisier
-- sur ces actions).
drop policy if exists "menuiserie_menuisier_update" on public.menuiserie_orders;
create policy "menuiserie_menuisier_update"
  on public.menuiserie_orders
  for update
  using (public.is_menuisier())
  with check (public.is_menuisier());
