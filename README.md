This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Retail Ledger (MVP)

The Retail Ledger module is available only for clients whose `clients.industry` is set to `Retail` (case-insensitive). Non-retail clients will not see it in navigation and are redirected away from `/dashboard/retail-ledger`.

### Data rules
- Money is stored in integer cents.
- Balance rules:
  - Sales increase what a customer owes (positive `balance_change_cents`).
  - Payments decrease what a customer owes (negative `balance_change_cents`).
  - Refunds reduce what a customer owes (negative `balance_change_cents`).
- `total_cents` is positive for sales and negative for payments/refunds.
- Tax is simplified to a single GST/HST-like rate per province (PST/QST complexity is intentionally ignored for MVP).

### Province defaults
The default tax rate comes from `retail_business_settings.province_code`:
- ON 13% (1300 bps), NB/NL/NS/PE 15% (1500 bps), all others 5% (500 bps).

On first use, settings are created automatically using the client’s `state` field as the province code. If missing, it defaults to `ON`.

### Receipts and numbering
Each transaction stores `receipt_prefix` + `receipt_number` for reproducible receipts. The prefix and next number live in `retail_business_settings`.

### SQL
See `supabase/retail_ledger.sql` for tables:
- `retail_customers`
- `retail_transactions`
- `retail_business_settings`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
