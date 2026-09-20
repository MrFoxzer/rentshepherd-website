// Runs automatically on every VERIFIED Netlify form submission (waitlist form).
//
// SECURITY: this repository is PUBLIC and ntfy.sh topics have no read
// authentication, so the topic name below is effectively public and anyone
// who reads it can subscribe. The push therefore carries NO personal data.
// The lead's name and email live only in the Netlify Forms dashboard, which
// is behind your account login.
//
// Set NTFY_TOPIC in the Netlify UI to rotate onto a fresh topic; the value
// below is the original and stays as a fallback so nothing breaks.
const NTFY_TOPIC = process.env.NTFY_TOPIC || "rentshepherd-leads-5bbf16a3c8923db7";

exports.handler = async (event) => {
  try {
    const { payload } = JSON.parse(event.body);
    const form = payload.form_name || "unknown-form";
    const d = payload.data || {};

    // Non-identifying context only. Never name, email, phone or free text.
    const safe = [];
    if (d.role) safe.push(`Role: ${String(d.role).slice(0, 40)}`);
    if (d["business-type"]) safe.push(`Business type: ${String(d["business-type"]).slice(0, 40)}`);
    if (d.portfolio || d["portfolio-size"]) safe.push(`Portfolio: ${String(d.portfolio || d["portfolio-size"]).slice(0, 40)}`);

    const title = "RentShepherd: new waitlist signup";
    const body =
      `Form: ${form}\nReceived: ${payload.created_at}\n` +
      (safe.length ? safe.join("\n") + "\n" : "") +
      "\nName and email are in the Netlify Forms dashboard.";

    const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { Title: title, Priority: "default", Tags: "inbox_tray" },
      body,
    });
    if (!res.ok) console.error("ntfy delivery failed:", res.status);
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("notify failed:", err);
    return { statusCode: 200, body: "logged" };
  }
};
