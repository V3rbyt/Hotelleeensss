import { api } from "./api.js";
import { showAlert as notify } from "./layout.js";

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const recoverForm = document.getElementById("recover-form");
const resetForm = document.getElementById("reset-form");
const verifyForm = document.getElementById("verify-form");
const alertBox = document.getElementById("form-alert");

const urlToken = new URLSearchParams(location.search).get("token");
if (urlToken && resetForm) resetForm.token.value = urlToken;
if (urlToken && verifyForm) verifyForm.token.value = urlToken;

function toggleRoleFields() {
  const role = registerForm?.role?.value;
  document.querySelectorAll("[data-role-field]").forEach((el) => {
    const roles = el.dataset.roleField.split(",");
    el.classList.toggle("hidden", !roles.includes(role));
    el.querySelectorAll("input,textarea,select").forEach((input) => {
      input.disabled = !roles.includes(role);
    });
  });
}

registerForm?.role?.addEventListener("change", toggleRoleFields);
toggleRoleFields();

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: { email: loginForm.email.value, password: loginForm.password.value }
    });
    location.href = "/configuracoes.html";
  } catch (err) {
    notify(alertBox, err.message);
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = registerForm.role.value;
  const body = {
    role,
    email: registerForm.email.value,
    password: registerForm.password.value,
    displayName: registerForm.displayName?.value,
    phone: registerForm.phone?.value,
    cpf: registerForm.cpf?.value,
    cnpj: registerForm.cnpj?.value,
    acceptTerms: registerForm.acceptTerms.checked,
    acceptPrivacy: registerForm.acceptPrivacy.checked,
    professionalName: registerForm.professionalName?.value,
    bio: registerForm.bio?.value,
    languages: registerForm.languages?.value,
    specialties: registerForm.specialties?.value,
    regions: registerForm.regions?.value,
    tourTypes: registerForm.tourTypes?.value,
    services: registerForm.services?.value,
    qualifications: registerForm.qualifications?.value,
    legalName: registerForm.legalName?.value,
    tradeName: registerForm.tradeName?.value,
    description: registerForm.description?.value,
    address: registerForm.address?.value,
    city: registerForm.city?.value,
    state: registerForm.state?.value,
    destinations: registerForm.destinations?.value,
    travelTypes: registerForm.travelTypes?.value,
    website: registerForm.website?.value,
    professionalRegistry: registerForm.professionalRegistry?.value,
    hotelName: registerForm.hotelName?.value,
    neighborhood: registerForm.neighborhood?.value,
    category: registerForm.category?.value,
    amenities: registerForm.amenities?.value,
    accessibility: registerForm.accessibility?.value,
    publicEmail: registerForm.publicEmail?.value
  };
  try {
    const data = await api("/api/auth/register", { method: "POST", body });
    const extra = data.emailVerification?.devToken
      ? ` Token de verificação (SMTP não configurado): ${data.emailVerification.devToken}`
      : "";
    notify(alertBox, (data.emailVerification?.message || "Conta criada.") + extra, "success");
    setTimeout(async () => {
      const file = registerForm.avatar?.files?.[0];
      if (file) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          await api("/api/uploads/avatar", { method: "POST", credentials: "include", headers: { "Content-Type": "multipart/form-data" }, body: fd });
        } catch (err) {
          console.warn("Upload da foto de perfil falhou:", err.message);
        }
      }
      location.href = "/configuracoes.html";
    }, 900);
  } catch (err) {
    notify(alertBox, err.message);
  }
});

recoverForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/api/auth/forgot", { method: "POST", body: { email: recoverForm.email.value } });
    notify(
      alertBox,
      data.devToken ? `${data.message} Token de desenvolvimento: ${data.devToken}` : data.message,
      "success"
    );
  } catch (err) {
    notify(alertBox, err.message);
  }
});

resetForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/api/auth/reset", {
      method: "POST",
      body: { token: resetForm.token.value, password: resetForm.password.value }
    });
    notify(alertBox, data.message, "success");
  } catch (err) {
    notify(alertBox, err.message);
  }
});

verifyForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/verify-email", { method: "POST", body: { token: verifyForm.token.value } });
    notify(alertBox, "E-mail verificado com sucesso. Redirecionando...", "success");
    setTimeout(() => (location.href = "/configuracoes.html"), 1200);
  } catch (err) {
    notify(alertBox, err.message);
  }
});
