# Delicato API Server

This directory contains the Node.js/Express backend that powers the Delicato restaurant dashboards.

## Prerequisites

- Node.js 18+
- MongoDB 6+

## Setup

```
npm install
cp .env.example .env
# update the connection details in .env (MONGODB_URI)

# start MongoDB locally or point to Atlas
node server/seed.js  # optional seed data

# start the dev server
npm run dev
```

The API will listen on `http://localhost:4000` by default.

## Available endpoints

- `GET /api/health` - health check
- `GET /api/menu` - list active menu items
- `POST /api/menu` - create a menu item
- `GET /api/customers/:id/summary` - loyalty, wallet, and reservation overview
- `GET /api/customers/:id/deals` - active deals and redemption status
- `GET /api/customers/:id/activity` - recent reservations, orders, and point transactions
- `GET /api/orders?status=` - recent orders filtered by status
- `PATCH /api/orders/:id/status` - update an order status
- `GET /api/reservations?from=&to=` - list reservations within a window
- `PATCH /api/reservations/:id` - update reservation status/notes

Extend these handlers to cover additional needs (e.g., authentication, payments, media uploads).

