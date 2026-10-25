// Netlify submission-created hook: pushes new waitlist signups to Jacob's phone.
//
// SECURITY: an ntfy.sh topic is a bearer secret, not an identifier. ntfy.sh has
// no read authentication on free topics — anyone who learns the string can
// subscribe to https://ntfy.sh/<topic> and silently receive every lead forever.
// This repository is PUBLIC, so the topic must never appear in source, in a
// fallback, in a comment, or in a committed config file.
//
// Set NTFY_TOPIC in Netlify: Site configuration -> Environment variables.
// There is deliberately NO fallback: if the variable is missing we skip the
// push and log loudly, rather than leaking or guessing a topic.
const NTFY_TOPIC = process.env.NTFY_TOPIC;

// Lead guard (_lib/lead-guard.js, shared by all of Jacob's sites): bots that
// never ran the page's JavaScript (no `human` token from js/human-check.js),
// foreign-language runs, "I wanted to know your price", adult/casino/SEO spam.
// Anything it does not deliver gets no phone push; the submission itself is
// still in the Netlify Forms dashboard for review.
const { triage } = require("./_lib/lead-guard.js");

// Fields that are not the visitor's own words, or are passed to triage() by name.
const NOT_TEXT = new Set(["name", "email", "phone", "message", "human", "bot-field", "form-name", "ip", "user_agent", "referrer"]);

function leadGuard(d) {
  const text = Object.entries(d)
    .filter(([k, v]) => !NOT_TEXT.has(k) && typeof v === "string")
    .map(([, v]) => v)
    .join("\n");
  return triage(
    { name: d.name, email: d.email, phone: d.phone, message: d.message, text },
    { human: d.human, honeypot: d["bot-field"], nonEnglish: "drop" }
  );
}

exports.handler = async (event) => {
  try {
    if (!NTFY_TOPIC) {
      console.error(
        "NTFY_TOPIC is not set — push notification skipped. " +
        "Set it in Netlify: Site configuration -> Environment variables. " +
        "The submission itself is still recorded in Netlify Forms."
      );
      return { statusCode: 200, body: "notify-skipped-no-topic" };
    }

    const { payload } = JSON.parse(event.body);
    const form = payload.form_name || "unknown-form";
    const d = payload.data || {};

    const guard = leadGuard(d);
    if (guard.action !== "deliver") {
      console.log(`lead guard: ${guard.action} (${guard.reason}), form ${form}: no push`);
      return { statusCode: 200, body: `guard-${guard.action}` };
    }

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
