/**
 * lib/agent/graph.ts — NovaBanк AI Agent
 *
 * CHANGES vs previous version
 * ────────────────────────────────────────────────────────────────────────────
 * 1. CONVERSATION HISTORY
 *    State now carries `history` — last 6 turns passed from the frontend.
 *    Injected into every LLM call so follow-ups like "what about last month?"
 *    resolve correctly against prior context.
 *
 * 2. SPENDING INTENT
 *    New `spending` router branch + spendingNode groups ALL transactions by
 *    category, sums debits, and returns a compact breakdown to the LLM.
 *    Handles: "how much on food?", "biggest expense?", "where does my money go?"
 *
 * 3. FORMAT RULE FOR SPENDING
 *    Strict: markdown table of categories + one insight sentence. No balance,
 *    no transaction list.
 */

import { Annotation, END, StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { retrieveContext } from "@/lib/rag/chroma";
import { getAccountsByUserId, getTransactions } from "@/lib/db/sqlite";

// ── Conversation history turn ─────────────────────────────────────────────────
export interface HistoryTurn {
  role: "user" | "bot";
  content: string;
}

// ── Static base prompt ────────────────────────────────────────────────────────
const BASE_SYSTEM =
  "You are NovaBanк's friendly AI assistant. Be helpful, accurate, and conversational. " +
  "For lost cards or fraud call 0800 123 4567 immediately.";

// ── Per-intent format rules ───────────────────────────────────────────────────
const FORMAT: Record<string, string> = {
  balance:
    'Reply in exactly ONE sentence per account. Format: "Your [Account Name] balance is £X,XXX.XX." ' +
    "If multiple accounts, one line each. Nothing else.",

  transactions:
    "Reply with a clean numbered list: date | description | amount. " +
    "No intro sentence. No balance. No closing sentence.",

  spending:
    "Reply with a markdown table: | Category | Total Spent |. " +
    "Sort by highest spend. After the table, write ONE sentence naming the biggest category. " +
    "No intro. No transaction list. No balance.",

  onboard:
    "Reply with exactly 3-5 bullet points starting with *. No intro or closing sentence.",

  rag:
    "Reply in 2-3 sentences. Be specific and helpful. " +
    "If listing multiple items, use bullet points.",

  loan:
    "Reply in exactly 1 warm sentence confirming you can help with their home loan. " +
    "Do NOT mention any URL or link — the apply button will appear automatically below your message.",

  appointment:
    "Reply in exactly 1 warm sentence confirming you can help book an advisor appointment. " +
    "Do NOT mention any URL or link — the booking form will appear automatically below your message.",

  investment:
    "Reply in exactly 1 warm sentence highlighting that NovaBanк offers great investment products. " +
    "Do NOT list products or mention URLs — the investment options will appear automatically below your message.",

  credit_card:
    "Reply in exactly 1 warm sentence confirming you can help with a credit card application. " +
    "Do NOT mention any URL or link — the application form will appear automatically below your message.",

  greeting: "",
};

// ── State schema ──────────────────────────────────────────────────────────────
const State = Annotation.Root({
  userMessage: Annotation<string>,
  userId: Annotation<string | null>,
  userName: Annotation<string | null>,
  history: Annotation<HistoryTurn[]>,
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
      temperature: 0.3,
      maxOutputTokens: 400,
      maxRetries: 1,
    });
  return _llm;
}

// ── Node 1: Router ────────────────────────────────────────────────────────────
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

  if (
    s.userId &&
    is([
      "spending",
      "spend",
      "spent",
      "how much on",
      "how much did i",
      "biggest expense",
      "where does my money",
      "what am i spending",
      "overspend",
      "budget",
      "breakdown",
      "categories",
      "by category",
    ])
  )
    return { intent: "spending" };

  if (
    s.userId &&
    is([
      "statement",
      "transaction",
      "transactions",
      "payment history",
      "recent payment",
      "last month",
      "this month",
      "this year",
      "what i spent",
      "show my",
      "my account",
    ])
  )
    return { intent: "transactions" };

  if (
    s.userId &&
    is([
      "home loan",
      "house loan",
      "mortgage",
      "property loan",
      "buy a house",
      "buy a home",
      "borrow for",
      "loan application",
      "apply for a loan",
      "apply for mortgage",
      "i want a loan",
      "i need a loan",
      "can i get a mortgage",
    ])
  )
    return { intent: "loan" };

  if (
    is([
      "book appointment",
      "book a meeting",
      "schedule",
      "speak to someone",
      "talk to an advisor",
      "meet with",
      "consultation",
      "book a call",
      "advisor",
      "speak to advisor",
      "human advisor",
    ])
  )
    return { intent: "appointment" };

  if (
    is([
      "invest",
      "investment",
      "isa",
      "stocks",
      "shares",
      "portfolio",
      "grow my money",
      "put my money",
      "fixed rate",
      "fixed bond",
      "savings options",
      "investment options",
      "where to invest",
    ])
  )
    return { intent: "investment" };

  if (
    is([
      "credit card",
      "apply for a card",
      "card application",
      "cashback card",
      "rewards card",
      "new card",
      "get a card",
      "i want a credit card",
      "i need a credit card",
    ])
  )
    return { intent: "credit_card" };

  return { intent: "rag" };
}

