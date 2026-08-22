# Deploying Telegram Signal Verifier to Vercel (with PostgreSQL Caching)

This guide walks you through deploying your Next.js Telegram Signal Verifier application to [Vercel](https://vercel.com) with a **100% Free PostgreSQL Database (Vercel Postgres / Neon)** for signal caching.

---

## 1. Prerequisites

Before deploying, ensure you have:
1. A **[Vercel account](https://vercel.com/signup)** (Hobby tier is 100% free).
2. A **[GitHub](https://github.com/)** account.
3. Your Telegram credentials and session string:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `TELEGRAM_SESSION`

---

## 2. Serverless & Caching Architecture

* **PostgreSQL Signal Cache:** Historical messages (> 30 days old) and completed Dukascopy backtest simulations are stored in PostgreSQL. Once verified, old signals load instantaneously without contacting Telegram or Dukascopy.
* **Differential Sync (Normal Mode):** Pulls fresh messages for the last 30 days to capture edited calls and replies, merging them with cached historical records.
* **Client-Side Chunking (Hard Process):** To avoid Vercel's 10-second Serverless Function limit on the free tier, deep syncs execute in bite-sized batches (`/api/sync/chunk`) orchestrated by the browser, rendering a real-time progress bar.
* **Backend Security:** Protected by `ADMIN_PASSWORD` to ensure unauthorized visitors cannot trigger heavy syncs or API calls.

---

## 3. Step-by-Step Deployment

### Step 1: Push Code to GitHub

1. Open your terminal in `d:\mubba\telegram-verifier-web`.
2. Commit and push your code:
   ```bash
   git add .
   git commit -m "feat: PostgreSQL signal caching, client chunking, and theme improvements"
   git push origin main
   ```

---

### Step 2: Import Project to Vercel

1. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** -> **"Project"**.
3. Select your repository and click **"Import"**.

---

### Step 3: Attach Free Vercel Postgres Database

1. In the Vercel Dashboard for your imported project, go to the **Storage** tab.
2. Click **"Create Database"** and select **"Postgres"** (powered by Neon, zero cost on Hobby plan).
3. Name your database (e.g. `telegram-signals-db`) and select your closest region.
4. Click **"Create"**.
5. Click **"Connect to Project"** and select your project.
   - Vercel will automatically inject `DATABASE_URL` and `POSTGRES_URL` into your project environment variables!

6. Run the initial database push locally or via Vercel CLI:
   ```bash
   npx prisma db push
   ```

---

### Step 4: Configure Environment Variables

In your Vercel Project Settings under **Environment Variables**, ensure these variables are added:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Auto-configured by Vercel Storage | PostgreSQL Database connection |
| `TELEGRAM_API_ID` | `27883265` | Telegram MTProto API ID |
| `TELEGRAM_API_HASH` | `ff7faed5d8cd05ab92de864944b2475b` | Telegram API Hash |
| `TELEGRAM_SESSION` | `<Your Session String>` | Telegram User Session |
| `ADMIN_PASSWORD` | `your-secure-password` *(optional)* | Unlocks web UI and secures backend API routes |

---

### Step 5: Deploy & Verify

1. Trigger a **Deploy** from the dashboard.
2. Open your deployed Vercel URL.
3. Click **"Set Password"** (or Admin button in top right) and enter your `ADMIN_PASSWORD`.
4. Test with:
   - **Channel ID:** `-1001297305044`
   - **Timeframe:** `30`
   - **Mode:** `Normal Mode (Smart Cache)`
5. Click **"Run Forensic Audit"** — initial fetch will populate the PostgreSQL database, and subsequent runs will load historical data with zero lag.
