import express from 'express';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { z, ZodError } from 'zod';
import { clearCookie, cookieValue, createLoginLink, makeSession, normaliseEmail, readSession, sessionCookie, verifyLoginToken } from './auth.js';
import { applyBillingEvent } from './billing.js';
import { KINDS, translatePrompt } from './method.js';
import { loginEmail } from './mailer.js';
import { PAID, PLANS, monthKey, planOf } from './plans.js';

const CCR = createRequire(import.meta.url)('../../ccr/ccr.js');

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./db.js').openDb>} deps.db
 * @param {{ analyse: Function, test: boolean }} deps.analyzer
 * @param {object} deps.billing  StripeBilling or SimulatedBilling
 * @param {{ send: Function, test: boolean }} deps.mailer
 * @param {{ baseUrl: string, sessionSecret: string, appHtmlPath: string }} deps.config
 * @param {() => number} [deps.clock]
 */
export function createApp({ db, analyzer, billing, mailer, config, clock = () => Date.now() }) {
  // The server may use the full registry, including private entries, from a file kept off the repository.
  const registry = JSON.parse(readFileSync(config.ccrRegistryPath ?? new URL('../../ccr/registry.json', import.meta.url), 'utf8'));
  const app = express();
  const secure = config.baseUrl.startsWith('https://');
  const lastLoginRequest = new Map();

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((body) => { if (!res.headersSent && body !== undefined) res.json(body); }, next);

  const currentUser = (req) => {
    const id = readSession(cookieValue(req.headers.cookie), config.sessionSecret, clock());
    return id ? db.userById(id) : null;
  };
  const requireUser = (req) => {
    const u = currentUser(req);
    if (!u) throw new HttpError(401, 'signin', 'Please sign in first.');
    return u;
  };
  // State-changing calls must be JSON, which a form on another site cannot send.
  const requireJson = (req) => {
    if (!req.is('application/json')) throw new HttpError(415, 'json', 'Send JSON.');
  };

  const account = (u) => {
    const plan = planOf(u);
    const used = db.usage(u.id, monthKey(clock()));
    return {
      email: u.email,
      plan: plan.id,
      limit: plan.limit,
      used,
      remaining: Math.max(0, plan.limit - used),
      canManage: Boolean(u.stripe_customer),
    };
  };

  // Stripe needs the exact raw body to check its signature, so this route comes before express.json().
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), wrap(async (req, res) => {
    if (billing.simulated) throw new HttpError(404, 'not_found', 'Not available in test mode.');
    let event;
    try {
      event = billing.parseWebhook(req.body, req.header('stripe-signature'));
    } catch {
      throw new HttpError(400, 'signature', 'Webhook signature check failed.');
    }
    applyBillingEvent(db, event, billing);
    return { received: true };
  }));

  app.use(express.json({ limit: '13mb' }));
  // The PDF reader and unzipper the page loads when someone chooses a file.
  app.use('/vendor', express.static(join(dirname(config.appHtmlPath), 'vendor'), { maxAge: '7d' }));

  // ── the app page ──
  const page = () => {
    const html = readFileSync(config.appHtmlPath, 'utf8');
    const settings = {
      plans: Object.values(PLANS).map((p) => ({ id: p.id, limit: p.limit, priceEur: p.priceEur, name: p.name })),
      testPayments: billing.test,
      testAnalysis: analyzer.test,
      testMail: mailer.test,
    };
    return html.replace('<head>', `<head>\n<script>window.TM_SERVER = ${JSON.stringify(settings)};</script>`);
  };
  app.get('/', (_req, res) => res.type('html').set('Cache-Control', 'no-store').send(page()));

  // ── sign-in by email link ──
  app.post('/api/auth/request', wrap(async (req) => {
    requireJson(req);
    const body = z.object({ email: z.string(), lang: z.enum(['el', 'en', 'de']).default('el') }).parse(req.body);
    const email = normaliseEmail(body.email);
    if (!email) throw new HttpError(400, 'email', 'That does not look like an email address.');
    const last = lastLoginRequest.get(email) ?? 0;
    if (clock() - last < 60_000) throw new HttpError(429, 'wait', 'A link was sent less than a minute ago. Check your inbox.');
    lastLoginRequest.set(email, clock());
    const link = createLoginLink(db, email, config.baseUrl, clock());
    await mailer.send({ to: email, ...loginEmail(body.lang, link), link });
    // In test mode there is no real email, so the page receives the link directly.
    return mailer.test ? { sent: true, testLink: link } : { sent: true };
  }));

  app.get('/auth/verify', (req, res) => {
    const email = verifyLoginToken(db, req.query.token, clock());
    if (!email) return res.redirect(303, '/?signin=expired');
    const user = db.findOrCreateUser(email, clock());
    res.setHeader('Set-Cookie', sessionCookie(makeSession(user.id, config.sessionSecret, clock()), secure));
    return res.redirect(303, '/?signin=ok');
  });

  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', clearCookie(secure));
    res.json({ ok: true });
  });

  app.get('/api/me', wrap(async (req) => {
    const u = currentUser(req);
    return { signedIn: Boolean(u), account: u ? account(u) : null };
  }));

  // ── analysis ──
  app.post('/api/analyse', wrap(async (req) => {
    requireJson(req);
    const user = requireUser(req);
    const body = z.object({
      image: z.string().min(100).max(8_000_000).optional(),
      images: z.array(z.string().min(100).max(4_000_000)).min(1).max(3).optional(),
      document: z.object({
        name: z.string().max(200), format: z.enum(['txt', 'csv', 'docx', 'xlsx', 'pdf']),
        text: z.string().min(1).max(60_000), truncated: z.boolean().default(false),
      }).optional(),
      mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
      kind: z.enum(KINDS).default('auto'),
      lang: z.enum(['el', 'en', 'de']).default('el'),
      note: z.string().max(600).default(''),
    }).refine((b) => [b.image, b.images, b.document].filter(Boolean).length === 1, 'Send one photo, scanned pages or one document.').parse(req.body);

    const month = monthKey(clock());
    const plan = planOf(user);
    if (db.usage(user.id, month) >= plan.limit) {
      throw new HttpError(402, 'limit', `You have used all ${plan.limit} analyses of your plan this month.`);
    }
    let result;
    try {
      const images = body.image ? [body.image] : body.images || [];
      const source = body.document ? { type: 'doc', ...body.document } : body.images ? { type: 'pages', count: images.length } : { type: 'photo' };
      result = await analyzer.analyse({ images, mediaType: body.mediaType, source, kind: body.kind, lang: body.lang, note: body.note });
    } catch (err) {
      console.error('Analysis failed:', err?.status ?? '', err?.message ?? err);
      throw new HttpError(502, 'analysis', 'The analysis did not finish. Please try again.');
    }
    // Count only analyses that were delivered. Neither the photo nor the file is kept.
    db.addUsage(user.id, month);
    return { analysis: result.analysis, account: account(db.userById(user.id)) };
  }));

  // ── CCR library: related records and draft records ──
  const ccrBody = z.object({
    analysis: z.object({ subject: z.string().max(300), summary: z.string().max(2000).optional(), kind: z.string().max(10).optional(),
      logics: z.array(z.any()).max(6), thresholds: z.array(z.any()).max(6), moves: z.array(z.any()).max(6), falseFix: z.string().max(1000).optional() }).passthrough(),
    lang: z.enum(['el', 'en', 'de']).default('el'),
    matches: z.array(z.object({ id: z.string() }).passthrough()).max(3).default([]),
  });

  app.post('/api/ccr/match', wrap(async (req) => {
    requireJson(req);
    requireUser(req);
    const { analysis, lang } = ccrBody.parse(req.body);
    try {
      return { matches: CCR.cleanMatches(await analyzer.completeJson(CCR.matchPrompt(analysis, registry, lang)), registry) };
    } catch (err) {
      console.error('CCR match failed:', err?.message ?? err);
      throw new HttpError(502, 'ccr', 'The comparison did not finish. Please try again.');
    }
  }));

  // A draft is a full model answer, so it counts as one analysis of the month.
  app.post('/api/ccr/draft', wrap(async (req) => {
    requireJson(req);
    const user = requireUser(req);
    const { analysis, matches } = ccrBody.parse(req.body);
    const month = monthKey(clock());
    const plan = planOf(user);
    if (db.usage(user.id, month) >= plan.limit) throw new HttpError(402, 'limit', `You have used all ${plan.limit} analyses of your plan this month.`);
    let draft;
    try {
      draft = CCR.cleanDraft(await analyzer.completeJson(CCR.draftPrompt(analysis, matches)), registry);
    } catch (err) {
      console.error('CCR draft failed:', err?.message ?? err);
      throw new HttpError(502, 'ccr', 'The draft did not finish. Please try again.');
    }
    db.addUsage(user.id, month);
    return { draft, account: account(db.userById(user.id)) };
  }));

  // ── translation of a finished reading (text only; free for signed-in users) ──
  const trBody = z.object({ texts: z.record(z.any()).refine((v) => JSON.stringify(v).length <= 20000, 'too long'), to: z.enum(['el', 'en', 'de']) });
  app.post('/api/translate', wrap(async (req) => {
    requireJson(req);
    requireUser(req);
    const { texts, to } = trBody.parse(req.body);
    try {
      return { texts: await analyzer.completeJson(translatePrompt(texts, to)) };
    } catch (err) {
      console.error('Translation failed:', err?.message ?? err);
      throw new HttpError(502, 'translate', 'The translation did not finish. Please try again.');
    }
  }));

  // ── subscriptions ──
  app.post('/api/billing/checkout', wrap(async (req) => {
    requireJson(req);
    const user = requireUser(req);
    const { plan, lang } = z.object({ plan: z.enum(PAID), lang: z.enum(['el', 'en', 'de']).default('el') }).parse(req.body);
    if (!billing.validPlan(plan)) throw new HttpError(400, 'plan', 'This plan is not on sale yet.');
    if (user.plan === plan) throw new HttpError(409, 'same', 'You already have this plan.');
    if (user.stripe_subscription) return { url: await billing.portalUrl(user) };
    return { url: await billing.checkoutUrl(user, plan, lang) };
  }));

  app.post('/api/billing/portal', wrap(async (req) => {
    requireJson(req);
    const user = requireUser(req);
    if (!user.stripe_customer) throw new HttpError(400, 'no_subscription', 'There is no subscription to manage.');
    return { url: await billing.portalUrl(user) };
  }));

  // ── test-mode payment pages (only without Stripe) ──
  if (billing.simulated) {
    const shell = (title, body) => `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
      <style>body{font:16px/1.5 system-ui,sans-serif;background:#f2f4f3;color:#17252b;margin:0;padding:24px}main{max-width:420px;margin:0 auto;background:#fff;border:1px solid #d6dddb;border-radius:14px;padding:20px;display:grid;gap:14px}
      .tag{font:700 11px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#d9572b}button,a.b{font:600 15px system-ui;padding:11px 16px;border-radius:10px;border:1px solid #14313a;background:#14313a;color:#fff;cursor:pointer;text-decoration:none;text-align:center}
      a.b.g{background:#fff;color:#14313a}</style></head><body><main>${body}</main></body></html>`;

    app.get('/test-checkout', (req, res) => {
      const user = currentUser(req);
      const plan = PLANS[req.query.plan];
      if (!user || !plan || !PAID.includes(plan.id)) return res.redirect(303, '/');
      res.type('html').send(shell('Δοκιμαστική πληρωμή', `<p class="tag">Δοκιμαστική πληρωμή · καμία χρέωση</p>
        <h1 style="margin:0;font-size:22px">${plan.name.el}</h1>
        <p>${plan.limit} αναλύσεις τον μήνα · ${plan.priceEur.toFixed(2).replace('.', ',')} € / μήνα</p>
        <p style="color:#5b6b70;font-size:14px">Εδώ θα εμφανιζόταν η σελίδα πληρωμής της Stripe με κάρτα. Σε δοκιμαστική λειτουργία δεν ζητείται κάρτα.</p>
        <form method="post" action="/test-checkout"><input type="hidden" name="plan" value="${plan.id}"><button style="width:100%">Πληρωμή (δοκιμή)</button></form>
        <a class="b g" href="/?paid=0">Άκυρο</a>`));
    });

    app.post('/test-checkout', express.urlencoded({ extended: false }), (req, res) => {
      const user = currentUser(req);
      if (!user || !billing.validPlan(req.body.plan)) return res.redirect(303, '/');
      applyBillingEvent(db, {
        type: 'checkout.session.completed',
        data: { object: { client_reference_id: String(user.id), customer: `cus_test_${user.id}`, subscription: `sub_test_${user.id}`, metadata: { plan: req.body.plan } } },
      }, billing);
      res.redirect(303, '/?paid=1');
    });

    app.get('/test-portal', (req, res) => {
      const user = currentUser(req);
      if (!user || !user.stripe_customer) return res.redirect(303, '/');
      const plan = planOf(user);
      const other = plan.id === 'pro' ? PLANS.personal : PLANS.pro;
      res.type('html').send(shell('Διαχείριση συνδρομής (δοκιμή)', `<p class="tag">Δοκιμαστική διαχείριση συνδρομής</p>
        <h1 style="margin:0;font-size:22px">${plan.name.el}</h1>
        <p style="color:#5b6b70;font-size:14px">Εδώ θα εμφανιζόταν η πύλη πελάτη της Stripe: αλλαγή κάρτας, τιμολόγια, αλλαγή ή ακύρωση συνδρομής.</p>
        <form method="post" action="/test-portal"><input type="hidden" name="action" value="${other.id}"><button style="width:100%">Αλλαγή σε ${other.name.el}</button></form>
        <form method="post" action="/test-portal"><input type="hidden" name="action" value="cancel"><button style="width:100%;background:#fff;color:#d9572b;border-color:#d9572b">Ακύρωση συνδρομής</button></form>
        <a class="b g" href="/">Επιστροφή</a>`));
    });

    app.post('/test-portal', express.urlencoded({ extended: false }), (req, res) => {
      const user = currentUser(req);
      if (!user || !user.stripe_customer) return res.redirect(303, '/');
      const action = req.body.action;
      const event = action === 'cancel'
        ? { type: 'customer.subscription.deleted', data: { object: { customer: user.stripe_customer } } }
        : { type: 'customer.subscription.updated', data: { object: { id: user.stripe_subscription, customer: user.stripe_customer, status: 'active', items: { data: [{ price: { id: `price_sim_${action}` } }] } } } };
      applyBillingEvent(db, event, billing);
      res.redirect(303, '/');
    });
  }

  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err instanceof ZodError) return res.status(400).json({ error: 'invalid', message: err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large', message: 'The photo is too large.' });
    console.error(err);
    return res.status(500).json({ error: 'internal', message: 'Something went wrong on our side.' });
  });

  return app;
}
