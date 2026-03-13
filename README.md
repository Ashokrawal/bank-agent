# NovaBanк — AI Banking Agent

A full-stack Next.js 14 AI banking assistant powered by **LangGraph**, **Gemini 2.0 Flash**, and **ChromaDB**.

## What it does

| Feature | Detail |
|---------|--------|
| 💬 AI Chat | Ask anything about the bank — hours, fees, rates, how to apply |
| 🔐 Authenticated queries | Logged-in users can ask for balances, statements, transactions |
| 🏦 Account opening | 4-step onboarding with document upload and KYC simulation |
| 📊 Account dashboard | Balance cards, recent transactions, spending categories |
| 🧠 RAG (ChromaDB) | 15 FAQs + 5 products + 4 policies embedded as vectors |
| 💾 SQLite | Mock users, accounts, transactions — no external DB needed |

---

## Tech Stack

```
Frontend    Next.js 14 (App Router) · TypeScript · Tailwind CSS v4
Agent       LangGraph v1 · Gemini 2.0 Flash (LLM + embeddings)
Vector DB   ChromaDB  (local Docker or pip)
Relational  sql.js  (SQLite in WASM — no native bindings)
Auth        NextAuth v4 · Credentials provider · JWT sessions
```

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker (for ChromaDB) **or** Python 3.8+ with `pip`
- A free [Gemini API key](https://aistudio.google.com/app/apikey)

### 2. Install

```bash
git clone <your-repo>
cd bank-agent
npm install
```

### 3. Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your_key_here          # required
NEXTAUTH_SECRET=any-random-string     # required (openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
CHROMA_URL=http://localhost:8000
```

### 4. Start ChromaDB

**Option A — Docker (recommended):**
```bash
docker compose up -d
```

**Option B — pip:**
```bash
pip install chromadb
chroma run --path ./chroma-data
```

### 5. Seed databases

```bash
npm run seed
```

This embeds ~24 documents into ChromaDB and seeds SQLite with mock data.
Takes ~30 seconds (rate-limited to be free-tier friendly).

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo credentials

| Email | Password | Account |
|-------|----------|---------|
| `demo@novabank.com` | `demo123` | Current + Cash ISA |
| `james.carter@example.com` | `demo123` | Current + Saver |
| `sofia.patel@example.com` | `demo123` | Premium Current |

---

## Try these queries in chat

**Public (no login):**
- "What are your opening hours?"
- "How do I open an account?"
- "What documents do I need?"
- "What savings rates do you offer?"
- "How do I report a lost card?"

**Authenticated (sign in first):**
- "Show me my balance"
- "Statement for last month"
- "What did I spend this month?"
- "Show my recent transactions"

---

## Project Structure

```
bank-agent/
├── app/
│   ├── page.tsx                  # Homepage
│   ├── chat/page.tsx             # AI chat interface
│   ├── account/page.tsx          # Account dashboard
│   ├── auth/signin/page.tsx      # Sign-in page
│   ├── onboard/page.tsx          # Account opening flow
│   └── api/
│       ├── chat/route.ts         # POST /api/chat
│       ├── account/route.ts      # GET  /api/account
│       ├── onboard/route.ts      # POST /api/onboard
│       └── auth/[...nextauth]/   # NextAuth handler
│
├── lib/
│   ├── agent/graph.ts            # LangGraph state machine
│   ├── db/sqlite.ts              # SQLite helpers (sql.js)
│   ├── rag/chroma.ts             # ChromaDB client + retrieval
│   └── auth.ts                   # NextAuth config
│
├── data/
│   └── mock-bank-data.ts         # All mock data (FAQ, products, users…)
│
├── components/
│   └── layout/
│       ├── Navbar.tsx
│       └── Providers.tsx
│
├── scripts/
│   └── seed.ts                   # One-time DB seeder
│
├── docker-compose.yml            # ChromaDB
└── .env.local                    # API keys (git-ignored)
```

---

## LangGraph agent flow

```
User message
     │
     ▼
 router_node          ← zero LLM tokens (keyword matching)
     │
     ├─ "rag"    ──▶  rag_node      ← ChromaDB semantic search (top-3)
     ├─ "account"──▶  account_node  ← SQLite lookup (accounts + transactions)
     └─ "onboard"──▶  onboard_node  ← static guidance context
                           │
                           ▼
                     responder_node  ← Gemini 2.0 Flash (≤512 tokens out)
                           │
                           ▼
                       Response
```

**Token budget per request (~900 tokens in, ≤512 out):**

| Component | Tokens |
|-----------|--------|
| System prompt | ~150 |
| RAG context (3 chunks) | ~400 |
| Account data (15 txns) | ~300 |
| User message | ~50 |
| **Total input** | **~900** |
| Max output | 512 |

---

## Adding real data

To replace mock data with your own:

1. Edit `data/mock-bank-data.ts` — update `FAQ_DATA`, `PRODUCT_DATA`, `POLICY_DATA`
2. Re-run `npm run seed` to re-embed
3. Update `MOCK_USERS` / `MOCK_ACCOUNTS` / `MOCK_TRANSACTIONS` for different test accounts
4. Delete `.novabank-db.sqlite` to force a fresh SQLite seed

---

## Production checklist

- [ ] Replace `demo123` password check with `bcrypt.compare()`
- [ ] Add a real KYC provider (Onfido, Jumio, Stripe Identity)
- [ ] Replace sql.js with PostgreSQL (e.g. Neon, Supabase)
- [ ] Add GEMINI_API_KEY to your hosting env vars
- [ ] Set a strong `NEXTAUTH_SECRET`
- [ ] Move ChromaDB to a persistent host (Chroma Cloud, Railway)
- [ ] Add rate limiting to `/api/chat`

---

## License

MIT
