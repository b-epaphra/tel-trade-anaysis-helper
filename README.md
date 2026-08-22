# 🛡️ SignalProof — Forensic Telegram Signal Verification Engine

**SignalProof** is an institutional-grade audit and backtesting platform designed to detect fraud, verify win rates, and bring mathematical transparency to Telegram trading signal providers.

---

## ⚡ Key Features

- **Forensic Signal Ingestion:** Connects directly to Telegram channels via MTProto (GramJS) with differential PostgreSQL caching.
- **1-Minute Tick Verification:** Backtests every claimed entry, take profit (TP), and stop loss (SL) against historical tick data (Dukascopy).
- **Fraud Detection Engine:** Automatically flags phantom wins, post-hoc edited messages, ghost entries, and moved stop losses.
- **Interactive Trade Breakdown:** Deep dive into individual trades with candlestick charts and raw channel message history.
- **AI Audit Dossier:** Generates comprehensive forensic audit reports powered by LLM quantitative analysis.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/signalproof"
ADMIN_PASSWORD="your-secure-password"
TELEGRAM_API_ID="your_telegram_api_id"
TELEGRAM_API_HASH="your_telegram_api_hash"
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the **SignalProof** dashboard.
