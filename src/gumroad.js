// Gumroad license verification — fully autonomous monetization.
// Buyers get a license key automatically after purchase; they paste it in the app.
// No Gumroad API key needed for /v2/licenses/verify.

export async function verifyLicense(permalink, licenseKey, incrementUses = false) {
  const body = new URLSearchParams({
    product_permalink: permalink,
    license_key: licenseKey,
    increment_uses_count: String(incrementUses),
  });
  const res = await fetch('https://api.gumroad.com/v2/licenses/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return { valid: false };
  const data = await res.json();
  if (!data.success) return { valid: false };
  const p = data.purchase || {};
  // Refunded / chargebacked / ended subscription => invalid
  const dead =
    p.refunded || p.chargebacked || p.disputed ||
    (p.subscription_ended_at && new Date(p.subscription_ended_at) < new Date()) ||
    (p.subscription_failed_at && new Date(p.subscription_failed_at) < new Date());
  if (dead) return { valid: false, reason: 'ended' };
  return { valid: true, email: p.email || null, purchase: p };
}

// Try premium first, then event pass. Returns {plan, expires, email} or null.
export async function activateLicense(env, licenseKey) {
  const premium = await verifyLicense(env.GUMROAD_PREMIUM_PERMALINK, licenseKey, true);
  if (premium.valid) return { plan: 'premium', expires: null, email: premium.email };
  const event = await verifyLicense(env.GUMROAD_EVENT_PERMALINK, licenseKey, true);
  if (event.valid) {
    const expires = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48h event pass
    return { plan: 'event', expires, email: event.email };
  }
  return null;
}

// Daily cron: re-verify all premium users; downgrade dead subscriptions automatically.
export async function reverifyAll(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, license_key FROM users WHERE plan = 'premium' AND license_key IS NOT NULL"
  ).all();
  for (const u of results || []) {
    try {
      const check = await verifyLicense(env.GUMROAD_PREMIUM_PERMALINK, u.license_key, false);
      if (!check.valid) {
        await env.DB.prepare("UPDATE users SET plan = 'free', plan_expires = NULL WHERE id = ?").bind(u.id).run();
      }
    } catch {
      // network error: keep benefit of the doubt until next run
    }
  }
  // Expire finished event passes
  await env.DB.prepare(
    "UPDATE users SET plan = 'free', plan_expires = NULL WHERE plan = 'event' AND plan_expires < datetime('now')"
  ).run();
}
