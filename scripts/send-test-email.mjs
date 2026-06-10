// One-off: verify domain-authenticated sending works.
// Usage: node --env-file=.env.local scripts/send-test-email.mjs recipient@example.com
const to = process.argv[2];
if (!to) {
  console.error("Usage: node --env-file=.env.local scripts/send-test-email.mjs <to>");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: process.env.EMAIL_FROM,
    to,
    subject: "QuoteMagic test — quotemagic.app domain verified ✅",
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px">It works.</h2>
      <p style="color:#555">This email was sent from <strong>${process.env.EMAIL_FROM}</strong>
      via Resend with the verified quotemagic.app domain (DKIM + SPF).
      Customer quote emails can now go to any address.</p>
      <p style="margin-top:16px;font-size:12px;color:#999">Sent with QuoteMagic</p>
    </div>`,
  }),
});

const body = await res.json();
console.log(res.status, JSON.stringify(body));
