import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm";

const recoveryRequested = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" ||
  new URLSearchParams(window.location.search).has("code");
const db = createClient(
  "https://ynfcchqgiwmpsxjijtco.supabase.co",
  "sb_publishable_EdQMJoXBmGw4hJyJ4DYU9Q_WIBTr5mb",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);
const info = document.querySelector("#recovery-info");
const notice = document.querySelector("#notice");
const form = document.querySelector("#reset-form");
const save = document.querySelector("#save-password");
function show(text, error = false) {
  notice.hidden = false;
  notice.textContent = text;
  notice.classList.toggle("error", error);
}
async function verify() {
  if (!recoveryRequested) {
    info.textContent = "Abre esta página desde el enlace de recuperación enviado a tu correo.";
    return;
  }
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      info.textContent = "Este enlace no es válido o ha caducado. Solicita uno nuevo desde NEXORA.";
      return;
    }
    info.textContent = "Ya puedes establecer tu nueva contraseña.";
    form.hidden = false;
  } catch (err) {
    info.textContent = "Este enlace no pudo validarse.";
    show(err.message || "Solicita un nuevo enlace de recuperación.", true);
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#new-password").value;
  const confirmation = document.querySelector("#confirm-password").value;
  if (password !== confirmation) return show("Las contraseñas no coinciden.", true);
  save.disabled = true;
  try {
    const { error } = await db.auth.updateUser({ password });
    if (error) throw error;
    form.hidden = true;
    info.textContent = "Contraseña actualizada correctamente.";
    show("¡Listo! Ya puedes iniciar sesión con tu nueva contraseña.");
    await db.auth.signOut();
  } catch (error) {
    show("No se pudo cambiar la contraseña: " + (error.message || "Inténtalo de nuevo."), true);
  } finally {
    save.disabled = false;
  }
});
await verify();
