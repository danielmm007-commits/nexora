# NEXORA — Utilitarios para compartir

Plataforma independiente de DISPROTEL para ofrecer herramientas digitales a amigos y conocidos con permisos individuales.

## Estructura inicial
- `index.html`: panel web y acceso de usuarios.
- `supabase/migrations/20261014_nexora_core.sql`: perfiles, administradores, utilitarios y autorizaciones.
- Supabase es el backend (Auth + PostgreSQL); GitHub Pages será el frontend.

## Principio de permisos
El registro de usuario **no otorga permisos** para los utilitarios.
Solo un administrador puede habilitar herramientas y conceder acceso a usuarios.
Las políticas RLS protegen los datos incluso si alguien manipula el navegador.

## Activación
1. Aplicar la migración al proyecto de Supabase **nexora** (nunca a DISPROTEL).
2. Publicar la rama `main` / carpeta `/` en **Settings > Pages** del repositorio.
3. En Supabase Auth, crear/invitar el usuario propietario.
4. Desde SQL Editor, incorporar una sola vez su UUID a `public.admin_users`.
5. En el panel de administración, registrar utilitarios y asignarlos a cada usuario.

## Seguridad
- Solo se publica la clave `sb_publishable_`; nunca la contraseña PostgreSQL ni claves secretas.
- Para invitados se recomienda deshabilitar el registro público en Supabase Auth y usar invitaciones.
- Cada módulo que almacene datos privados necesitará sus propias tablas y RLS.
