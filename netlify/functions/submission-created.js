// Runs automatically on every VERIFIED Netlify form submission (waitlist form).
// Pushes the lead instantly to Jacob's phone via the private ntfy topic —
// same pattern as revisions-unlimited and edge-enterprise.
const NTFY_TOPIC = "rentshepherd-leads-5bbf16a3c8923db7";

exports.handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body);
    const form = payload.form_name || "unknown-form";
    const d = payload.data || {};

    const skip = new Set(["ip", "user_agent", "referrer", "bot-field", "form-name", "subject"]);
    const lines = Object.entries(d)
      .filter(([k, v]) => !skip.has(k) && v && typeof v === "string" && v.trim())
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`);

    const title = `RentShepherd LEAD: ${d.name || "unknown"}`;
    const body =
      `${title}\nForm: ${form}\nReceived: ${payload.created_at}\n\n` +
      lines.join("\n") +
      `\n\nReply to: ${d.email || "n/a"}`;

    const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { Title: title, Priority: "high", Tags: "moneybag" },
      body,
    });
    console.log("ntfy delivery:", res.status);
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("notify failed:", err);
    return { statusCode: 200, body: "logged" };
  }
};
