// EmailJS credentials — shared across all companies.
// Set these in .env (see .env.example). Baked into the build at compile time.
const EMAIL_CONFIG = {
  publicKey:  import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  privateKey: import.meta.env.VITE_EMAILJS_PRIVATE_KEY,
  serviceId:  import.meta.env.VITE_EMAILJS_SERVICE_ID,
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
};

export async function sendInviteEmail({ toEmail, toName, companyName, fromName }) {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  EMAIL_CONFIG.serviceId,
      template_id: EMAIL_CONFIG.templateId,
      user_id:     EMAIL_CONFIG.publicKey,
      // Required when the EmailJS account has "strict mode" enabled
      ...(EMAIL_CONFIG.privateKey ? { accessToken: EMAIL_CONFIG.privateKey } : {}),
      template_params: {
        to_name:      toName,
        to_email:     toEmail,
        company_name: companyName,
        name:         companyName,
        from_name:    fromName || companyName,
        app_name:     'Affinity Ledger',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed (${res.status}): ${text}`);
  }
  return true;
}
