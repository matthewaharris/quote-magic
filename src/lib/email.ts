import { Resend } from "resend";

// Sends via Resend when RESEND_API_KEY is set; otherwise logs to the server
// console so the flow is testable without an account.
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[email stub] to=${input.to} subject="${input.subject}"\n${input.html}`
    );
    return { ok: true, stubbed: true };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "QuoteMagic <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    console.error("Resend error:", error);
    return { ok: false, stubbed: false };
  }
  return { ok: true, stubbed: false };
}

export function quoteEmailHtml(input: {
  businessName: string;
  title: string;
  total: string;
  url: string;
}) {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 4px">${input.businessName}</h2>
    <p style="margin:0 0 16px;color:#555">sent you a quote</p>
    <div style="border:1px solid #e4e4e7;border-radius:12px;padding:16px">
      <p style="margin:0;font-weight:600">${input.title}</p>
      <p style="margin:8px 0 0;font-size:24px;font-weight:700">${input.total}</p>
    </div>
    <a href="${input.url}" style="display:block;margin-top:16px;background:#18181b;color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:600">
      View &amp; respond to quote
    </a>
    <p style="margin-top:16px;font-size:12px;color:#999">Sent with QuoteMagic</p>
  </div>`;
}
