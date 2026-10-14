-- NEXORA: estructura inicial de utilitarios compartidos
-- Las claves de servidor nunca se incluyen en GitHub Pages.

-- La función automática de RLS es un disparador interno, no una API para usuarios.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.utilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title text not null check (char_length(title) between 2 and 100),
  description text not null default '',
  category text not null default 'General',
  href text not null default '#',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.utility_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  utility_id uuid not null references public.utilities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, utility_id)
);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.utilities enable row level security;
alter table public.utility_access enable row level security;

-- Accesos explícitos para evitar publicar tablas accidentalmente.
revoke all on public.profiles, public.admin_users, public.utilities, public.utility_access from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.utilities to authenticated;
grant select, insert, delete on public.utility_access to authenticated;

-- La condición de administrador se evalúa sobre una tabla sin escritura pública.
create policy "admin_lee_su_membresia"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

create policy "perfiles_lectura_propio_o_admin"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
);
create policy "perfiles_crear_propio"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy "perfiles_editar_propio"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "utilitarios_ver_asignados_o_admin"
on public.utilities for select to authenticated
using (
  exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
  or (
    is_enabled = true
    and exists (
      select 1 from public.utility_access x
      where x.utility_id = utilities.id and x.user_id = (select auth.uid())
    )
  )
);
create policy "utilitarios_insertar_admin"
on public.utilities for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy "utilitarios_editar_admin"
on public.utilities for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy "utilitarios_eliminar_admin"
on public.utilities for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "permisos_ver_propios_o_admin"
on public.utility_access for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()))
);
create policy "permisos_otorgar_admin"
on public.utility_access for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
create policy "permisos_revocar_admin"
on public.utility_access for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- Primer administrador: se asignará después de crear su cuenta en Auth.
-- insert into public.admin_users (user_id) values ('UUID-DE-USUARIO');
