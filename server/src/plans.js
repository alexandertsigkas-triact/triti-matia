/** Subscription plans. Prices are shown to people; Stripe holds the real prices (see README). */
export const PLANS = {
  free: { id: 'free', limit: 3, priceEur: 0, name: { el: 'Δωρεάν', en: 'Free', de: 'Kostenlos' } },
  personal: { id: 'personal', limit: 40, priceEur: 7.9, name: { el: 'Προσωπικό', en: 'Personal', de: 'Persönlich' } },
  pro: { id: 'pro', limit: 200, priceEur: 24, name: { el: 'Επαγγελματικό', en: 'Professional', de: 'Professionell' } },
};

export const PAID = ['personal', 'pro'];

/** Usage is counted per calendar month in UTC, e.g. "2026-11". */
export function monthKey(now) {
  return new Date(now).toISOString().slice(0, 7);
}

export function planOf(user) {
  return PLANS[user?.plan] ?? PLANS.free;
}
