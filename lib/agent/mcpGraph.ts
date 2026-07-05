/**
 * lib/agent/mcpGraph.ts
 *
 * The brain of prototype.2.
 *
 * Prototype.1 used a keyword router - if message contains "balance"
 * go to branch A, if "loan" go to branch B. Brittle and wrong.
 *
 * Prototype.2 has NO router. Instead:
 * - Gemini sees the user message AND all available tool schemas
 * - Gemini decides which tool to call based on actual meaning
 * - Tool runs, result comes back to Gemini
 * - Gemini writes the final answer using real data
 *
 * This loop is called a ReAct agent:
 * Reason -> Act -> Observe -> Reason -> Act -> until done
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchKnowledgeBase } from "@/lib/mcp/client";
import { getAccountsByUserId, getTransactions } from "@/lib/db/sqlite";

// ── System prompt ─────────────────────────────────────────────────────────────
// This tells Gemini who it is and how to behave.
// Specific rules work better than vague ones.
// The more focused this is, the better the responses.
const SYSTEM_PROMPT = `You are Nova, NovaBanк's AI banking assistant.
You are helpful, clear, and professional.

RULES:
- Always use a tool to get data - never invent balances, rates, or figures
- For personal account data use the account tools
- For product info, fees, policies, rates use search_knowledge_base
- For loan applications trigger the loan form tool
- For appointments trigger the appointment tool
- For credit cards trigger the credit card tool
- Keep responses concise - users are in a chat interface
- Format currency as £X,XXX.XX
- If a tool returns no results say so honestly rather than guessing
- You represent NovaBanк - accuracy matters more than sounding helpful`;

// ── Tool 1: Search knowledge base via MCP ─────────────────────────────────────
// This is the RAG tool. It goes:
// Gemini calls tool -> client.ts -> MCP server -> ChromaDB -> top K chunks back
// The description is what Gemini reads to decide WHEN to call this tool.
// Write it like you're explaining to a smart person what this does.
const knowledgeSearchTool = tool(
  async ({ query, filter_type }) => {
    // delegates to MCP client which spawns the MCP server process
    // which embeds the query and searches ChromaDB
    const results = await searchKnowledgeBase(query, filter_type);
    return results;
  },
  {
    name: "search_knowledge_base",
    description:
      "Search NovaBanк knowledge base for products, policies, fees, " +
      "mortgage rates, savings rates, account types, how-to guides, " +
      "and general banking questions. Use for anything about NovaBanк " +
      "products or services - not personal account data.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "Search query - rephrase the user question for best semantic match",
        ),
      filter_type: z
        .enum(["faq", "product", "policy", "guide", "any"])
        .optional()
        .describe(
          "Optional: filter by document type. " +
            "Use 'product' for rate questions, 'guide' for how-to, " +
            "'faq' for general, 'any' for broad searches",
        ),
    }),
  },
);

// ── Tool 2: Get account balances ──────────────────────────────────────────────
// Hits SQLite directly. userId is injected by the agent from the session,
// the user never types it. We mask the account number for security.
const getBalanceTool = tool(
  async ({ userId }) => {
    // getAccountsByUserId takes userId and returns all active accounts
    const accounts = await getAccountsByUserId(userId);

    if (!accounts?.length) {
      return "No accounts found for this user.";
    }

    return JSON.stringify(
      accounts.map((a: any) => ({
        name: a.name,
        type: a.type,
        // mask account number - only show last 4 digits
        // never expose full account numbers in chat
        accountNumber: `****${String(a.account_number).slice(-4)}`,
        sortCode: a.sort_code,
        balance: `£${Number(a.balance).toLocaleString("en-GB", {
          minimumFractionDigits: 2,
        })}`,
        currency: a.currency,
        status: a.status,
      })),
    );
  },
  {
    name: "get_account_balance",
    description:
      "Get current balance and details for the user's bank accounts. " +
      "Use when user asks about balance, how much money they have, " +
      "what is left in their account, or any question about their funds.",
    schema: z.object({
      userId: z.string().describe("The authenticated user ID from session"),
    }),
  },
);

// ── Tool 3: Get transaction history ──────────────────────────────────────────
// Two-step lookup because getTransactions takes accountId not userId.
// Step 1: get all accounts for the user
// Step 2: get transactions for each account, merge and sort by date
const getTransactionsTool = tool(
  async ({ userId, limit }) => {
    // step 1 - find all accounts belonging to this user
    const accounts = await getAccountsByUserId(userId);

    if (!accounts?.length) {
      return "No accounts found for this user.";
    }

    // step 2 - get transactions for every account in parallel
    // Promise.all runs all the queries at the same time instead of one by one
    // faster than sequential when user has multiple accounts
    const allTransactions = await Promise.all(
      accounts.map((a: any) => getTransactions(a.id)),
    );

    // flatten the nested arrays into one list
    // sort newest first so the most recent transactions appear at the top
    // slice to the requested limit (default 10)
    const flat = allTransactions
      .flat()
      .sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
      .slice(0, limit ?? 10);

    if (!flat.length) {
      return "No transactions found.";
    }

    return JSON.stringify(
      flat.map((t: any) => ({
        date: t.date,
        description: t.description,
        // debit = money going OUT (negative), credit = money coming IN (positive)
        amount:
          t.type === "debit"
            ? `-£${Math.abs(t.amount).toFixed(2)}`
            : `+£${Number(t.amount).toFixed(2)}`,
        category: t.category,
        type: t.type,
      })),
    );
  },
  {
    name: "get_transactions",
    description:
      "Get recent transactions for the user's accounts. Use when user asks " +
      "about recent payments, spending history, or what they paid for recently.",
    schema: z.object({
      userId: z.string().describe("The authenticated user ID from session"),
      limit: z
        .number()
        .optional()
        .describe("How many transactions to return. Defaults to 10."),
    }),
  },
);

// ── Tool 4: Spending summary ──────────────────────────────────────────────────
// Aggregates transactions by category so Gemini can tell the user
// where their money is going without listing every transaction.
const getSpendingTool = tool(
  async ({ userId }) => {
    const accounts = await getAccountsByUserId(userId);
    if (!accounts?.length) return "No accounts found.";

    // get last 50 transactions across all accounts for meaningful summary
    const allTransactions = await Promise.all(
      accounts.map((a: any) => getTransactions(a.id)),
    );

    const flat = allTransactions.flat();

    // only look at debits - money going out is the spending
    const debits = flat.filter((t: any) => t.type === "debit");

    if (!debits.length) return "No spending found.";

    // group by category and sum the amounts
    const spending: Record<string, number> = {};
    debits.forEach((t: any) => {
      const cat = t.category ?? "Other";
      spending[cat] = (spending[cat] ?? 0) + Math.abs(Number(t.amount));
    });

    // sort highest spend first so the most expensive categories appear at top
    const sorted = Object.entries(spending)
      .sort(([, a], [, b]) => b - a)
      .map(([category, total]) => ({
        category,
        total: `£${total.toFixed(2)}`,
      }));

    const totalSpent = debits.reduce(
      (sum: number, t: any) => sum + Math.abs(Number(t.amount)),
      0,
    );

    return JSON.stringify({
      totalSpent: `£${totalSpent.toFixed(2)}`,
      byCategory: sorted,
    });
  },
  {
    name: "get_spending_summary",
    description:
      "Get a breakdown of the user's spending by category. Use when user asks " +
      "what they spent this month, where their money is going, or wants a " +
      "spending breakdown or category analysis.",
    schema: z.object({
      userId: z.string().describe("The authenticated user ID from session"),
    }),
  },
);

// ── Tools 5, 6, 7: Form triggers ─────────────────────────────────────────────
// These don't hit any database.
// They return an action flag as JSON.
// The chat API route reads that flag and tells the frontend which form to show.
// Keeps the form trigger logic in the agent where it belongs,
// not scattered across the API route like in prototype.1.
const loanFormTool = tool(
  async () => JSON.stringify({ action: "SHOW_LOAN_FORM" }),
  {
    name: "trigger_loan_form",
    description:
      "Open the loan or mortgage application form inline in the chat. " +
      "Use when user asks about applying for a loan, mortgage, or borrowing money.",
    schema: z.object({}),
  },
);

const appointmentTool = tool(
  async () => JSON.stringify({ action: "SHOW_APPOINTMENT_FORM" }),
  {
    name: "trigger_appointment",
    description:
      "Open the appointment booking form. Use when user wants to " +
      "speak to an advisor, book a call, or schedule a meeting.",
    schema: z.object({}),
  },
);

const creditCardTool = tool(
  async () => JSON.stringify({ action: "SHOW_CREDIT_CARD_FORM" }),
  {
    name: "trigger_credit_card",
    description:
      "Open the credit card application form. Use when user asks about " +
      "applying for a credit card or wants to know about card products.",
    schema: z.object({}),
  },
);

// ── All tools in one array ────────────────────────────────────────────────────
// This gets passed to Gemini via bindTools.
// Gemini reads the name and description of each tool to decide which to call.
const ALL_TOOLS = [
  knowledgeSearchTool,
  getBalanceTool,
  getTransactionsTool,
  getSpendingTool,
  loanFormTool,
  appointmentTool,
  creditCardTool,
];

// ── Gemini setup ──────────────────────────────────────────────────────────────
// temperature: 0.1 means very factual, low creativity.
// We want accurate banking info not poetic answers.
// bindTools sends ALL_TOOLS schemas to Gemini with every message.
// Gemini reads them and responds with either text or a tool call.
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.1,
}).bindTools(ALL_TOOLS);

// lookup map: tool name -> actual function
// when Gemini says "call get_account_balance"
// we find the real function here and run it
const toolMap = Object.fromEntries(ALL_TOOLS.map((t) => [t.name, t]));

// ── Node 1: Call Gemini ───────────────────────────────────────────────────────
// Sends the full message history plus system prompt to Gemini.
// Gemini responds with either:
// A - a text answer (we're done)
// B - tool call instructions (we go to executeTools)
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

// ── Node 2: Execute tools ─────────────────────────────────────────────────────
// Runs whatever tool(s) Gemini asked for.
// Gemini can ask for multiple tools in one turn - we run them in parallel.
// Results come back as ToolMessages which go back into the state.
// Then callModel runs again so Gemini can read the results and respond.
async function executeTools(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls ?? [];

  // Promise.all runs all tool calls at the same time - parallel not sequential
  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const toolFn = toolMap[toolCall.name];

      // tool not found - return error so Gemini handles it gracefully
      // rather than the whole request crashing
      if (!toolFn) {
        return new ToolMessage({
          content: `Tool ${toolCall.name} not found`,
          tool_call_id: toolCall.id!,
          name: toolCall.name,
        });
      }

      try {
        const result = await (toolFn as any).invoke(toolCall.args);
        return new ToolMessage({
          content: typeof result === "string" ? result : JSON.stringify(result),
          tool_call_id: toolCall.id!,
          name: toolCall.name,
        });
      } catch (err) {
        // tool crashed - return the error as a message
        // Gemini sees it and can tell the user something went wrong
        return new ToolMessage({
          content: `Tool ${toolCall.name} failed: ${err}`,
          tool_call_id: toolCall.id!,
          name: toolCall.name,
        });
      }
    }),
  );

  return { messages: results };
}

// ── Routing function ──────────────────────────────────────────────────────────
// After callModel, we check: did Gemini want a tool or is it done?
// tool_calls present = go run them
// no tool_calls = final answer, go to END
function shouldContinue(
  state: typeof MessagesAnnotation.State,
): "execute_tools" | typeof END {
  const last = state.messages[state.messages.length - 1] as AIMessage;
  const hasCalls = last.tool_calls && last.tool_calls.length > 0;
  return hasCalls ? "execute_tools" : END;
}

// ── Build the LangGraph ───────────────────────────────────────────────────────
// The graph defines the flow:
// START -> callModel -> (has tool calls?) -> executeTools -> callModel -> END
//
// This loop is what makes it an agent.
// Prototype.1 had no loop - it was a straight line.
// This loops until Gemini has no more tool calls and writes a final answer.
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("call_model", callModel)
  .addNode("execute_tools", executeTools)
  .addEdge(START, "call_model")
  .addConditionalEdges("call_model", shouldContinue)
  // after tools run, go BACK to callModel
  // Gemini reads the tool results and writes the final answer
  .addEdge("execute_tools", "call_model");

export const bankAgent = workflow.compile();

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AgentInput {
  message: string;
  userId: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AgentOutput {
  response: string;
  toolsUsed: string[];
  // if a form needs to show, this tells the frontend which one
  ctaAction?:
    | "SHOW_LOAN_FORM"
    | "SHOW_APPOINTMENT_FORM"
    | "SHOW_CREDIT_CARD_FORM";
}

// ── Main entry point ──────────────────────────────────────────────────────────
// This is what the chat API route calls.
// Everything above is internal - this is the public interface.
export async function runBankAgent(input: AgentInput): Promise<AgentOutput> {
  // cap history at 6 turns
  // prevents context window abuse
  // also limits how much a user can manipulate the model through conversation history
  const history = (input.conversationHistory ?? [])
    .slice(-6)
    .map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );

  // inject userId into the message so tools can use it
  // the user never types their own ID - we pull it from the session
  const userMessage = new HumanMessage(
    `[userId:${input.userId}] ${input.message}`,
  );

  // run the agent graph - this is the ReAct loop
  const result = await bankAgent.invoke({
    messages: [...history, userMessage],
  });

  const messages = result.messages as Array<
    AIMessage | HumanMessage | ToolMessage
  >;

  // find the last AI message that has no tool calls
  // that's the final answer Gemini wrote after reading all tool results
  const finalMessage = [...messages]
    .reverse()
    .find(
      (m): m is AIMessage =>
        m._getType() === "ai" && !(m as AIMessage).tool_calls?.length,
    );

  const responseText =
    typeof finalMessage?.content === "string"
      ? finalMessage.content
      : "I could not process that request. Please try again.";

  // collect names of every tool that ran during this turn
  // used for logging and the output guardrail
  const toolsUsed = messages
    .filter((m): m is ToolMessage => m._getType() === "tool")
    .map((m) => m.name ?? "")
    .filter(Boolean);

  // check if any tool returned a CTA action flag
  // form triggers return { action: "SHOW_LOAN_FORM" } etc
  const ctaAction = messages
    .filter((m): m is ToolMessage => m._getType() === "tool")
    .map((m) => {
      try {
        return JSON.parse(typeof m.content === "string" ? m.content : "{}");
      } catch {
        return {};
      }
    })
    .find((r) => r.action)?.action as AgentOutput["ctaAction"] | undefined;

  return { response: responseText, toolsUsed, ctaAction };
}
