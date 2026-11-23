import Stripe from 'stripe';

/**
 * Applies a Stripe event to the account it concerns. Kept separate from Stripe itself
 * so it can be tested with plain objects.
 */
export function applyBillingEvent(db, event, priceToPlan) {
  const o = event.data?.object ?? {};
  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = Number(o.client_reference_id);
      const plan = o.metadata?.plan;
      if (!userId || !priceToPlan.validPlan(plan)) return null;
      db.setPlan(userId, plan, o.customer ?? null, o.subscription ?? null);
      return { userId, plan };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const user = db.userByCustomer(o.customer);
      if (!user) return null;
      const active = ['active', 'trialing', 'past_due'].includes(o.status);
      const price = o.items?.data?.[0]?.price?.id;
      const plan = active ? priceToPlan.planFor(price) ?? user.plan : 'free';
      db.setPlan(user.id, plan, null, active ? o.id : null);
      return { userId: user.id, plan };
    }
    case 'customer.subscription.deleted': {
      const user = db.userByCustomer(o.customer);
      if (!user) return null;
      db.setPlan(user.id, 'free', null, null);
      return { userId: user.id, plan: 'free' };
    }
    default:
      return null;
  }
}

/** Real payments through Stripe Checkout and the Stripe customer portal. Works the same with test (sk_test_…) and live keys. */
export class StripeBilling {
  constructor({ secretKey, webhookSecret, prices, baseUrl }) {
    this.stripe = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
    this.prices = prices; // { personal: 'price_…', pro: 'price_…' }
    this.baseUrl = baseUrl;
    this.test = secretKey.startsWith('sk_test_');
    this.simulated = false;
  }

  validPlan(plan) {
    return Boolean(this.prices[plan]);
  }

  planFor(priceId) {
    return Object.keys(this.prices).find((p) => this.prices[p] === priceId) ?? null;
  }

  async checkoutUrl(user, plan, lang) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.prices[plan], quantity: 1 }],
      client_reference_id: String(user.id),
      ...(user.stripe_customer ? { customer: user.stripe_customer } : { customer_email: user.email }),
      metadata: { plan },
      subscription_data: { metadata: { plan, user_id: String(user.id) } },
      locale: lang === 'en' ? 'en' : 'el',
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === '1' },
      success_url: `${this.baseUrl}/?paid=1`,
      cancel_url: `${this.baseUrl}/?paid=0`,
    });
    return session.url;
  }

  async portalUrl(user) {
    const session = await this.stripe.billingPortal.sessions.create({ customer: user.stripe_customer, return_url: `${this.baseUrl}/` });
    return session.url;
  }

  /** Checks Stripe's signature, then returns the event. Throws if the signature is wrong. */
  parseWebhook(rawBody, signature) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }
}

/**
 * Test mode without a Stripe account: "checkout" is a page on this server with a
 * Pay button that charges nothing. It goes through the same applyBillingEvent path.
 */
export class SimulatedBilling {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
    this.test = true;
    this.simulated = true;
  }
  validPlan(plan) {
    return plan === 'personal' || plan === 'pro';
  }
  planFor(priceId) {
    return priceId?.replace('price_sim_', '') || null;
  }
  async checkoutUrl(_user, plan) {
    return `${this.baseUrl}/test-checkout?plan=${encodeURIComponent(plan)}`;
  }
  async portalUrl() {
    return `${this.baseUrl}/test-portal`;
  }
}
