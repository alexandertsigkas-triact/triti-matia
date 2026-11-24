import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ClaudeAnalyzer, SampleAnalyzer } from './analyzer.js';
import { createApp } from './app.js';
import { SimulatedBilling, StripeBilling } from './billing.js';
import { openDb } from './db.js';
import { ConsoleMailer } from './mailer.js';

const env = process.env;
const port = Number(env.PORT ?? 3000);
const baseUrl = (env.BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
const production = env.NODE_ENV === 'production';

if (production && !env.SESSION_SECRET) {
  console.error('Set SESSION_SECRET to a long random value before running in production.');
  process.exit(1);
}

const db = openDb(env.DB_PATH ?? 'triti-matia.db');

const analyzer = env.ANTHROPIC_API_KEY
  ? new ClaudeAnalyzer({ apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL ?? 'claude-sonnet-5-5' })
  : new SampleAnalyzer();

const billing = env.STRIPE_SECRET_KEY
  ? new StripeBilling({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
      prices: { personal: env.STRIPE_PRICE_PERSONAL, pro: env.STRIPE_PRICE_PRO },
      baseUrl,
    })
  : new SimulatedBilling({ baseUrl });

// Replace with a real email service before going live (see README).
const mailer = new ConsoleMailer({ showLinks: !production });
if (production) console.warn('Warning: sign-in links are only printed in this log, not emailed. Connect an email service before going live.');

const app = createApp({
  db,
  analyzer,
  billing,
  mailer,
  config: {
    baseUrl,
    sessionSecret: env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
    appHtmlPath: fileURLToPath(new URL('../../index.html', import.meta.url)),
    ccrRegistryPath: env.CCR_REGISTRY_PATH || undefined,
  },
});

app.listen(port, () => {
  console.log(`Τρίτη Ματιά running on ${baseUrl}`);
  console.log(`  analysis: ${analyzer.test ? 'TEST (sample answer, no Claude key)' : `Claude API, model ${analyzer.model}`}`);
  console.log(`  payments: ${billing.simulated ? 'TEST (simulated, no Stripe)' : billing.test ? 'Stripe test mode' : 'Stripe LIVE'}`);
  console.log(`  email:    ${mailer.test ? 'TEST (links shown on screen and printed here)' : 'links printed in this log only'}`);
});
