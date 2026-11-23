# Τρίτη Ματιά — subscription server

This server turns the app into a paid service. People sign in with their email, get a monthly number of analyses according to their plan, and pay by card. The photos are read by Claude through Triact's own API key, so users need no Claude account.

| Plan | Price | Analyses per month |
|---|---|---|
| Free | €0 | 3 |
| Personal | €7.90 | 40 |
| Professional | €24 | 200 |

Change plans and limits in `src/plans.js`. The prices people actually pay are set in Stripe (see below).

## Try it now, in test mode

You need Node.js 22.13 or later.

```bash
cd server
npm install
npm start
```

Open http://localhost:3000. Without any keys, everything runs in **test mode**, and the page says so:

- **Sign-in:** no email is sent. After you enter an address, the page shows the sign-in link to open.
- **Analysis:** a fixed sample answer instead of a real reading by Claude. Usage is still counted, so you can reach the free limit of 3.
- **Payments:** "Choose" opens a test checkout page with a Pay button that charges nothing. "Manage subscription" opens a test page where you can change plan or cancel.

## Going live, step by step

1. **Claude API.** Create an account at platform.claude.com, add a payment method, create an API key and put it in `ANTHROPIC_API_KEY`. Analyses are now real. One analysis costs a few US cents; check the first invoices.
2. **Stripe, test mode first.**
   - Create the two products in the Stripe dashboard (Personal €7.90/month, Professional €24/month) and copy their **price IDs** (`price_…`) into `STRIPE_PRICE_PERSONAL` and `STRIPE_PRICE_PRO`.
   - Put the **test** secret key (`sk_test_…`) in `STRIPE_SECRET_KEY`.
   - Add a webhook endpoint `https://YOUR-ADDRESS/api/billing/webhook` with the events `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`, and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   - Turn on the customer portal (Settings → Billing → Customer portal) and allow plan changes and cancellation.
   - Pay with Stripe's test card 4242 4242 4242 4242 to check the whole flow.
3. **Email.** Replace `ConsoleMailer` in `src/mailer.js` with an email service (for example Postmark, Brevo or Amazon SES). In production the server never shows sign-in links on the page.
4. **Hosting.** Any host that runs Node.js with a persistent disk for the SQLite file, for example a small virtual server or Render/Railway/Fly.io with a volume. Set `NODE_ENV=production`, `BASE_URL` to the https address and a long random `SESSION_SECRET`.
5. **Legal and tax.** Terms of use, a privacy notice and VAT for customers in other EU countries (Stripe Tax can add VAT per country: set `STRIPE_AUTOMATIC_TAX=1` once it is configured). Check these with your accountant and lawyer.
6. **Switch Stripe to live keys** only after the test flow works end to end.

All settings are listed in `.env.example`.

## What is stored

- **Accounts:** email, plan, Stripe customer and subscription IDs.
- **Usage:** how many analyses each account made in each month.
- **Sign-in links:** only a hash, deleted after expiry.

Photos and analyses are **not** stored on the server. The photo is sent to Claude for the analysis only, and the result stays in the person's browser.

## How the code is organised

```
src/
  server.js    starts the server; picks test or real mode from the settings
  app.js       the web routes: sign-in, analysis, plans, Stripe webhook, test payment pages
  method.js    the P·L·T instructions to Claude and the check of its answer
  analyzer.js  Claude API reading, and the sample used in test mode
  billing.js   Stripe Checkout, customer portal and webhook handling, and simulated payments
  auth.js      one-time sign-in links and signed session cookies
  db.js        SQLite storage
  plans.js     plans and monthly limits
  mailer.js    sign-in emails (test version prints them)
test/          tests for sign-in, limits, months, payments and webhooks (npm test)
```

The app page is `../index.html`, the same file that runs inside Claude. When this server delivers it, the page shows sign-in and plans and sends photos to the server instead of to the viewer's own Claude account.
