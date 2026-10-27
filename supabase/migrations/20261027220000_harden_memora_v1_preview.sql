-- Memora V1 preview: security and moderation hardening.
-- REVIEW REQUIRED before applying to any shared or production database.
-- This file is intentionally committed only to the isolated preview branch.
begin;

-- Restore the RPC expected by admin-login.html. The legacy column currently
-- contains a non-bcrypt value; support that legacy format during the transition
-- and bcrypt hashes when the existing password data is migrated separately.
create or replace function public.validar_acesso_evento(p_senha text)
returns table (
  id uuid,
  slug text,
  nome text,
  storage_folder text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select e.id, e.slug, e.nome, e.storage_folder
  from public.eventos as e
  where e.evento_ativo is true
    and (
      (
        e.senha like '$2a$%'
        or e.senha like '$2b$%'
        or e.senha like '$2y$%'
      )
      and extensions.crypt(p_senha, e.senha) = e.senha
      or (
        e.senha not like '$2a$%'
        and e.senha not like '$2b$%'
        and e.senha not like '$2y$%'
        and e.senha = p_senha
      )
    )
  order by e.created_at desc
  limit 1;
$function$;

revoke all on function public.validar_acesso_evento(text) from public;
grant execute on function public.validar_acesso_evento(text) to anon, authenticated;

-- Public guest messages must enter the moderation queue; otherwise the
-- current default of 'aprovada' bypasses the intended moderation workflow.
alter table public.mural_mensagens
  alter column status set default 'pendente';

drop policy if exists "Convidados podem enviar mensagens automaticamente"
  on public.mural_mensagens;

create policy "Convidados enviam mensagens pendentes em eventos ativos"
on public.mural_mensagens
for insert
to anon, authenticated
with check (
  status = 'pendente'
  and public.memora_evento_ativo(evento_id)
  and char_length(btrim(nome)) between 2 and 80
  and char_length(btrim(mensagem)) between 3 and 1000
);

grant insert on table public.mural_mensagens to anon, authenticated;
grant update on table public.mural_mensagens to authenticated;

-- Storage policies are scoped to the event folder, and anonymous clients can
-- no longer delete every object in the shared bucket.
drop policy if exists "permit_upload lcy7fk_0" on storage.objects;
drop policy if exists "Convidados enviam fotos para eventos ativos" on storage.objects;
create policy "Convidados enviam fotos para eventos ativos"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'fotos-eventos'
  and lower(name) ~ '\.(jpe?g|png|webp|gif|avif|heic|heif)$'
  and exists (
    select 1
    from public.eventos as e
    where e.evento_ativo is true
      and (
        split_part(name, '/', 1) = e.storage_folder
        or split_part(name, '/', 1) = e.slug
      )
  )
);

drop policy if exists "excluir arquivos do bucket fotos-eventos" on storage.objects;
drop policy if exists "Proprietários excluem fotos de seus eventos" on storage.objects;
create policy "Proprietários excluem fotos de seus eventos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fotos-eventos'
  and exists (
    select 1
    from public.eventos as e
    where e.owner_id = auth.uid()
      and (
        split_part(name, '/', 1) = e.storage_folder
        or split_part(name, '/', 1) = e.slug
      )
  )
);

drop policy if exists "listar arquivos do bucket fotos-eventos" on storage.objects;
drop policy if exists "Listar fotos de eventos ativos" on storage.objects;
create policy "Listar fotos de eventos ativos"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'fotos-eventos'
  and exists (
    select 1
    from public.eventos as e
    where e.evento_ativo is true
      and (
        split_part(name, '/', 1) = e.storage_folder
        or split_part(name, '/', 1) = e.slug
      )
  )
);

commit;

-- IMPORTANT:
-- 1. The bucket is currently public. Public object URLs remain publicly readable
--    even after Storage SELECT policies; private media requires a separate,
--    coordinated change to signed URLs across the frontend.
-- 2. Legacy non-bcrypt event passwords are accepted for compatibility here.
--    Hashing the existing values is a separate data migration and must be
--    validated against the actual stored format before use.
-- 3. Apply to a disposable Supabase branch/staging database first, then test
--    admin access, guest uploads, moderation and owner-only deletion end to end.
