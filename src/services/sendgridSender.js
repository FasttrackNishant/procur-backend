import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = 'devnishmac@gmail.com' 
const BATCH_SIZE = 50;

console.log(FROM)
export async function sendRfpToVendors({ rfp, vendors, dryRun = false }) {
  if (!rfp) throw new Error("RFP missing");
  if (!Array.isArray(vendors) || vendors.length === 0) return [];

  const messages = vendors.map((v) => {
    const vendorName = v.name || "Vendor";

    return {
      to: v.email,
      from: FROM,
      subject: `Request for Proposal: ${rfp.title}`,
      text: `Hello ${vendorName},

We invite you to submit a proposal for the following RFP:

Title: ${rfp.title}
Budget: ${rfp.budget ? rfp.budget + " " + (rfp.currency || "") : "Not specified"}
Delivery timeline: ${rfp.deliveryTimeline || "Not specified"}

Brief:
${rfp.naturalLanguageRequest || ""}

Regards,
Procurement team
`,
      html: `<p>Hello <strong>${vendorName}</strong>,</p>
<p>We invite you to submit a proposal for the following RFP:</p>
<ul>
  <li><strong>Title:</strong> ${rfp.title}</li>
  <li><strong>Budget:</strong> ${rfp.budget ? `${rfp.budget} ${rfp.currency || ""}` : "Not specified"}</li>
  <li><strong>Delivery timeline:</strong> ${rfp.deliveryTimeline || "Not specified"}</li>
</ul>
<p><strong>Brief</strong><br/>${(rfp.naturalLanguageRequest || "").replace(/\n/g, "<br/>")}</p>

<p>Regards,<br/>Procurement team</p>`,
      mail_settings: dryRun
        ? { sandbox_mode: { enable: true } }
        : undefined,
    };
  });

  const results = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);

    try {
      await sgMail.send(batch); // passes an array => SendGrid sends multiple
      results.push(
        ...batch.map((m) => ({
          email: m.to,
          status: "sent",
        }))
      );
    } catch (err) {
      console.error("SendGrid error:", err.response?.body || err.message);
      results.push(
        ...batch.map((m) => ({
          email: m.to,
          status: "error",
          error: err.message,
        }))
      );
    }
  }

  return results;
}