-- Memora V1 — hardening reviewed for isolated preview/staging.
-- NOT applied to any database by this commit.
-- Review current constraints, storage paths, app flows and rate-limiting behavior
-- in staging before any production approval.
begin;

-- Internal helpers stay outside the exposed Data API schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- Passwords in public.eventos are currently stored in a legacy non-bcrypt form.
-- Hash nonempty legacy values in place before exposing the validation RPC.
-- Preserve already bcrypt-formatted values. Test the real login flow in staging.
update public.eventos as e
set senha = extensions.crypt(e.senha, extensions.gen_salt('bf', 12))
where e.senha is not null
  and btrim(e.senha) <> ''
  and e.senha not like '$2a$%'
  and e.senha not like '$2b$%'
  and e.senha not like '$2y$%';

-- Small IP-based attempt window for the legacy event-password RPC.
-- Browser/API roles receive no direct privileges on this table.
create table if not exists public.memora_login_attempts (
  client_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  blocked_until timestamptz
);
alter table public.memora_login_attempts enable row level security;
revoke all on table public.memora_login_attempts from public, anon, authenticated;

-- The login response contains only the selected event's public routing metadata.
-- It never returns the password hash.
create or replace function public.validar_acesso_evento(p_senha text)
returns table (
  id uuid,
  slug text,
  nome text,
  storage_folder text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_headers jsonb;
  v_ip text;
  v_hash text;
  v_attempts integer;
  v_blocked_until timestamptz;
begin
  v_headers := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );

  v_ip := coalesce(
    nullif(btrim(v_headers ->> 'x-real-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );

  v_hash := encode(extensions.digest(v_ip, 'sha256'), 'hex');

  insert into public.memora_login_attempts (
    client_hash, window_started_at, attempts, blocked_until
  )
  values (v_hash, now(), 1, null)
  on conflict (client_hash) do update
  set
    window_started_at = case
      when public.memora_login_attempts.window_started_at < now() - interval '15 minutes'
      then now()
      else public.memora_login_attempts.window_started_at
    end,
    attempts = case
      when public.memora_login_attempts.window_started_at < now() - interval '15 minutes'
      then 1
      else public.memora_login_attempts.attempts + 1
    end,
    blocked_until = case
      when public.memora_login_attempts.window_started_at < now() - interval '15 minutes'
      then null
      when public.memora_login_attempts.blocked_until > now()
      then public.memora_login_attempts.blocked_until
      when public.memora_login_attempts.attempts + 1 >= 10
      then now() + interval '15 minutes'
      else null
    end
  returning attempts, blocked_until into v_attempts, v_blocked_until;

  if v_blocked_until is not null and v_blocked_until > now() then
    return;
  end if;

  if p_senha is null or btrim(p_senha) = '' then
    return;
  end if;

  return query
  select e.id, e.slug, e.nome, e.storage_folder
  from public.eventos as e
  where e.evento_ativo is true
    and e.senha is not null
    and (
      e.senha like '$2a$%'
      or e.senha like '$2b$%'
      or e.senha like '$2y$%'
    )
    and extensions.crypt(p_senha, e.senha) = e.senha
  order by e.created_at desc
  limit 1;
end;
$function$;

revoke all on function public.validar_acesso_evento(text) from public;
grant execute on function public.validar_acesso_evento(text) to anon, authenticated;

-- Replace the exposed helper with an internal predicate used only by RLS.
create or replace function private.memora_evento_ativo(p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.eventos as e
    where e.id = p_evento_id
      and e.evento_ativo is true
  );
$function$;
revoke all on function private.memora_evento_ativo(uuid) from public;
grant execute on function private.memora_evento_ativo(uuid) to anon, authenticated;
revoke all on function public.memora_evento_ativo(uuid) from public, anon, authenticated;

-- Replace public auto-approval with a moderation queue.
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
  and private.memora_evento_ativo(evento_id)
  and char_length(btrim(nome)) between 2 and 80
  and char_length(btrim(mensagem)) between 3 and 1000
);

-- Least-privilege table grants: RLS alone does not prevent TRUNCATE.
revoke all privileges on table public.album_rascunhos from anon, authenticated;
grant select, insert, update on table public.album_rascunhos to authenticated;

revoke all privileges on table public.memora_albums from anon, authenticated;
grant select, insert, update, delete on table public.memora_albums to authenticated;

revoke all privileges on table public.curtidas from anon, authenticated;
grant select, insert on table public.curtidas to anon, authenticated;

revoke all privileges on table public.mural_mensagens from anon, authenticated;
grant insert on table public.mural_mensagens to anon, authenticated;
grant select, update, delete on table public.mural_mensagens to authenticated;

-- SECURITY DEFINER predicates let guest policies validate event/folder ownership
-- without granting anon direct SELECT access to the private events table.
create or replace function private.memora_evento_pasta_ativa(p_pasta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.eventos as e
    where e.evento_ativo is true
      and (e.storage_folder = p_pasta or e.slug = p_pasta)
  );
$function$;
revoke all on function private.memora_evento_pasta_ativa(text) from public;
grant execute on function private.memora_evento_pasta_ativa(text) to anon, authenticated;

create or replace function private.memora_foto_evento_valida(p_evento text, p_foto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_evento is not null
    and p_foto is not null
    and p_foto !~ '/'
    and exists (
      select 1
      from public.eventos as e
      join storage.objects as o
        on o.bucket_id = 'fotos-eventos'
       and o.name = p_evento || '/' || p_foto
      where e.evento_ativo is true
        and (e.storage_folder = p_evento or e.slug = p_evento)
    );
$function$;
revoke all on function private.memora_foto_evento_valida(text, text) from public;
grant execute on function private.memora_foto_evento_valida(text, text) to anon, authenticated;

drop policy if exists "Permitir inserção pública" on public.curtidas;
create policy "Curtir somente fotos existentes de eventos ativos"
on public.curtidas
for insert
to anon, authenticated
with check (private.memora_foto_evento_valida(evento, foto_id));

-- Storage folder ownership controls. Public bucket URLs remain public by design;
-- these policies do NOT make public-bucket downloads private.
drop policy if exists "permit_upload lcy7fk_0" on storage.objects;
drop policy if exists "Convidados enviam fotos para eventos ativos" on storage.objects;
create policy "Convidados enviam fotos para eventos ativos"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'fotos-eventos'
  and lower(name) ~ '[.](jpe?g|png|webp|gif|avif|heic|heif)$'
  and private.memora_evento_pasta_ativa(split_part(name, '/', 1))
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

-- REQUIRED STAGING CHECKS:
-- 1. Verify the x-real-ip / x-forwarded-for values Supabase actually exposes to
--    RPC calls and confirm the rate-limit window behaves correctly.
-- 2. The V1 password login is not Supabase Auth; authenticated-only owner
--    deletion will not work for a sessionStorage-only admin login. Migrate the
--    admin flow to Supabase Auth or a separately authenticated Edge Function.
-- 3. The bucket is public. Direct public object URLs bypass Storage SELECT RLS.
--    To make photos private, coordinate a separate signed-URL change across all
--    gallery, telão, admin and album-editor pages; do not flip bucket visibility
--    without that complete frontend change.
-- 4. Verify realtime subscriptions and gallery likes after reducing table grants.
