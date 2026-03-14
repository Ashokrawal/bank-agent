# NovaBanк — AI Banking Assistant

NovaBanк is a demo banking app with a built-in AI chatbot. You can ask it questions, check your balance, apply for a loan, book an advisor, and more — all without leaving the chat window.

Built with Next.js, Google Gemini AI, and LangGraph.

---

## What can it do?

When you open the chat, you're talking to an AI that understands banking. Here's what it can help with:

**Anyone can ask:**
- "What are your opening hours?"
- "How do I open an account?"
- "What savings rates do you offer?"
- "How do I report a lost card?"

**Once you're signed in:**
- "Show me my balance" → displays your live account balances
- "Show my transactions" → shows a table of recent payments
- "What did I spend this month?" → gives a breakdown by category (food, transport, bills…)
- "I want a loan" → opens an inline mortgage application form, right inside the chat
- "Book an appointment" → lets you schedule a call with an advisor
- "Show investment options" → displays available savings and ISA products
- "Apply for a credit card" → opens a card application form in the chat

---

## How the AI works

When you send a message, it goes through a 3-step pipeline:

```
Your message
     │
     ▼
1. Router        — reads keywords to figure out what you want (no AI used here)
     │
     ├── balance / transactions  →  2. Fetch from database
     ├── loan / appointment      →  2. Skip lookup, show form directly
     └── general question        →  2. Search knowledge base (ChromaDB)
                                         │
                                         ▼
                                 3. Gemini AI writes the reply
```

The router avoids calling the AI for simple lookups — so checking your balance is fast and cheap.

---

## Tech stack

| Layer | What we use |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| AI Agent | LangGraph + Google Gemini 2.5 Flash |
| Knowledge base | ChromaDB (stores FAQs, products, policies as vectors) |
| Database | SQLite via sql.js (runs in memory, no install needed) |
| Auth | NextAuth.js with JWT sessions |

---

## Getting started

### What you need first

- Node.js 18 or higher
- Docker (for ChromaDB) **or** Python with pip
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Step 1 — Clone and install

```bash
git clone <your-repo>
cd bank-agent
npm install
```

### Step 2 — Set up your environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
GEMINI_API_KEY=your_key_here
NEXTAUTH_SECRET=any-long-random-string
NEXTAUTH_URL=http://localhost:3000
CHROMA_URL=http://localhost:8000
```

> To generate a good secret: `openssl rand -base64 32`

### Step 3 — Start ChromaDB

**With Docker (easiest):**
```bash
docker compose up -d
```

**With Python:**
```bash
pip install chromadb
chroma run --path ./chroma-data
```

### Step 4 — Seed the databases

```bash
npm run seed
```

This loads ~24 documents (FAQs, products, policies) into ChromaDB and creates the SQLite database with test accounts. Takes about 30 seconds.

### Step 5 — Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting.

---

## Demo accounts

| Email | Password | Has |
|---|---|---|
| `demo@novabank.com` | `demo123` | Current account + Cash ISA |
| `james.carter@example.com` | `demo123` | Current account + Saver |
| `sofia.patel@example.com` | `demo123` | Premium current account |

---

## Project structure

```
bank-agent/
│
├── app/                        # Pages and API routes
│   ├── chat/page.tsx           # The main chat interface
│   ├── account/page.tsx        # Account dashboard
│   ├── auth/signin/page.tsx    # Login page
│   ├── onboard/page.tsx        # Account opening flow
│   └── api/
│       ├── chat/               # Runs the AI agent
│       ├── loan/               # Loan application API
│       ├── appointment/        # Appointment booking API
│       ├── credit-card/        # Credit card application API
│       └── account/            # Fetches balances + transactions
│
├── lib/
│   ├── agent/graph.ts          # The AI agent brain (LangGraph)
│   ├── db/sqlite.ts            # Database queries
│   ├── rag/chroma.ts           # Knowledge base search
│   └── auth.ts                 # Login configuration
│
├── data/
│   └── mock-bank-data.ts       # Test users, accounts, transactions, FAQs
│
├── scripts/
│   └── seed.ts                 # Populates ChromaDB on first run
│
└── docker-compose.yml          # Starts ChromaDB
```

---

## Security features built in

- All financial APIs require you to be signed in
- Each user only sees their own applications (loans, appointments, credit cards)
- Financial form fields are validated server-side (type, range, allowed values)
- The chat filters out prompt injection attempts before they reach the AI
- Conversation history is capped at 6 turns to limit exposure

---

## Want to customise it?

**Change the FAQ / product info:**
Edit `data/mock-bank-data.ts` → update `FAQ_DATA`, `PRODUCT_DATA`, `POLICY_DATA` → re-run `npm run seed`

**Add a new chat feature:**
1. Add keywords to the router in `lib/agent/graph.ts`
2. Add a new intent and format rule
3. Set a `showXxxCTA` flag in `app/api/chat/route.ts`
4. Build the inline component in `app/chat/page.tsx`

**Reset the database:**
Delete `.novabank-db.sqlite` and restart the dev server — it re-seeds automatically.

---

## Before going to production

This is a demo. Before using it with real customers, you'd need to:

- [ ] Replace the password check with proper bcrypt hashing
- [ ] Swap SQLite for PostgreSQL (e.g. Supabase or Neon)
- [ ] Add a real KYC provider for identity verification
- [ ] Add rate limiting to all API endpoints
- [ ] Use a strong, randomly generated `NEXTAUTH_SECRET`
- [ ] Move ChromaDB to a hosted service
- [ ] Add audit logging (who accessed what and when)

---

## License

MIT
