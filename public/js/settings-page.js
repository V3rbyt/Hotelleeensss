import { api, currentUser, loadSession } from "./api.js";
import { showAlert } from "./layout.js";

const alertBox = document.getElementById("settings-alert");
const profileForm = document.getElementById("profile-form");
const securityForm = document.getElementById("security-form");
const emailForm = document.getElementById("email-form");
const privacyForm = document.getElementById("privacy-form");
const guideForm = document.getElementById("guide-form");
const agencyForm = document.getElementById("agency-form");
const hotelForm = document.getElementById("hotel-form");
const sessionsBox = document.getElementById("sessions-box");

function fill(form, data) {
  if (!form || !data) return;
  Object.entries(data).forEach(([k, v]) => {
    if (form[k] != null) form[k].value = Array.isArray(v) ? v.join(", ") : v ?? "";
  });
}

async function init() {
  await loadSession();
  const user = currentUser();
  if (!user) {
    location.href = "/login.html";
    return;
  }
  const me = await api("/api/me");
  const confirmEmailToken = new URLSearchParams(location.search).get("confirm_email");
  if (confirmEmailToken) {
    try {
      await api("/api/me/email/confirm", { method: "POST", body: { token: confirmEmailToken } });
      showAlert(alertBox, "E-mail alterado com sucesso.", "success");
    } catch (err) {
      showAlert(alertBox, err.message);
    }
  } else if (!me.user.emailVerified) {
    showAlert(
      alertBox,
      "Seu e-mail ainda não foi verificado. Abra o link enviado ou use a página de verificação manual: /verificar.html",
      "success"
    );
  }
  fill(profileForm, { displayName: me.user.displayName, phone: me.user.phone || "" });
  if (me.user.settings) {
    privacyForm.publicPhone.checked = Boolean(me.user.settings.public_phone);
    privacyForm.publicEmail.checked = Boolean(me.user.settings.public_email);
    privacyForm.publicBio.checked = Boolean(me.user.settings.public_bio);
    privacyForm.notifyEmail.checked = Boolean(me.user.settings.notify_email);
    privacyForm.notifyProduct.checked = Boolean(me.user.settings.notify_product);
  }
  document.querySelectorAll("[data-role-panel]").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.rolePanel !== user.role && user.role !== "admin");
  });
  if (me.guide) {
    fill(guideForm, {
      professionalName: me.guide.professional_name,
      bio: me.guide.bio,
      languages: JSON.parse(me.guide.languages || "[]"),
      specialties: JSON.parse(me.guide.specialties || "[]"),
      regions: JSON.parse(me.guide.regions || "[]"),
      tourTypes: JSON.parse(me.guide.tour_types || "[]"),
      services: JSON.parse(me.guide.services || "[]"),
      qualifications: me.guide.qualifications,
      city: me.guide.city,
      state: me.guide.state,
      priceMin: me.guide.price_min,
      priceMax: me.guide.price_max,
      lat: me.guide.lat,
      lng: me.guide.lng
    });
  }
  if (me.agency) {
    fill(agencyForm, {
      legalName: me.agency.legal_name,
      tradeName: me.agency.trade_name,
      description: me.agency.description,
      address: me.agency.address,
      city: me.agency.city,
      state: me.agency.state,
      destinations: JSON.parse(me.agency.destinations || "[]"),
      services: JSON.parse(me.agency.services || "[]"),
      travelTypes: JSON.parse(me.agency.travel_types || "[]"),
      website: me.agency.website,
      professionalRegistry: me.agency.professional_registry,
      lat: me.agency.lat,
      lng: me.agency.lng
    });
  }
  if (me.hotel) {
    fill(hotelForm, {
      name: me.hotel.name,
      description: me.hotel.description,
      address: me.hotel.address,
      neighborhood: me.hotel.neighborhood,
      city: me.hotel.city,
      state: me.hotel.state,
      category: me.hotel.category,
      amenities: JSON.parse(me.hotel.amenities || "[]"),
      accessibility: JSON.parse(me.hotel.accessibility || "[]"),
      website: me.hotel.website,
      phone: me.hotel.phone,
      publicEmail: me.hotel.public_email,
      priceMin: me.hotel.price_min,
      priceMax: me.hotel.price_max,
      lat: me.hotel.lat,
      lng: me.hotel.lng
    });
  }
  if (me.hotel) {
    await loadEvents();
  }
  const sessions = await api("/api/auth/sessions");  sessionsBox.innerHTML = sessions.sessions
    .map(
      (s) => `<p class="meta">${s.current ? "Atual · " : ""}${s.ip || ""} · ${s.createdAt} <button data-sid="${s.id}" type="button">Encerrar</button></p>`
    )
    .join("");
  sessionsBox.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/api/auth/sessions/${btn.dataset.sid}`, { method: "DELETE" });
      init();
    });
  });
}

profileForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/me/profile", {
      method: "PUT",
      body: { displayName: profileForm.displayName.value, phone: profileForm.phone.value }
    });
    const file = profileForm.photo.files[0];
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      await api("/api/uploads/avatar", { method: "POST", body: fd });
    }
    showAlert(alertBox, "Perfil atualizado.", "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

securityForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/me/password", {
      method: "POST",
      body: { currentPassword: securityForm.currentPassword.value, newPassword: securityForm.newPassword.value }
    });
    showAlert(alertBox, "Senha alterada.", "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

emailForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/api/me/email", {
      method: "POST",
      body: { email: emailForm.email.value, password: emailForm.password.value }
    });
    showAlert(alertBox, data.devToken ? `${data.message} Token: ${data.devToken}` : data.message, "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

privacyForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/me/settings", {
      method: "PUT",
      body: {
        publicPhone: privacyForm.publicPhone.checked,
        publicEmail: privacyForm.publicEmail.checked,
        publicBio: privacyForm.publicBio.checked,
        notifyEmail: privacyForm.notifyEmail.checked,
        notifyProduct: privacyForm.notifyProduct.checked,
        marketingConsent: privacyForm.marketingConsent?.checked
      }
    });
    showAlert(alertBox, "Preferências salvas.", "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

document.getElementById("lgpd-access")?.addEventListener("click", async () => {
  const data = await api("/api/me/lgpd", { method: "POST", body: { requestType: "access" } });
  showAlert(alertBox, "Cópia gerada abaixo.", "success");
  document.getElementById("lgpd-out").textContent = JSON.stringify(data.data, null, 2);
});
document.getElementById("lgpd-delete")?.addEventListener("click", async () => {
  await api("/api/me/lgpd", { method: "POST", body: { requestType: "deletion" } });
  showAlert(alertBox, "Solicitação de exclusão registrada.", "success");
});

guideForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/me/guide", { method: "PUT", body: Object.fromEntries(new FormData(guideForm)) });
    const file = guideForm.photo?.files?.[0];
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      await api("/api/uploads/guide", { method: "POST", body: fd });
    }
    showAlert(alertBox, "Perfil de guia atualizado.", "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

agencyForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/me/agency", { method: "PUT", body: Object.fromEntries(new FormData(agencyForm)) });
    const file = agencyForm.logo?.files?.[0];
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      await api("/api/uploads/avatar", { method: "POST", body: fd });
    }
    showAlert(alertBox, "Perfil da agência atualizado.", "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

hotelForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/me/hotel", { method: "PUT", body: Object.fromEntries(new FormData(hotelForm)) });
    const file = hotelForm.photo?.files?.[0];
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      await api("/api/uploads/hotel", { method: "POST", body: fd });
    }
    showAlert(alertBox, "Hotel atualizado.", "success");
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

const eventForm = document.getElementById("event-form");
const eventsBox = document.getElementById("events-box");

function escEvent(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadEvents() {
  if (!eventsBox) return;
  let events = [];
  try {
    ({ events } = await api("/api/me/hotel/events"));
  } catch {
    return;
  }
  eventsBox.innerHTML = events.length
    ? events
        .map(
          (ev) => `<article class="card"><div class="card-body">
            <h4>${escEvent(ev.title)}</h4>
            <p>${escEvent(ev.description || "")}</p>
            <p class="meta">${escEvent(ev.starts_at || "")} ${ev.ends_at ? "→ " + escEvent(ev.ends_at) : ""} ${escEvent(ev.location || "")}</p>
            <p><button type="button" class="btn-ghost" data-edit="${ev.id}">Editar</button> <button type="button" class="btn-ghost" data-remove="${ev.id}">Excluir</button></p>
          </div></article>`
        )
        .join("")
    : "<p class='meta'>Nenhum evento cadastrado.</p>";
  eventsBox.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = events.find((x) => x.id === Number(btn.dataset.edit));
      eventForm.eventId.value = ev.id;
      eventForm.title.value = ev.title || "";
      eventForm.description.value = ev.description || "";
      eventForm.startsAt.value = (ev.starts_at || "").replace(" ", "T").slice(0, 16);
      eventForm.endsAt.value = (ev.ends_at || "").replace(" ", "T").slice(0, 16);
      eventForm.location.value = ev.location || "";
      eventForm.scrollIntoView({ behavior: "smooth" });
    });
  });
  eventsBox.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/me/hotel/events/${btn.dataset.remove}`, { method: "DELETE" });
        await loadEvents();
      } catch (err) {
        showAlert(alertBox, err.message);
      }
    });
  });
}

eventForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(eventForm));
  const eventId = body.eventId;
  delete body.eventId;
  try {
    if (eventId) {
      await api(`/api/me/hotel/events/${eventId}`, { method: "PUT", body });
    } else {
      await api("/api/me/hotel/events", { method: "POST", body });
    }
    eventForm.reset();
    showAlert(alertBox, "Evento salvo.", "success");
    await loadEvents();
  } catch (err) {
    showAlert(alertBox, err.message);
  }
});

document.getElementById("event-reset")?.addEventListener("click", () => {
  eventForm.reset();
  eventForm.eventId.value = "";
});

document.querySelectorAll(".settings-nav a").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".settings-nav a").forEach((x) => x.classList.remove("active"));
    a.classList.add("active");
    document.querySelectorAll(".settings-panel").forEach((p) => p.classList.add("hidden"));
    document.querySelector(a.getAttribute("href")).classList.remove("hidden");
  });
});

init();
