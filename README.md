# NovaBanк - AI Banking Assistant

NovaBanк is a full-stack AI banking demo built in two iterations. Prototype.1 used a keyword router. Prototype.2 replaced it with a proper MCP agent - the model decides which tool to call based on meaning, not keyword matching.

Built with Next.js, Google Gemini, LangGraph, and Model Context Protocol.

---

## What changed between prototypes

**Prototype.1 (old)**

- Keyword router - if message contains "balance" go to branch A
- RAG only ran for the "else" branch - balance checks never hit ChromaDB
- k=2 chunk retrieval - too few for complex questions
- 24 documents in the knowledge base
- CTA logic scattered across the API route

**Prototype.2 (current)**

- No router - Gemini reads tool schemas and decides what to call
- Every query goes through the same pipeline
- k=4 chunk retrieval via MCP server
- 54 documents across FAQs, product sheets, policies, and guides
- One MCP server exposes ChromaDB as a proper protocol-compliant tool
- "I need a loan and book an appointment" triggers both tools in one turn

---

## How the agent works now

User message
|
v
Input guardrail (blocks injection attempts)
|
v
Gemini reads message + sees 7 tool schemas
|
v
Gemini picks the right tool(s) based on meaning
|
+-- get_account_balance -> SQLite
+-- get_transactions -> SQLite
+-- get_spending_summary -> SQLite
+-- search_knowledge_base -> MCP server -> ChromaDB
+-- trigger_loan_form -> returns CTA flag
+-- trigger_appointment -> returns CTA flag
+-- trigger_credit_card -> returns CTA flag
|
v
Tool result feeds back to Gemini
|
v
Output guardrail (checks for hallucinated figures)
|
v
Response to user

The model understands "what's left in my account" the same as "show balance". No keyword arrays. No branches to maintain.

---

## What it can do

Anyone can ask:

- "What are your opening hours?"
- "What savings rates do you offer?"
- "Can I get a mortgage if I am self-employed?"
- "How do I dispute a transaction?"
- "What is the FSCS protection limit?"

Signed-in users get:

- Live account balances from SQLite
- Recent transaction history
- Spending breakdown by category
- Inline loan application form
- Inline appointment booking
- Inline credit card application

---

## Tech stack

| Layer           | What we use                          |
| --------------- | ------------------------------------ |
| Frontend        | Next.js 15, TypeScript, Tailwind CSS |
| AI model        | Google Gemini 2.5 Flash              |
| Agent framework | LangGraph (ReAct loop)               |
| MCP server      | @modelcontextprotocol/sdk            |
| Vector database | ChromaDB (cosine similarity, k=4)    |
| Embeddings      | Gemini embedding-001                 |
| Database        | SQLite via sql.js                    |
| Auth            | NextAuth.js with JWT                 |

---

## Getting started

### Requirements

- Node.js 18+
- Docker (for ChromaDB)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Step 1 - Clone and install

```bash
git clone https://github.com/Ashokrawal/bank-agent.git
cd bank-agent
npm install
```

### Step 2 - Environment variables

Create a `.env` file in the root:

```env
GEMINI_API_KEY=your_key_here
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
CHROMA_URL=http://localhost:8000
```

Generate a secure secret:

```bash
openssl rand -base64 32
```

### Step 3 - Start ChromaDB

```bash
npm run chroma
```

### Step 4 - Seed the knowledge base

```bash
npm run seed:chroma
```

Embeds 54 documents into ChromaDB using Gemini embedding-001. Takes about 30 seconds. Run this once, or again whenever you update the knowledge files.

### Step 5 - Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Demo accounts

| Email                      | Password  |
| -------------------------- | --------- |
| `demo@novabank.com`        | `demo123` |
| `james.carter@example.com` | `demo123` |
| `sofia.patel@example.com`  | `demo123` |

---

## Project structure

bank-agent/
|
+-- app/
| +-- chat/page.tsx # Main chat interface
| +-- account/page.tsx # Account dashboard
| +-- api/
| +-- chat/route.ts # Entry point - runs the agent
| +-- loan/ # Loan application
| +-- appointment/ # Appointment booking
| +-- credit-card/ # Credit card application
|
+-- lib/
| +-- agent/mcpGraph.ts # Agent brain - tool calling loop
| +-- mcp/
| | +-- knowledge-server.ts # MCP server exposing ChromaDB
| | +-- client.ts # MCP client - connects agent to server
| +-- db/sqlite.ts # Database queries
| +-- auth.ts # Auth config
|
+-- data/
| +-- knowledge/
| | +-- faqs.ts # 30 FAQs
| | +-- products.ts # 11 product sheets
| | +-- guides.ts # 5 policies + 8 how-to guides
| | +-- index.ts # Combines all 54 documents
| +-- mock-bank-data.ts # SQLite seed data
|
+-- scripts/
| +-- seed-chroma.ts # Embeds knowledge base into ChromaDB
|
+-- docker-compose.yml

---

## Updating the knowledge base

Edit any file in `data/knowledge/`, then re-run:

```bash
npm run seed:chroma
```

ChromaDB gets wiped and rebuilt from scratch. The agent picks up the new content immediately.

---

## Security

- All financial API routes require an active session
- User isolation enforced server-side - users only see their own data
- Input guardrail blocks prompt injection before reaching the LLM
- Output guardrail flags financial responses generated without tool use
- Conversation history capped at 6 turns
- Account numbers masked to last 4 digits in all responses

---

## Before going to production

- [ ] Replace plain text password comparison with bcrypt
- [ ] Swap SQLite for PostgreSQL (Supabase or Neon)
- [ ] Move ChromaDB to a hosted service (Chroma Cloud)
- [ ] Add rate limiting on all API routes
- [ ] Add proper audit logging
- [ ] Set up automated re-seeding when knowledge docs change
- [ ] KYC provider for real identity verification

---

## License

MIT
