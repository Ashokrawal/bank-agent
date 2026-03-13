/**
 * lib/agent/graph.ts
 * LangGraph state machine — NovaBanк AI agent
 *
 * Flow:  router  →  rag_node | account_node | onboard_node  →  responder
 *
 * TOKEN BUDGET PER REQUEST (free-tier Gemini flash)
 * ──────────────────────────────────────────────────
 *  System prompt   ~150 tokens
 *  RAG context     ~260 tokens  (2 chunks × ~130)
 *  Account context ~220 tokens  (accounts + 10 transactions)
 *  User message    ~50 tokens
 *  Total in        ~680 tokens  (well under 1M context window)
 *  Max output      200 tokens   (concise, factual)
 */

import { Annotation, END, StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { retrieveContext } from "@/lib/rag/chroma";
import { getAccountsByUserId, getTransactions } from "@/lib/db/sqlite";

const BASE_SYSTEM = `You are NovaBanк's assistant. Be concise and factual. For lost cards or fraud call 0800 123 4567. Answer in under 150 words.`;

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

// ── LLM (singleton per process) ───────────────────────────────────────────────
let _llm: ChatGoogleGenerativeAI | null = null;
function llm() {
  if (!_llm)
    _llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.3,
      maxOutputTokens: 200,
      maxRetries: 0,  // Fail fast — no retry waits on quota exhaustion
    });
  return _llm;
}

// ── Node 1: Router (zero LLM tokens — pure keyword match) ─────────────────────
async function routerNode(s: S): Promise<Partial<S>> {
  const m = s.userMessage.toLowerCase();

  const is = (words: string[]) => words.some((w) => m.includes(w));

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
    ])
  )
    return { intent: "onboard" };

  if (
    s.userId &&
    is([
      "statement",
      "balance",
      "transaction",
      "my account",
      "spending",
      "how much",
      "what i spent",
      "payment history",
      "account number",
      "sort code",
      "recent payment",
    ])
  )
    return { intent: "account" };

  if (is(["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy"]))
    return { intent: "greeting" };

  // Everything else → RAG
  return { intent: "rag" };
}

// ── Node 2a: Greeting (no RAG, no DB — pure static reply) ────────────────────
async function greetingNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "greeting") return {};
  const name = s.userName ? `, ${s.userName.split(" ")[0]}` : "";
  return { response: `Hello${name}! I'm the NovaBanк assistant. How can I help you today?` };
}

// ── Node 2b: RAG (retrieve bank knowledge) ────────────────────────────────────
async function ragNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "rag") return {};
  const ctx = await retrieveContext(s.userMessage, 2);
  return { ragContext: ctx };
}

// ── Node 2b: Account (fetch user data from SQLite) ────────────────────────────
async function accountNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "account" || !s.userId) return {};

  try {
    const accounts = await getAccountsByUserId(s.userId);
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

    const accSummary = accounts
      .map(
        (a) =>
          `${a.name}: £${Number(a.balance).toFixed(2)} (${a.type}), Acc: ${a.account_number}, Sort: ${a.sort_code}`,
      )
      .join("\n");

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
      accountContext: `ACCOUNTS:\n${accSummary}\n\nTRANSACTIONS:\n${txnSummary}`,
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

// ── Node 2c: Onboard (provide account-opening guidance) ──────────────────────
async function onboardNode(s: S): Promise<Partial<S>> {
  if (s.intent !== "onboard") return {};
  return {
    ragContext: `
ACCOUNT OPENING PROCESS:
1. Choose account type
2. Provide personal details (name, email, DOB, address, NI number)
3. Upload photo ID (passport / driving licence / national ID)
4. Upload proof of address (utility bill or bank statement, <3 months old)
5. Automated KYC — usually instant
6. Account activated; account number + sort code issued

ACCOUNT TYPES:
• Standard Current: Free, Visa debit, instant UK transfers
• Premium Current: £9.99/mo, worldwide travel insurance, fee-free foreign spend
• Easy Access Saver: 4.5% AER, flexible withdrawals
• Cash ISA: 4.6% AER tax-free, up to £20,000/year
`.trim(),
  };
}

// ── Node 3: Responder (calls Gemini, builds final answer) ─────────────────────
async function responderNode(s: S): Promise<Partial<S>> {
  const systemPrompt = [
    BASE_SYSTEM,
    s.userName       ? `Customer: ${s.userName}.`    : "",
    s.ragContext     ? `\nFACTS:\n${s.ragContext}`    : "",
    s.accountContext ? `\nDATA:\n${s.accountContext}` : "",
    !s.userId && s.intent === "account"
      ? "\nCustomer not logged in — ask them to sign in."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const res = await llm().invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(s.userMessage),
    ]);
    return { response: res.content as string };
  } catch (e) {
    console.error("LLM error:", e);
    return {
      response:
        "I'm having trouble connecting right now. Please try again, or call 0800 123 4567.",
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
    .addNode("onboard", onboardNode)
    .addNode("respond", responderNode)

    .addEdge("__start__", "router")
    .addConditionalEdges("router", (s: S) => {
      if (s.intent === "greeting") return "greeting";
      if (s.intent === "account") return "account";
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
