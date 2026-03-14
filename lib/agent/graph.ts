import { Annotation, END, StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { retrieveContext } from "@/lib/rag/chroma";
import { getAccountsByUserId, getTransactions } from "@/lib/db/sqlite";

// ── Static base prompt ────────────────────────────────────────────────────────
const BASE_SYSTEM =
  "You are NovaBanк's friendly assistant. Be helpful, accurate, and conversational. " +
  "For lost cards or fraud call 0800 123 4567 immediately.";

// ── Per-intent format rules (kept from free-tier — they work well) ────────────
const FORMAT: Record<string, string> = {
  // Strict one-liner — no lists, no extra sentences
  balance:
    'Reply in exactly ONE sentence. Format: "Your [Account Name] balance is £X,XXX.XX." ' +
    "If multiple accounts, list each on its own line. Nothing else.",

  // List only — no balance, no intro sentence
  transactions:
    "Reply with a clean numbered list of transactions: date, description, amount. " +
    "No intro sentence. No balance. No closing sentence.",

  onboard:
    "Reply with exactly 3–5 bullet points starting with •. No intro or closing sentence.",

  rag:
    "Reply in 2–3 sentences. Be specific and helpful. " +
    "If listing multiple items, use bullet points (• ).",

  greeting: "",
};

// ── State schema ──────────────────────────────────────────────────────────────
const State = Annotation.Root({
  userMessage: Annotation<string>,
  userId: Annotation<string | null>,
  userName: Annotation<string | null>,
  intent: Annotation<string>,
  ragContext: Annotation<string>,
  accountContext: Annotation<string>,
  response: Annotation<string>,
  metadata: Annotation<Record<string, unknown>>,
});
type S = typeof State.State;

// ── LLM singleton ─────────────────────────────────────────────────────────────
let _llm: ChatGoogleGenerativeAI | null = null;
function llm() {
  if (!_llm)
    _llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.3, // natural, conversational
      maxOutputTokens: 400, // room for multi-step answers
      maxRetries: 1, // one retry on transient failures
    });
  return _llm;
}

// ── Node 1: Router — zero LLM tokens ─────────────────────────────────────────
async function routerNode(s: S): Promise<Partial<S>> {
  const m = s.userMessage.toLowerCase();
  const is = (words: string[]) => words.some((w) => m.includes(w));

  if (
    is(["hi", "hello", "hey", "good morning", "good afternoon", "good evening"])
  )
    return { intent: "greeting" };

  if (
    is([
      "open account",
      "apply",
      "new account",
      "sign up",
      "register",
      "create account",
      "join novabank",
      "become a customer",
      "how do i open",
      "how can i open",
      "how to open",
      "how do i create",
      "how can i create",
      "how to create",
    ])
  )
    return { intent: "onboard" };

  // Balance-only queries — reply with ONE line
  if (
    s.userId &&
    is([
      "balance",
      "check balance",
      "show balance",
      "my balance",
      "what's my balance",
      "whats my balance",
      "how much do i have",
      "account number",
      "sort code",
    ])
  )
    return { intent: "balance" };

  // Transaction/statement queries — reply with a list
  if (
    s.userId &&
    is([
      "statement",
      "transaction",
      "spending",
      "what i spent",
      "payment history",
      "recent payment",
      "last month",
      "this month",
      "this year",
      "how much did i spend",
      "my account",
    ])
  )
    return { intent: "transactions" };

  return { intent: "rag" };
}

// ── Node 2a: Greeting — zero LLM tokens ──────────────────────────────────────
async function greetingNode(s: S): Promise<Partial<S>> {
  const name = s.userName ? `, ${s.userName.split(" ")[0]}` : "";
  return {
    response: `Hello${name}! I'm the NovaBanк assistant. How can I help you today?`,
  };
}

// ── Node 2b: RAG — 3 chunks (restored from free-tier's 2) ────────────────────
async function ragNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "rag") return {};
  const ctx = await retrieveContext(s.userMessage, 3);
  return { ragContext: ctx };
}

