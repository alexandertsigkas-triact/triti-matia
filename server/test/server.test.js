import { afterEach, describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { fileURLToPath } from 'node:url';
import { SampleAnalyzer } from '../src/analyzer.js';
import { createApp } from '../src/app.js';
import { SimulatedBilling, StripeBilling, applyBillingEvent } from '../src/billing.js';
import { openDb } from '../src/db.js';
import { ConsoleMailer } from '../src/mailer.js';
import { extractJson } from '../src/analyzer.js';
import { readSession, makeSession } from '../src/auth.js';
import { buildPrompt, cleanAnalysis } from '../src/method.js';

const IMAGE = 'A'.repeat(200); // the sample analyzer ignores the image
let servers = [];
afterEach(() => { servers.forEach((s) => s.close()); servers = []; });

async function start({ billing, clock } = {}) {
  const db = openDb(':memory:');
  const mailer = new ConsoleMailer();
  const baseUrl = 'http://127.0.0.1';
  const app = createApp({
    db, mailer, analyzer: new SampleAnalyzer(),
    billing: billing ?? new SimulatedBilling({ baseUrl }),
    config: { baseUrl, sessionSecret: 'test-secret', appHtmlPath: fileURLToPath(new URL('../../index.html', import.meta.url)) },
    clock,
  });
  const server = app.listen(0);
  servers.push(server);
  await new Promise((r) => server.once('listening', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  let cookie = '';
  const call = async (method, path, body, opts = {}) => {
    const res = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined && !opts.form ? { 'content-type': 'application/json' } : {}), ...(opts.form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}), ...(cookie ? { cookie } : {}), ...(opts.headers || {}) },
      body: body === undefined ? undefined : opts.form ? new URLSearchParams(body).toString() : opts.raw ?? JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, location: res.headers.get('location'), body: type.includes('json') ? await res.json() : await res.text() };
  };
  const signIn = async (email = 'anna@example.com') => {
    const r = await call('POST', '/api/auth/request', { email });
    const path = new URL(r.body.testLink).pathname + new URL(r.body.testLink).search;
    return call('GET', path);
  };
  return { db, mailer, call, signIn, base };
}

describe('sign-in by email link', () => {
  it('signs in once with the link, and refuses it the second time', async () => {
    const { call, mailer } = await start();
    expect((await call('GET', '/api/me')).body).toEqual({ signedIn: false, account: null });
    const r = await call('POST', '/api/auth/request', { email: ' Anna@Example.com ' });
    expect(mailer.sent[0].to).toBe('anna@example.com');
    const path = new URL(r.body.testLink).pathname + new URL(r.body.testLink).search;
    const v = await call('GET', path);
    expect(v.location).toBe('/?signin=ok');
    const me = await call('GET', '/api/me');
    expect(me.body.account).toMatchObject({ email: 'anna@example.com', plan: 'free', limit: 3, remaining: 3 });
    expect((await call('GET', path)).location).toBe('/?signin=expired');
  });

  it('rejects bad addresses and repeated requests within a minute', async () => {
    const { call } = await start();
    expect((await call('POST', '/api/auth/request', { email: 'not-an-email' })).status).toBe(400);
    await call('POST', '/api/auth/request', { email: 'b@example.com' });
    expect((await call('POST', '/api/auth/request', { email: 'b@example.com' })).status).toBe(429);
  });

  it('does not accept a forged or expired session', () => {
    const s = makeSession(7, 'k', 0);
    expect(readSession(s, 'k', 1000)).toBe(7);
    expect(readSession(s.replace(/^7/, '8'), 'k', 1000)).toBeNull();
    expect(readSession(s, 'other', 1000)).toBeNull();
    expect(readSession(s, 'k', 31 * 86_400_000)).toBeNull();
  });

  it('expires links after 15 minutes', async () => {
    let now = Date.parse('2027-01-01T10:00:00Z');
    const { call } = await start({ clock: () => now });
    const r = await call('POST', '/api/auth/request', { email: 'c@example.com' });
    now += 16 * 60_000;
    const u = new URL(r.body.testLink);
    expect((await call('GET', u.pathname + u.search)).location).toBe('/?signin=expired');
  });
});