// ── Node 2a: Greeting ─────────────────────────────────────────────────────────
async function greetingNode(s: S): Promise<Partial<S>> {
  const name = s.userName ? `, ${s.userName.split(" ")[0]}` : "";
  return {
    response: `Hello${name}! I'm the NovaBanк assistant. How can I help you today?`,
  };
}

// ── Node 2b: RAG ──────────────────────────────────────────────────────────────
async function ragNode(s: S): Promise<Partial<S>> {
  const ctaIntents = ["loan", "appointment", "investment", "credit_card"];
  if (ctaIntents.includes(s.intent)) {
    return { ragContext: "CTA_REDIRECT" };
  }
  if (s.intent !== "rag") return {};
  const ctx = await retrieveContext(s.userMessage, 3);
  return { ragContext: ctx };
}

// ── Node 2c: Account (balance or transaction list) ────────────────────────────
async function accountNode(s: S): Promise<Partial<S>> {
  if ((s.intent !== "balance" && s.intent !== "transactions") || !s.userId)
    return {};

  try {
    const accounts = await getAccountsByUserId(s.userId);

    if (s.intent === "balance") {
      const accSummary = accounts
        .map(
          (a) =>
            `${a.name}: \u00a3${Number(a.balance).toFixed(2)} | ` +
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
              `${t.date} | ${t.description} | \u00a3${Number(t.amount).toFixed(2)} | ${t.category}`,
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

// ── Node 2d: Spending analysis ────────────────────────────────────────────────
async function spendingNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "spending" || !s.userId) return {};

  try {
    const accounts = await getAccountsByUserId(s.userId);
    const primary = accounts[0];
    if (!primary) return { accountContext: "No account found." };

    const m = s.userMessage.toLowerCase();
    const now = new Date();
    let fromDate: string;
    let toDate: string;
    let periodLabel: string;

    if (m.includes("last month")) {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .split("T")[0];
      toDate = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .split("T")[0];
      periodLabel = "last month";
    } else if (m.includes("this year")) {
      fromDate = `${now.getFullYear()}-01-01`;
      toDate = now.toISOString().split("T")[0];
      periodLabel = "this year";
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      toDate = now.toISOString().split("T")[0];
      periodLabel = "this month";
    }

    const txns = await getTransactions(primary.id as string, fromDate, toDate);

    const excluded = new Set(["income", "transfer"]);
    const categoryTotals: Record<string, number> = {};

    for (const t of txns) {
      if (Number(t.amount) >= 0) continue;
      const cat = String(t.category ?? "other");
      if (excluded.has(cat)) continue;
      categoryTotals[cat] =
        (categoryTotals[cat] ?? 0) + Math.abs(Number(t.amount));
    }

    const sorted = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
    const totalSpend = sorted.reduce((s, [, v]) => s + v, 0);

    const breakdown = sorted
      .map(
        ([cat, amt]) =>
          `${cat}: \u00a3${amt.toFixed(2)} (${Math.round((amt / totalSpend) * 100)}%)`,
      )
      .join("\n");

    // Detect if user is asking about a specific category
    const categoryKeywords: Record<string, string[]> = {
      food: ["food", "eating", "cafe", "restaurant", "coffee"],
      groceries: ["groceries", "grocery", "supermarket", "tesco", "waitrose"],
      transport: ["transport", "travel", "tfl", "petrol", "fuel", "commute"],
      entertainment: [
        "entertainment",
        "netflix",
        "spotify",
        "streaming",
        "subscription",
      ],
      bills: ["bills", "bill", "utilities", "council tax", "gas", "electric"],
      shopping: ["shopping", "clothes", "amazon"],
      housing: ["housing", "rent", "mortgage"],
      health: ["health", "pharmacy", "doctor", "medical"],
    };

    let focusCategory: string | null = null;
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((k) => m.includes(k))) {
        focusCategory = cat;
        break;
      }
    }

    let context: string;
    if (focusCategory && categoryTotals[focusCategory] !== undefined) {
      context =
        `SPENDING (${periodLabel}):\n` +
        `Focus: ${focusCategory} = \u00a3${categoryTotals[focusCategory].toFixed(2)}\n` +
        `All categories:\n${breakdown}`;
    } else {
      context = `SPENDING BREAKDOWN (${periodLabel}):\n${breakdown}\nTotal spent: \u00a3${totalSpend.toFixed(2)}`;
    }

    return {
      accountContext: context,
      metadata: {
        spending: {
          period: periodLabel,
          categories: categoryTotals,
          totalSpend,
          topCategory: sorted[0]?.[0] ?? null,
        },
        transactions: txns,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          balance: a.balance,
        })),
      },
    };
  } catch (e) {
    console.error("spendingNode error:", e);
    return { accountContext: "Unable to analyse spending right now." };
  }
}

