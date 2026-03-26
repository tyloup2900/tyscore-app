# TyScore V3 — Developmental Diagnostics for AI Agents

The first platform that goes beyond static trust scores. Detect drift, measure emergence signals, assess Guardian compliance, and check Dream Cycle readiness.

Built on the [Exponential Emergence Hypothesis](https://doi.org/10.5281/zenodo.19120921) (Jeannes, 2026).

## Architecture

```
Client → Netlify (CDN + Functions) → Supabase (PostgreSQL)

public/
  index.html              Landing page

netlify/functions/
  utils.js                Shared: Supabase client, auth, CORS
  health.js               GET  /api/health
  agents-register.js      POST /api/agents-register
  scores-submit.js        POST /api/scores-submit
  scores-get.js           GET  /api/scores-get?agent_id=
  drift-analyze.js        GET  /api/drift-analyze?agent_id=
  emergence-signal.js     GET  /api/emergence-signal?agent_id=
  guardian-assess.js       GET  /api/guardian-assess?agent_id=
  dreamcycle-check.js     GET  /api/dreamcycle-check?agent_id=
  dashboard.js            GET  /api/dashboard?agent_id=
waitlist.js             POST /api/waitlist
  register-free.js        POST /api/register-free
  checkout.js             POST /api/checkout (Stripe)
  stripe-webhook.js       POST /api/stripe-webhook

sql/
  TYSCORE_V3_SCHEMA.sql   8 tables, indexes, cleanup function
```

## Deployment Guide

### 1. Supabase Setup
- Go to supabase.com → create project (or use existing)
- Open SQL Editor → paste contents of `sql/TYSCORE_V3_SCHEMA.sql` → Run
- Copy your Project URL and service_role key

2. Netlify Setup (auto-deploy via GitHub)
- Link site to GitHub repo: tyloup2900/tyscore-app
- Build command: npm install
- Publish directory: public
- Functions directory: netlify/functions
- Set environment variables:
  - SUPABASE_URL
  - SUPABASE_SERVICE_KEY
  - STRIPE_SECRET_KEY
  - STRIPE_PRICE_ID
- Every push to main auto-deploys

### 3. DNS (already configured)
- CNAME: ty-score.com → tyscore-app.netlify.app

### 4. Create your first API key
Insert directly in Supabase SQL Editor:
```sql
INSERT INTO api_keys (key_hash, owner_email, plan, requests_limit)
VALUES (
  encode(sha256('your-secret-api-key-here'::bytea), 'hex'),
  'cyril.jeannes@gmail.com',
  'enterprise',
  999999
);
```
Then use `X-API-Key: your-secret-api-key-here` in requests.

## What makes V3 unique

| Feature | V2 | V3 | Competitors |
|---------|----|----|-------------|
| Trust Score | Yes | Yes | Some |
| Score History | Yes | Yes | Some |
| **Drift Detection** | No | **Yes** | **Nobody** |
| **Emergence Signal** | No | **Yes** | **Nobody** |
| **EEH Stage (1-5)** | No | **Yes** | **Nobody** |
| **Guardian Compliance** | No | **Yes** | **Nobody** |
| **Dream Cycle Readiness** | No | **Yes** | **Nobody** |
| **Ramp-ready Certification** | No | **Yes** | **Nobody** |
| **Health Grade (A-F)** | No | **Yes** | **Nobody** |

## Pricing
- Free: 100 req/day, 1 agent, trust + drift, 7-day history
- Pro ($49/mo): Unlimited, all diagnostics, 90-day history
- Enterprise: Custom, Ramp-ready cert, on-premise option

## License
MIT
## Onboarding (fully automated)
- Free: Click → email → API key generated instantly
- Pro: Click → email → Stripe checkout → payment → API key auto-created
- Enterprise: Contact sales (cyril.jeannes@gmail.com)
