# everyday-apis

A dumping ground for example API endpoints used to test Machine Payments use cases.

## What's here

Throw-away and example APIs that exercise payment flows, auth patterns, and anything else useful for testing. Nothing here is production — it's a scratchpad.

## Auth

Most endpoints require an `x-api-key` header matching the `PAYMENT_PROXY_SECRET` env var.

## Endpoints

| Route | Description |
|---|---|
| `GET /api/weather` | Returns mock weather data |
| `GET /api/funfact` | Returns a random fun fact |

## Running locally

```bash
npm install
npm run dev
```
