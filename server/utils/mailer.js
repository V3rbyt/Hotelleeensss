import nodemailer from "nodemailer";

let transporter = null;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

function baseUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function send(to, subject, intro, actionLabel, url) {
  const html = `
    <div style="font-family:Manrope,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A1714">
      <h2 style="color:#0B3D3A">LocaLens</h2>
      <p>${intro}</p>
      <p><a href="${url}" style="background:#0F6B66;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${actionLabel}</a></p>
      <p style="font-size:13px;color:#666">Se o botão não funcionar, copie este link:<br>${url}</p>
      <p style="font-size:13px;color:#666">Se você não solicitou esta ação, ignore este e-mail.</p>
    </div>`;
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || "LocaLens <no-reply@localhost>",
    to,
    subject,
    text: `${intro}\n\n${actionLabel}: ${url}`,
    html
  });
}

export function sendVerifyEmail(to, token) {
  const url = `${baseUrl()}/verificar.html?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Verifique seu e-mail na LocaLens",
    "Falta um passo para ativar sua conta LocaLens. Confirme seu e-mail clicando abaixo.",
    "Verificar e-mail",
    url
  );
}

export function sendResetEmail(to, token) {
  const url = `${baseUrl()}/recuperar.html?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Recuperação de senha — LocaLens",
    "Recebemos um pedido para redefinir a senha da sua conta LocaLens. Este link expira em 2 horas.",
    "Redefinir senha",
    url
  );
}

export function sendChangeEmail(to, token) {
  const url = `${baseUrl()}/configuracoes.html?confirm_email=${encodeURIComponent(token)}`;
  return send(
    to,
    "Confirme seu novo e-mail — LocaLens",
    "Para concluir a troca de e-mail na sua conta LocaLens, confirme este endereço.",
    "Confirmar novo e-mail",
    url
  );
}