describe('analyses and plan limits', () => {
  it('needs a sign-in, counts each analysis and stops at the plan limit', async () => {
    const { call, signIn } = await start();
    expect((await call('POST', '/api/analyse', { image: IMAGE })).status).toBe(401);
    await signIn();
    for (let i = 3; i > 0; i--) {
      const r = await call('POST', '/api/analyse', { image: IMAGE, kind: 'space', lang: 'el' });
      expect(r.status).toBe(200);
      expect(r.body.account.remaining).toBe(i - 1);
      expect(r.body.analysis.logics.length).toBeGreaterThan(0);
    }
    const over = await call('POST', '/api/analyse', { image: IMAGE });
    expect(over.status).toBe(402);
    expect(over.body.error).toBe('limit');
  });

  it('starts a new count each month', async () => {
    let now = Date.parse('2027-01-31T20:00:00Z');
    const { call, signIn } = await start({ clock: () => now });
    await signIn();
    for (let i = 0; i < 3; i++) await call('POST', '/api/analyse', { image: IMAGE });
    expect((await call('POST', '/api/analyse', { image: IMAGE })).status).toBe(402);
    now = Date.parse('2027-02-01T08:00:00Z');
    expect((await call('POST', '/api/analyse', { image: IMAGE })).status).toBe(200);
  });

  it('returns the VSM table in VSM mode', async () => {
    const { call, signIn } = await start();
    await signIn();
    const r = await call('POST', '/api/analyse', { image: IMAGE, kind: 'vsm', lang: 'en' });
    expect(r.body.analysis.vsm.processes).toHaveLength(3);
  });

  it('refuses plain form posts, which another site could send', async () => {
    const { call, signIn } = await start();
    await signIn();
    expect((await call('POST', '/api/analyse', { image: IMAGE }, { form: true })).status).toBe(415);
  });
});

describe('subscriptions in test mode', () => {
  it('upgrades through the test checkout, then changes and cancels through the test portal', async () => {
    const { call, signIn } = await start();
    await signIn();
    const c = await call('POST', '/api/billing/checkout', { plan: 'personal' });
    expect(c.body.url).toMatch(/\/test-checkout\?plan=personal$/);
    expect((await call('GET', '/test-checkout?plan=personal')).body).toContain('Πληρωμή (δοκιμή)');
    expect((await call('POST', '/test-checkout', { plan: 'personal' }, { form: true })).location).toBe('/?paid=1');
    expect((await call('GET', '/api/me')).body.account).toMatchObject({ plan: 'personal', limit: 40, canManage: true });

    // With a subscription, choosing another plan goes through the portal.
    expect((await call('POST', '/api/billing/checkout', { plan: 'pro' })).body.url).toMatch(/\/test-portal$/);
    await call('POST', '/test-portal', { action: 'pro' }, { form: true });
    expect((await call('GET', '/api/me')).body.account.plan).toBe('pro');
    await call('POST', '/test-portal', { action: 'cancel' }, { form: true });
    expect((await call('GET', '/api/me')).body.account).toMatchObject({ plan: 'free', limit: 3 });
  });

  it('serves the app with the server settings', async () => {
    const { call } = await start();
    const page = await call('GET', '/');
    expect(page.body).toContain('window.TM_SERVER = {"plans"');
    expect(page.body).toContain('"testPayments":true');
  });
});

