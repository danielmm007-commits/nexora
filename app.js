import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";

// Esta clave es PUBLICABLE: el acceso real se controla con las políticas RLS.
const SUPABASE_URL = "https://ynfcchqgiwmpsxjijtco.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EdQMJoXBmGw4hJyJ4DYU9Q_WIBTr5mb";
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (selector) => document.querySelector(selector);
const ui = {
  loading: $("#loading"),
  auth: $("#auth-panel"),
  user: $("#user-panel"),
  admin: $("#admin-panel"),
  logout: $("#logout"),
  account: $("#account-label"),
  notice: $("#notice"),
  tools: $("#tools-grid"),
  empty: $("#empty-tools"),
  count: $("#tool-count"),
  catalog: $("#catalog"),
  userSelect: $("#access-user"),
  utilitySelect: $("#access-tool"),
  accessSummary: $("#access-summary")
};

let activeUser = null;
let isAdmin = false;
let utilities = [];
let profiles = [];
let assignments = [];

function message(text, error = false) {
  ui.notice.textContent = text;
  ui.notice.classList.toggle("error", error);
  ui.notice.hidden = !text;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeUrl(value) {
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol !== "https:" && url.origin !== window.location.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function ensureProfile(user) {
  const { data, error } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const name = user.user_metadata?.full_name || (user.email || "Usuario").split("@")[0];
    const result = await db.from("profiles").insert({ id: user.id, display_name: name });
    if (result.error) throw result.error;
  }
}

function showTools(items) {
  ui.tools.replaceChildren();
  ui.count.textContent = items.length === 1 ? "1 utilitario" : items.length + " utilitarios";
  ui.empty.hidden = items.length !== 0;
  for (const tool of items) {
    const link = safeUrl(tool.href);
    const card = el(link ? "a" : "div", "tool-card");
    if (link) {
      card.href = link;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }
    card.append(
      el("span", "tool-icon", "✧"),
      el("span", "category", tool.category || "General"),
      el("h3", "", tool.title),
      el("p", "", tool.description || "Abrir esta herramienta de NEXORA")
    );
    if (!link) card.append(el("span", "small-note", "Enlace aún no disponible"));
    ui.tools.append(card);
  }
}

function optionsInto(node, values, label) {
  node.replaceChildren(new Option(label, ""));
  for (const item of values) node.add(new Option(item.label, item.value));
}

function renderAdmin() {
  ui.admin.hidden = false;
  optionsInto(
    ui.userSelect,
    profiles.map(p => ({ value: p.id, label: p.display_name + " · " + p.id.slice(0, 8) })),
    "Selecciona un usuario"
  );
  optionsInto(
    ui.utilitySelect,
    utilities.map(t => ({ value: t.id, label: t.title })),
    "Selecciona un utilitario"
  );
  ui.accessSummary.textContent = assignments.length
    ? assignments.length + " permisos asignados actualmente."
    : "Todavía no hay permisos asignados.";
  ui.catalog.replaceChildren();
  if (!utilities.length) {
    ui.catalog.append(el("p", "muted", "Aún no has creado utilitarios."));
    return;
  }
  for (const tool of utilities) {
    const line = el("div", "catalog-item");
    const info = el("div");
    info.append(el("strong", "", tool.title), el("small", "", tool.slug + " · " + tool.category));
    const state = el("span", "status" + (tool.is_enabled ? "" : " off"), tool.is_enabled ? "Habilitado" : "Deshabilitado");
    line.append(info, state);
    ui.catalog.append(line);
  }
}

async function loadAdminData() {
  const [u, p, a] = await Promise.all([
    db.from("utilities").select("id, slug, title, description, category, href, is_enabled").order("title"),
    db.from("profiles").select("id, display_name").order("display_name"),
    db.from("utility_access").select("user_id, utility_id")
  ]);
  if (u.error) throw u.error;
  if (p.error) throw p.error;
  if (a.error) throw a.error;
  utilities = u.data || [];
  profiles = p.data || [];
  assignments = a.data || [];
}

async function refresh() {
  ui.loading.hidden = false;
  ui.auth.hidden = true;
  ui.user.hidden = true;
  ui.admin.hidden = true;
  ui.logout.hidden = true;
  try {
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    activeUser = data.user;
    if (!activeUser) {
      ui.auth.hidden = false;
      ui.account.textContent = "Herramientas compartidas";
      return;
    }
    await ensureProfile(activeUser);
    const { data: admin, error: adminError } = await db.from("admin_users").select("user_id").eq("user_id", activeUser.id).maybeSingle();
    if (adminError) throw adminError;
    isAdmin = !!admin;
    ui.account.textContent = activeUser.email || "Usuario";
    ui.logout.hidden = false;
    ui.user.hidden = false;
    if (isAdmin) {
      await loadAdminData();
    } else {
      const result = await db.from("utilities").select("id, slug, title, description, category, href, is_enabled").order("title");
      if (result.error) throw result.error;
      utilities = result.data || [];
    }
    showTools(utilities.filter(t => t.is_enabled));
    if (isAdmin) renderAdmin();
  } catch (error) {
    console.error("Error de carga NEXORA", error);
    message("No se pudo cargar NEXORA: " + (error.message || "Error de conexión"), true);
  } finally {
    ui.loading.hidden = true;
  }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("");
  const button = $("#login-button");
  button.disabled = true;
  try {
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    $("#password").value = "";
    await refresh();
  } catch (error) {
    message("No se pudo iniciar sesión: " + (error.message || "Comprueba tus credenciales"), true);
  } finally {
    button.disabled = false;
  }
});

ui.logout.addEventListener("click", async () => {
  message("");
  const { error } = await db.auth.signOut();
  if (error) message(error.message, true);
  else await refresh();
});

$("#create-tool").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return message("No tienes permisos de administrador.", true);
  const href = $("#tool-url").value.trim();
  if (!safeUrl(href)) return message("La ruta debe ser local o un enlace HTTPS válido.", true);
  const tool = {
    title: $("#tool-title").value.trim(),
    slug: $("#tool-slug").value.trim().toLowerCase(),
    description: $("#tool-description").value.trim(),
    category: $("#tool-category").value.trim() || "General",
    href,
    is_enabled: $("#tool-enabled").checked
  };
  const { error } = await db.from("utilities").insert(tool);
  if (error) return message("No se pudo guardar: " + error.message, true);
  $("#create-tool").reset();
  message("Utilitario registrado correctamente.");
  await refresh();
});

$("#change-access").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return message("No tienes permisos de administrador.", true);
  const userId = ui.userSelect.value;
  const utilityId = ui.utilitySelect.value;
  if (!userId || !utilityId) return message("Selecciona un usuario y un utilitario.", true);
  const action = event.submitter?.value || "grant";
  const q = db.from("utility_access");
  const { error } = action === "revoke"
    ? await q.delete().eq("user_id", userId).eq("utility_id", utilityId)
    : await q.insert({ user_id: userId, utility_id: utilityId });
  if (error) return message("No se pudo modificar el permiso: " + error.message, true);
  message(action === "revoke" ? "Acceso revocado." : "Acceso concedido.");
  await refresh();
});

refresh();
