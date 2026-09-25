-- =============================================================================
-- Module Menuiserie — Pièces jointes du bon (PDF, photos, docs…)
-- =============================================================================
-- Permet à l'admin d'attacher des fichiers (devis, plans, photos brutes, etc.)
-- au moment de la création d'un bon. Les fichiers sont consultables par le
-- menuisier assigné depuis sa vue détail du bon.
-- =============================================================================

-- 1) Nouvelle colonne `attachments` sur menuiserie_orders -------------------
-- Forme d'un attachment :
--   { id, name, url, size, content_type, path, uploaded_at, uploaded_by }
alter table public.menuiserie_orders
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 2) Bucket Storage dédié --------------------------------------------------
-- Public en lecture (pour servir les URLs directement aux navigateurs),
-- mais les écritures sont restreintes aux admins via les policies ci-dessous.
insert into storage.buckets (id, name, public)
values ('menuiserie_attachments', 'menuiserie_attachments', true)
on conflict (id) do nothing;

-- 3) Storage policies ------------------------------------------------------
-- Admin : INSERT/UPDATE/DELETE/SELECT sur le bucket.
drop policy if exists "menuiserie_attachments_admin_all" on storage.objects;
create policy "menuiserie_attachments_admin_all"
  on storage.objects
  for all
  using (bucket_id = 'menuiserie_attachments' and public.is_admin())
  with check (bucket_id = 'menuiserie_attachments' and public.is_admin());

-- Lecture publique : le bucket est public donc Supabase laisse les URLs
-- publiques accessibles sans auth. Pour autoriser explicitement SELECT
-- aux menuisiers connectés (au cas où on bascule le bucket en privé un jour) :
drop policy if exists "menuiserie_attachments_authenticated_select" on storage.objects;
create policy "menuiserie_attachments_authenticated_select"
  on storage.objects
  for select
  using (bucket_id = 'menuiserie_attachments');