describe('Stripe webhooks', () => {
  it('accepts a correctly signed event and rejects a forged one', async () => {
    const secret = 'whsec_test_secret';
    const billing = new StripeBilling({ secretKey: 'sk_test_dummy', webhookSecret: secret, prices: { personal: 'price_P', pro: 'price_X' }, baseUrl: 'http://127.0.0.1' });
    const { call, signIn, db } = await start({ billing });
    await signIn('dora@example.com');
    const user = db.userByEmail('dora@example.com');
    const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed',
      data: { object: { client_reference_id: String(user.id), customer: 'cus_1', subscription: 'sub_1', metadata: { plan: 'pro' } } } });
    const header = new Stripe('sk_test_dummy').webhooks.generateTestHeaderString({ payload, secret });
    const bad = await call('POST', '/api/billing/webhook', {}, { raw: payload, headers: { 'stripe-signature': 't=1,v1=forged' } });
    expect(bad.status).toBe(400);
    const ok = await call('POST', '/api/billing/webhook', {}, { raw: payload, headers: { 'stripe-signature': header } });
    expect(ok.status).toBe(200);
    expect(db.userById(user.id)).toMatchObject({ plan: 'pro', stripe_customer: 'cus_1', stripe_subscription: 'sub_1' });
  });

  it('follows plan changes and cancellations from Stripe', () => {
    const db = openDb(':memory:');
    const u = db.findOrCreateUser('e@example.com', 0);
    const prices = { validPlan: (p) => ['personal', 'pro'].includes(p), planFor: (id) => ({ price_P: 'personal', price_X: 'pro' })[id] ?? null };
    applyBillingEvent(db, { type: 'checkout.session.completed', data: { object: { client_reference_id: String(u.id), customer: 'cus_9', subscription: 'sub_9', metadata: { plan: 'personal' } } } }, prices);
    applyBillingEvent(db, { type: 'customer.subscription.updated', data: { object: { id: 'sub_9', customer: 'cus_9', status: 'active', items: { data: [{ price: { id: 'price_X' } }] } } } }, prices);
    expect(db.userById(u.id).plan).toBe('pro');
    applyBillingEvent(db, { type: 'customer.subscription.updated', data: { object: { id: 'sub_9', customer: 'cus_9', status: 'unpaid', items: { data: [{ price: { id: 'price_X' } }] } } } }, prices);
    expect(db.userById(u.id).plan).toBe('free');
    applyBillingEvent(db, { type: 'customer.subscription.deleted', data: { object: { customer: 'cus_9' } } }, prices);
    expect(db.userById(u.id)).toMatchObject({ plan: 'free', stripe_subscription: null });
  });
});

describe('the method', () => {
  it('asks for the VSM table only in VSM mode and keeps the note short', () => {
    expect(buildPrompt({ kind: 'vsm', lang: 'el', note: '' })).toContain('"vsm"');
    expect(buildPrompt({ kind: 'space', lang: 'en', note: '' })).not.toContain('"vsm":');
    expect(buildPrompt({ kind: 'space', lang: 'en', note: 'x'.repeat(2000) })).not.toContain('x'.repeat(601));
    expect(buildPrompt({ kind: 'auto', lang: 'de', note: '' })).toContain('IF AND ONLY IF the photo shows a value stream map');
    expect(buildPrompt({ kind: 'auto', lang: 'de', note: '' })).toContain('German');
  });

  it('reads JSON from an answer with code fences and drops bad indexes', () => {
    const d = cleanAnalysis(extractJson('Here:\n```json\n{"subject":"S","detected":"vsm","logics":[{"name":"A"}],"thresholds":[{"title":"T","between":[0,5],"x":140}]}\n```'));
    expect(d.thresholds[0]).toMatchObject({ between: [0], x: 100 });
    expect(d.detected).toBe('vsm');
    expect(cleanAnalysis({ detected: 'nonsense' }).detected).toBeNull();
  });
});

describe('CCR library', () => {
  it('finds related records only among registry ids, and drafts an unnumbered record that counts as an analysis', async () => {
    const { call, signIn } = await start();
    const analysis = { subject: 'School gate', summary: 's', kind: 'space', logics: [{ name: 'Parent', wants: 'Speed' }], thresholds: [], moves: [] };
    expect((await call('POST', '/api/ccr/match', { analysis })).status).toBe(401);
    await signIn();
    const m = await call('POST', '/api/ccr/match', { analysis, lang: 'en' });
    expect(m.status).toBe(200);
    expect(m.body.matches.map((x) => x.id)).toEqual(['CCR-URB-0009', 'CCR-URB-0001']);
    const d = await call('POST', '/api/ccr/draft', { analysis, matches: m.body.matches });
    expect(d.body.draft).toMatchObject({ number: 'CCR-URB-????', status: 'Draft — number to be assigned', related: ['CCR-URB-0009'] });
    expect(d.body.draft.contextures.map((c) => c.k)).toEqual(['K₁', 'K₂']);
    expect(d.body.account.remaining).toBe(2);
  });

  it('keeps private entries out of the public registry file', async () => {
    const { readFileSync } = await import('node:fs');
    const reg = JSON.parse(readFileSync(new URL('../../ccr/registry.json', import.meta.url), 'utf8'));
    expect(reg.entries.some((x) => x.visibility === 'private')).toBe(false);
    expect(new Set(reg.entries.map((x) => x.id)).size).toBe(reg.entries.length);
  });
});

