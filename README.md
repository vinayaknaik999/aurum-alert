# 🪙 aurum-alert

> **Headless Gold Price Monitoring Boilerplate & Real-Time Alert Engine.**

`aurum-alert` is a high-performance, minimalist technical showcase designed to monitor gold prices in real-time using a completely serverless architecture.

Built with **Svelte 5 (Runes)** and **Cloudflare Workers**, this project demonstrates how to build a production-grade monitoring tool on the **Cloudflare Free Tier (\$0/mo)**.

---

## 🚀 The "Headless" Evolution

This project is the server-side evolution of the [Myntra Gold Deal Finder Extension](https://github.com/vinayaknaik999/myntra-gold-deal-finder). 

While the extension required an open browser tab, `aurum-alert` runs autonomously in the cloud. It uses a **Cron Trigger** to scrape prices, **KV Storage** to manage subscribers, and the **Web Push Protocol** to hit your phone directly.

---

## 🛠 Tech Stack

- **Frontend**: Svelte 5 (Runes), TypeScript, Static Adapter.
- **Backend**: Cloudflare Workers (TypeScript).
- **Storage**: Cloudflare KV (Key-Value storage for settings).
- **Push**: Native Web Push API (VAPID).
- **Aesthetic**: Terminal-Premium Dark Minimal.

---

## 🛠 Prerequisites

Before you begin, ensure you have:
- A [Cloudflare account](https://dash.cloudflare.com) (the free tier is perfect).
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed on your machine.
- VAPID keys for Web Push. Generate them with: `npx web-push generate-vapid-keys`.

---

## 🧠 Technical Highlights (The "Geek" Stuff)

### 1. The Lightweight Parser
Instead of heavy Selenium or headless browser scraping, we hit server-rendered HTML and extract the inline JSON products array. This is faster, consumes less CPU, and is significantly harder to detect.

### 2. Zero-Server Push API
Most developers think you need Firebase for notifications. This project shows you how to use **VAPID keys** and the native `web-push` protocol to send alerts directly from a Worker to a Service Worker.

### 3. Svelte 5 Runes
Leveraging the power of `$state` and `$derived` for a reactive, lightning-fast UI that feels like a native desktop app.

---

## 🔌 Add Your Own Store

`aurum-alert` is built with a clean **Adapter Pattern**. Want to track gold on Amazon, Flipkart, or a local jeweler? 

Just implement the `BaseAdapter` interface:

```typescript
export interface BaseAdapter {
  fetchProducts(): Promise<any[]>;
  processItems(items: any[]): GoldProduct[];
}
```

PRs for new store adapters are highly encouraged.

---

## 📦 Getting Started

### 1. Setup Worker
```bash
cd worker
npm install
# Update wrangler.toml with your VAPID keys and KV ID
npx wrangler deploy
```

### 2. Setup Frontend
```bash
cd app
npm install
npm run dev
```

---

## 💎 Unlock Pro Features
This boilerplate is a "Lite" edition of the production-grade engine at **[thegolddeals.com](https://thegolddeals.com)**.

The Pro version includes:
- **AJIO & Silver** monitoring.
- **5-minute** ultra-fast alerts (vs 1-hour).
- **Advanced Blinkdeal** keyword detection.
- **Historical Price Charts**.

---

## 📄 License
MIT. Built with ❤️ by [Vinayak Naik](https://github.com/vinayaknaik999).