// ── Node 2c: Account — splits on intent so balance NEVER receives txn data ────
async function accountNode(s: S): Promise<Partial<S>> {
  if ((s.intent !== "balance" && s.intent !== "transactions") || !s.userId)
    return {};

  try {
    const accounts = await getAccountsByUserId(s.userId);

    // BALANCE intent: accounts only — no transactions fetched or sent.
    // If the LLM never sees transaction data it cannot talk about it.
    if (s.intent === "balance") {
      const accSummary = accounts
        .map(
          (a) =>
            `${a.name}: £${Number(a.balance).toFixed(2)} | ` +
            `Acc: ${a.account_number} | Sort: ${a.sort_code}`,
        )
        .join("\n");

      return {
        accountContext: `BALANCES:\n${accSummary}`,
        metadata: {
          accounts: accounts.map((a) => ({
            id: a.id,
            name: a.name,
            balance: a.balance,
            type: a.type,
            accountNumber: a.account_number,
            sortCode: a.sort_code,
          })),
          transactions: [],
          dateRange: null,
        },
      };
    }

    // TRANSACTIONS intent: fetch and send transaction data
    const m = s.userMessage.toLowerCase();
    const now = new Date();
    let fromDate: string | undefined, toDate: string | undefined;

    if (m.includes("last month")) {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .split("T")[0];
      toDate = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .split("T")[0];
    } else if (m.includes("this month")) {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      toDate = now.toISOString().split("T")[0];
    } else if (m.includes("this year")) {
      fromDate = `${now.getFullYear()}-01-01`;
      toDate = now.toISOString().split("T")[0];
    }

    const primary = accounts[0];
    const txns = primary
      ? await getTransactions(primary.id as string, fromDate, toDate)
      : [];

    const txnSummary = txns.length
      ? txns
          .slice(0, 10)
          .map(
            (t) =>
              `${t.date} | ${t.description} | £${Number(t.amount).toFixed(2)} | ${t.category}`,
          )
          .join("\n")
      : "No transactions for this period.";

    return {
      accountContext: `TRANSACTIONS:\n${txnSummary}`,
      metadata: {
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          balance: a.balance,
          type: a.type,
          accountNumber: a.account_number,
          sortCode: a.sort_code,
        })),
        transactions: txns.slice(0, 10),
        dateRange: fromDate ? { from: fromDate, to: toDate } : null,
      },
    };
  } catch (e) {
    console.error("accountNode error:", e);
    return { accountContext: "Unable to retrieve account data right now." };
  }
}

// ── Node 2d: Onboard — full step descriptions restored ────────────────────────
async function onboardNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "onboard") return {};
  return {
    ragContext: `
ACCOUNT OPENING STEPS:
1. Choose your account type (Standard Current, Premium Current, Easy Access Saver, or Cash ISA)
2. Enter personal details: full name, email, date of birth, home address, NI number
3. Upload a photo ID: passport, driving licence, or national ID card
4. Upload proof of address: utility bill or bank statement dated within 3 months
5. Automated KYC check — usually instant
6. Account activated: you receive your account number and sort code immediately

ACCOUNT TYPES:
• Standard Current — free, Visa debit, instant UK transfers
• Premium Current — £9.99/month, worldwide travel insurance, fee-free foreign spend
• Easy Access Saver — 4.5% AER, withdraw any time
• Cash ISA — 4.6% AER tax-free, up to £20,000/year
    `.trim(),
  };
}

// ── Node 3: Responder ─────────────────────────────────────────────────────────
async function responderNode(s: S): Promise<Partial<S>> {
  const systemPrompt = [
    BASE_SYSTEM,
    FORMAT[s.intent] ?? FORMAT.rag,
    s.userName ? `Customer name: ${s.userName}.` : "",
    s.ragContext ? `\nKNOWLEDGE:\n${s.ragContext}` : "",
    s.accountContext ? `\nACCOUNT DATA:\n${s.accountContext}` : "",
    !s.userId && (s.intent === "balance" || s.intent === "transactions")
      ? "\nCustomer is not logged in — politely ask them to sign in to view account details."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await llm().invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(s.userMessage),
    ]);
    return { response: res.content as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("LLM error:", msg);
    // Surface the real error in dev so we can debug it
    const isDev = process.env.NODE_ENV === "development";
    return {
      response: isDev
        ? `⚠️ LLM error: ${msg}`
        : "I'm having trouble connecting right now. Please try again shortly, or call 0800 123 4567.",
    };
  }
}

// ── Graph wiring ───────────────────────────────────────────────────────────────
let _graph: ReturnType<typeof build> | null = null;

function build() {
  return new StateGraph(State)
    .addNode("router", routerNode)
    .addNode("greeting", greetingNode)
    .addNode("rag", ragNode)
    .addNode("account", accountNode)
    .addNode("onboard", onboardNode)
    .addNode("respond", responderNode)

    .addEdge("__start__", "router")
    .addConditionalEdges("router", (s: S) => {
      if (s.intent === "greeting") return "greeting";
      if (s.intent === "balance") return "account";
      if (s.intent === "transactions") return "account";
      if (s.intent === "onboard") return "onboard";
      return "rag";
    })
    .addEdge("greeting", END)
    .addEdge("rag", "respond")
    .addEdge("account", "respond")
    .addEdge("onboard", "respond")
    .addEdge("respond", END)
    .compile();
}

export function getGraph() {
  if (!_graph) _graph = build();
  return _graph;
}

// ── Public API ─────────────────────────────────────────────────────────────────
export interface AgentResult {
  response: string;
  intent: string;
  metadata: Record<string, unknown>;
}

export async function runAgent(input: {
  message: string;
  userId?: string | null;
  userName?: string | null;
}): Promise<AgentResult> {
  const result = await getGraph().invoke({
    userMessage: input.message,
    userId: input.userId ?? null,
    userName: input.userName ?? null,
    intent: "rag",
    ragContext: "",
    accountContext: "",
    response: "",
    metadata: {},
  });

  return {
    response: result.response,
    intent: result.intent,
    metadata: result.metadata ?? {},
  };
}