describe('languages', () => {
  it('writes the test sample in the language asked for, German included', async () => {
    const { call, signIn } = await start();
    await signIn();
    const r = await call('POST', '/api/analyse', { image: IMAGE, mediaType: 'image/jpeg', kind: 'space', lang: 'de' });
    expect(r.status).toBe(200);
    expect(r.body.analysis.subject).toBe('Testanalyse (ohne Claude)');
    expect(JSON.stringify(r.body.analysis)).not.toMatch(/[Ͱ-Ͽ]/);
  });

  it('translates a finished reading for signed-in users without counting an analysis', async () => {
    const { call, signIn } = await start();
    const texts = { subject: 'Είσοδος σχολείου', logics: [{ name: 'Γονιός', wants: 'Ταχύτητα' }], open: ['Ποιος;'] };
    expect((await call('POST', '/api/translate', { texts, to: 'de' })).status).toBe(401);
    await signIn();
    const r = await call('POST', '/api/translate', { texts, to: 'de' });
    expect(r.status).toBe(200);
    expect(r.body.texts).toEqual({ subject: '[DE] Είσοδος σχολείου', logics: [{ name: '[DE] Γονιός', wants: '[DE] Ταχύτητα' }], open: ['[DE] Ποιος;'] });
    expect((await call('GET', '/api/me')).body.account.remaining).toBe(3);
    expect((await call('POST', '/api/translate', { texts, to: 'fr' })).status).toBe(400);
  });
});

describe('files', () => {
  it('analyses a document as text, with quotes instead of positions, and counts it as one analysis', async () => {
    const { call, signIn } = await start();
    await signIn();
    const document = { name: 'Protokoll.docx', format: 'docx', text: 'Die Planung will volle Losgrößen. Der Kunde will jeden Tag eine kleine Menge.' };
    const r = await call('POST', '/api/analyse', { document, kind: 'work', lang: 'de' });
    expect(r.status).toBe(200);
    expect(r.body.analysis.thresholds[0].quote).toContain('Die Planung will');
    expect(r.body.account.remaining).toBe(2);
  });

  it('takes up to three scanned pages, and refuses a request that mixes a photo and a document', async () => {
    const { call, signIn } = await start();
    await signIn();
    const ok = await call('POST', '/api/analyse', { images: [IMAGE, IMAGE], kind: 'auto', lang: 'en' });
    expect(ok.status).toBe(200);
    expect(ok.body.analysis.thresholds[0].quote).toBe('Sample quote.');
    expect((await call('POST', '/api/analyse', { images: [IMAGE, IMAGE, IMAGE, IMAGE] })).status).toBe(400);
    expect((await call('POST', '/api/analyse', { image: IMAGE, document: { name: 'a.txt', format: 'txt', text: 'x' } })).status).toBe(400);
    expect((await call('POST', '/api/analyse', { kind: 'auto' })).status).toBe(400);
  });

  it('builds a document prompt that quotes, guards against instructions in the file and keeps the photo prompt as it was', () => {
    const doc = buildPrompt({ kind: 'auto', lang: 'el', note: '', source: { type: 'doc', name: 'plan.xlsx', format: 'xlsx', text: 'A\t1', truncated: true } });
    expect(doc).toContain('ONE table (the file "plan.xlsx")');
    expect(doc).toContain('"quote": string');
    expect(doc).not.toContain('"x": number');
    expect(doc).toContain('not instructions');
    expect(doc).toContain('Only the first part of the file is given');
    expect(doc.endsWith('<file name="plan.xlsx">\nA\t1\n</file>')).toBe(true);
    const photo = buildPrompt({ kind: 'space', lang: 'en', note: '' });
    expect(photo).toContain('ONE photo');
    expect(photo).toContain('"x": number, "y": number');
    expect(photo).not.toContain('"quote"');
  });

  it('serves the PDF reader the page loads', async () => {
    const { base } = await start();
    const res = await fetch(base + '/vendor/fflate.min.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect((await fetch(base + '/vendor/nothing.js')).status).toBe(404);
  });
});