// ── Node 2e: Onboard ──────────────────────────────────────────────────────────
async function onboardNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "onboard") return {};
  return {
    ragContext: `
ACCOUNT OPENING STEPS:
1. Choose your account type (Standard Current, Premium Current, Easy Access Saver, or Cash ISA)
2. Enter personal details: full name, email, date of birth, home address, NI number
3. Upload a photo ID: passport, driving licence, or national ID card
4. Upload proof of address: utility bill or bank statement dated within 3 months
5. Automated KYC check -- usually instant
6. Account activated: you receive your account number and sort code immediately

ACCOUNT TYPES:
* Standard Current -- free, Visa debit, instant UK transfers
* Premium Current -- 9.99/month, worldwide travel insurance, fee-free foreign spend
* Easy Access Saver -- 4.5% AER, withdraw any time
* Cash ISA -- 4.6% AER tax-free, up to 20,000/year
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
    !s.userId && ["balance", "transactions", "spending"].includes(s.intent)
      ? "\nCustomer is not logged in -- politely ask them to sign in to view account details."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Inject last N conversation turns before the current message
  const historyMessages: (HumanMessage | AIMessage)[] = (s.history ?? []).map(
    (turn) =>
      turn.role === "user"
        ? new HumanMessage(turn.content)
        : new AIMessage(turn.content),
  );

  const allMessages: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(systemPrompt),
    ...historyMessages,
    new HumanMessage(s.userMessage),
  ];

  try {
    const res = await llm().invoke(allMessages);
    return { response: res.content as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isDev = process.env.NODE_ENV === "development";
    console.error("LLM error:", msg);
    return {
      response: isDev
        ? `LLM error: ${msg}`
        : "I'm having trouble connecting right now. Please try again shortly, or call 0800 123 4567.",
    };
  }
}

// ── Graph wiring ──────────────────────────────────────────────────────────────
let _graph: ReturnType<typeof build> | null = null;

function build() {
  return new StateGraph(State)
    .addNode("router", routerNode)
    .addNode("greeting", greetingNode)
    .addNode("rag", ragNode)
    .addNode("account", accountNode)
    .addNode("spending", spendingNode)
    .addNode("onboard", onboardNode)

    .addNode("respond", responderNode)

    .addEdge("__start__", "router")
    .addConditionalEdges("router", (s: S) => {
      if (s.intent === "greeting") return "greeting";
      if (s.intent === "balance") return "account";
      if (s.intent === "transactions") return "account";
      if (s.intent === "spending") return "spending";
      if (s.intent === "onboard") return "onboard";
      return "rag";
      // loan / appointment / investment / credit_card all fall through to rag
      // (ragNode short-circuits them to CTA_REDIRECT, then respond)
    })
    .addEdge("greeting", END)
    .addEdge("rag", "respond")
    .addEdge("account", "respond")
    .addEdge("spending", "respond")
    .addEdge("onboard", "respond")
    .addEdge("respond", END)
    .compile();
}

export function getGraph() {
  if (!_graph) _graph = build();
  return _graph;
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface AgentResult {
  response: string;
  intent: string;
  metadata: Record<string, unknown>;
}

export async function runAgent(input: {
  message: string;
  userId?: string | null;
  userName?: string | null;
  history?: HistoryTurn[];
}): Promise<AgentResult> {
  const result = await getGraph().invoke({
    userMessage: input.message,
    userId: input.userId ?? null,
    userName: input.userName ?? null,
    history: input.history ?? [],
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
