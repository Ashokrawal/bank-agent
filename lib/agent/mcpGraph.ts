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
 *
 * Prototype.3 change: real structured memory. Before this, the only thing
 * holding "salary: 2400, employment: full-time" together was the model
 * re-reading its own previous replies inside a 6-turn history window. Any
 * unusual turn (an unsupported loan type, a long detour, a typo the model
 * had to reparse) could make a confirmed fact vanish because there was
 * nowhere solid it actually lived.
 *
 * Now loanDraft/appointmentDraft are real state on the graph. The model
 * calls update_loan_draft / update_appointment_draft whenever it learns a
 * fact, those merge into the draft, and the current draft gets shown back
 * to the model at the top of every system prompt as settled ground truth,
 * not something it has to reconstruct from memory. apply_for_loan and
 * book_appointment also fall back to the draft for any field the model
 * forgets to pass explicitly when it finally submits.
 *
 * Important: this state only survives WITHIN one call to runBankAgent
 * (i.e. across the several call_model/execute_tools cycles that happen
 * while answering a single user message). It does NOT survive between
 * separate HTTP requests on its own - each new chat message is a fresh
 * invoke(). To carry the draft across turns, AgentInput/AgentOutput below
 * pass loanDraft/appointmentDraft in and out just like conversationHistory
 * already does, and the caller (the /api/chat route and the chat page) is
 * responsible for round-tripping them the same way it already round-trips
 * history.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  StateGraph,
  MessagesAnnotation,
  Annotation,
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
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { searchKnowledgeBase } from "@/lib/mcp/client";
import {
  createAppointment,
  createLoanApplication,
  dbRun,
} from "@/lib/db/sqlite";
import { v4 as uuid } from "uuid";
import {
  SLOT_TIMES,
  isValidSlotTime,
  validateBookingWindow,
  isSlotTaken,
  findNearbySlots,
} from "@/lib/appointments/availability";
import { sendAppointmentConfirmation } from "@/lib/email/sendAppointmentConfirmation";
import { sendLoanConfirmation } from "@/lib/email/sendLoanConfirmation";
import {
  ALLOWED_EMPLOYMENT,
  computeAffordability,
  validateLoanApplication,
  generateUnderwritingSummary,
} from "@/lib/loans/underwriting";

// ── Trusted per-request context ───────────────────────────────────────────────
// userId/userEmail/userName come from the server session, never from the
// model. They're passed into bankAgent.invoke() as config.configurable and
// read directly by the tools that need them - Gemini never sees them as
// fillable arguments and can't set or override them via the conversation.
interface AgentContext {
  userId: string;
  userEmail: string;
  userName: string;
}

function getAgentContext(config: RunnableConfig | undefined): AgentContext {
  const c = (config?.configurable ?? {}) as Partial<AgentContext>;
  return {
    userId: c.userId ?? "guest",
    userEmail: c.userEmail ?? "",
    userName: c.userName ?? "",
  };
}

// ── Draft state shapes ────────────────────────────────────────────────────────
// Partial - every field optional, filled in gradually as the conversation
// goes. Plain data, not prose, so nothing gets lost or misremembered.
export interface LoanDraft {
  loanPurpose?: string;
  currency?: "EUR" | "GBP";
  propertyValue?: number;
  deposit?: number;
  requestedAmount?: number;
  salary?: number;
  expenses?: number;
  employment?: string;
  existingDebts?: number;
}

export interface AppointmentDraft {
  advisorType?: string;
  preferredDate?: string;
  preferredTime?: string;
  reason?: string;
}

// ── Graph state ────────────────────────────────────────────────────────────────
// Extends the standard messages channel with two merge-on-write draft
// channels. The reducer just shallow-merges new fields into whatever's
// already there, so a tool call that only mentions "salary" doesn't wipe
// out "employment" collected two turns earlier.
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  loanDraft: Annotation<LoanDraft>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  appointmentDraft: Annotation<AppointmentDraft>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
});

function describeDraft<T extends object>(label: string, draft: T): string {
  const entries = Object.entries(draft).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (!entries.length) return `${label}: nothing collected yet.`;
  const parts = entries.map(([k, v]) => `${k}=${v}`).join(", ");
  return `${label}: ${parts}`;
}

// ── System prompt ─────────────────────────────────────────────────────────────
// Built fresh per call so "today" is always current, and so the current
// loan/appointment draft can be injected as settled ground truth instead of
// something the model has to reconstruct from its own past replies.
function getSystemPrompt(
  loanDraft: LoanDraft,
  appointmentDraft: AppointmentDraft,
  opts?: { toolsUnavailable?: boolean },
): string {
  const today = new Date().toISOString().split("T")[0];

  const fallbackNote = opts?.toolsUnavailable
    ? `\n\nNOTE FOR THIS TURN ONLY\nYou cannot call any tools right now. Just ` +
      `answer in plain text using PROGRESS SO FAR above and the conversation ` +
      `history. If the user just told you a new fact, restate it clearly in ` +
      `your reply so it isn't lost - it'll be recorded normally on the next ` +
      `turn. Don't mention tools or apologize for a technical issue, just ` +
      `respond naturally.`
    : "";

  return `IDENTITY
You are Nova, NovaBank's AI assistant. NovaBank is an Ireland-based bank.
You help people with product questions, loan applications, and booking
advisor appointments. You do not have access to account balances,
transactions, or money transfers - if asked about those, say plainly that
this assistant can't access account or transaction data and suggest the app
or an advisor instead. Today's date is ${today}.

PROGRESS SO FAR (treat this as settled fact, not something to re-ask)
${describeDraft("Loan application", loanDraft)}
${describeDraft("Appointment booking", appointmentDraft)}

Whenever the user gives you a new fact for either of these, call
update_loan_draft or update_appointment_draft immediately with just the new
field(s), don't wait until the end. This is what keeps facts from getting
lost, so treat it as part of collecting information, not a separate step.
Never ask again for something already listed above, and never restart a
workflow from scratch because something later confused you, just fill in
whatever's still missing.

CONVERSATION STYLE
Talk like a helpful person sitting across a desk, not a form reading
questions off a list. Before asking the next thing, acknowledge what the
user just told you, don't just chain questions together. If someone isn't
sure about an answer, help them work it out rather than repeating yourself.
Vary your phrasing between turns. Keep it warm but efficient - this is a
chat window, people want to get through this quickly, not have a long
conversation for its own sake.

KNOWLEDGE
Use search_knowledge_base for anything about NovaBank products, fees,
rates, policies, or how-to questions. Never invent a rate, fee, or policy
detail - if the tool returns nothing useful, say so honestly instead of
guessing.

LOAN WORKFLOW
NovaBank only offers these loan types through this assistant: mortgage,
personal, car, home, remortgage, buy-to-let. If someone asks for a loan
type outside that list (student loan, business loan, payday loan, etc.),
say plainly that NovaBank doesn't offer that type through this assistant,
and ask if they'd like to proceed with the closest supported type instead
(usually personal). Keep any figures they've already given you, salary,
expenses, employment don't change just because the loan type wasn't
supported, only the purpose field needs sorting out, call
update_loan_draft with the corrected purpose once they confirm.

Collect these through natural back-and-forth, not all at once, a couple of
questions per turn:
- loan purpose (mortgage, personal, car, home, remortgage, or buy-to-let -
  default to mortgage if the user doesn't say)
- monthly salary
- monthly expenses (see fallback below if they don't know)
- employment type (${ALLOWED_EMPLOYMENT.join(", ")})
- existing loan or credit repayments (default 0 if none)
- exactly one of the following two, never both, depending on loan purpose:
  - property value and deposit - ONLY for mortgage, home, remortgage, or
    buy-to-let. Personal and car loans have no property involved, don't
    ask for these two fields on those.
  - requested loan amount (how much they want to borrow) - ONLY for
    personal or car loans. Mortgage-type loans never need this, their
    loan amount comes from property value minus deposit instead.

If the user doesn't know their monthly expenses, don't just repeat the
question. Help them estimate it: ask roughly what they pay for rent or
mortgage, food, and transport, add it up together, then call
update_loan_draft with the total.

Before calling apply_for_loan, summarize everything in the loan draft above
in plain language and ask the user to confirm it's right. Only call the
tool after they confirm. This catches mistakes, like a currency mix-up,
before they hit the system instead of after.

If apply_for_loan reports invalid values (deposit bigger than property
value, a number out of range), explain the problem in plain language and
ask the user to correct it, then call update_loan_draft with the fix.
Don't call apply_for_loan again until they do.

Never mention DTI, LTV, or risk ratings unless the user asks about them
directly, that's internal underwriting language, not something customers
need to hear. If the email confirmation could not be sent, say the
application is submitted but be honest the email didn't go out.

APPOINTMENT WORKFLOW
Collect the advisor type (general, mortgage, investment, or business -
default to general if the user has no preference), a preferred date, and a
preferred time, one or two questions per turn, calling
update_appointment_draft as each one comes in. Resolve relative dates
("next Tuesday", "the 10th") into an ISO YYYY-MM-DD date using today's date
above. Bookable times are on the hour: ${SLOT_TIMES.join(", ")} (24h),
weekdays only, up to 3 months out.

Only call book_appointment once the appointment draft has a date and time.
If it reports the slot is taken or invalid, tell the user the alternatives
it returned in plain language, call update_appointment_draft once they pick
one, and wait for that before calling book_appointment again. If the email
confirmation could not be sent, say the booking is confirmed but be honest
the email didn't go out.

HARD RULES
- Always use a tool to get data, never invent rates, fees, or figures.
- Ask which currency the user's figures are in if it isn't stated. Format
  currency using that currency's symbol (EUR as EUR X,XXX.XX, GBP as GBP
  X,XXX.XX). NovaBank is Ireland-based, so if the user gives a number with
  no currency stated at all, assume EUR rather than GBP, but still confirm
  it back to them before submitting anything.
- Keep responses concise, users are in a chat interface, not reading an
  essay.
- You represent NovaBank. Accuracy matters more than sounding impressive.

EXAMPLES

Example - recording a fact as soon as it's given:
User: "2400 EUR a month"
Nova: [calls update_loan_draft with salary=2400, currency=EUR]
Nova: "Got it, 2,400 EUR a month. What's your employment type?"

Example - unsupported loan type:
User: "student loan"
Nova: "NovaBank doesn't offer student loans through this assistant, sorry
about that. Would a personal loan work instead for what you need?"

Example - user doesn't know an answer:
User: "I'm not sure about my monthly expenses"
Nova: "No worries, let's work it out together. Roughly what do you pay for
rent or mortgage each month, and about how much for food and transport?"

Example - personal/car loan needs a requested amount, not property/deposit:
User: "personal loan, 2400 EUR salary, full-time"
Nova: [calls update_loan_draft with loanPurpose=personal, salary=2400,
  currency=EUR, employment=full-time]
Nova: "Got it. How much would you like to borrow?"

Example - confirming before submitting:
Nova: "Here's what I've got: a personal loan of EUR 10,000, salary of EUR
2,400 a month, about EUR 900 in expenses, full-time employment, no existing
debts. Shall I go ahead and submit this?"
User: "yes"
Nova: [calls apply_for_loan]${fallbackNote}`;
}

// ── Tool 1: Search knowledge base via MCP ─────────────────────────────────────
const knowledgeSearchTool = tool(
  async ({ query, filter_type }) => {
    const results = await searchKnowledgeBase(query, filter_type);
    return results;
  },
  {
    name: "search_knowledge_base",
    description:
      "Search NovaBank knowledge base for products, policies, fees, " +
      "mortgage rates, savings rates, account types, how-to guides, " +
      "and general banking questions. Use for anything about NovaBank " +
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

// ── Tool 2: Update the loan draft ─────────────────────────────────────────────
// Doesn't touch the database. Just a way for the model to say "here's a
// fact I just learned" and have it actually persist as state rather than
// living only in its own previous reply. executeTools merges whatever this
// returns into the graph's loanDraft channel.
const loanDraftSchema = z.object({
  loanPurpose: z
    .enum(["mortgage", "personal", "car", "home", "remortgage", "buy-to-let"])
    .optional(),
  currency: z.enum(["EUR", "GBP"]).optional(),
  propertyValue: z.number().optional(),
  deposit: z.number().optional(),
  requestedAmount: z.number().optional(),
  salary: z.number().optional(),
  expenses: z.number().optional(),
  employment: z.enum(ALLOWED_EMPLOYMENT).optional(),
  existingDebts: z.number().optional(),
});

const updateLoanDraftTool = tool(async (args) => JSON.stringify(args), {
  name: "update_loan_draft",
  description:
    "Record one or more loan application facts you've just learned from " +
    "the user (loan purpose, currency, salary, expenses, employment, " +
    "existing debts, property value, deposit, requested loan amount). " +
    "Call this as soon as you learn something, don't wait until the end - " +
    "only pass the field(s) you just learned, not the whole application.",
  schema: loanDraftSchema,
});

// ── Tool 3: Update the appointment draft ──────────────────────────────────────
const appointmentDraftSchema = z.object({
  advisorType: z
    .enum(["general", "mortgage", "investment", "business"])
    .optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  reason: z.string().optional(),
});

const updateAppointmentDraftTool = tool(async (args) => JSON.stringify(args), {
  name: "update_appointment_draft",
  description:
    "Record one or more appointment booking facts you've just learned from " +
    "the user (advisor type, preferred date, preferred time, reason). Call " +
    "this as soon as you learn something, don't wait until the end.",
  schema: appointmentDraftSchema,
});

// ── Tool: Apply for a loan ────────────────────────────────────────────────────
// Real fields filled in from conversation, validated and computed with the
// shared lib/loans/underwriting helpers (the same ones the standalone
// /loan/apply form's API route uses), so both entry points agree on what's
// valid. The AI underwriter summary is admin-only (see
// app/admin/loans/[id]/page.tsx) - it's written to the DB but never included
// in the tool's return value, so the model can't repeat it to the customer.
//
// executeTools merges the current loanDraft into these args before calling
// invoke(), so even if the model forgets to restate a field it already
// recorded via update_loan_draft, the submission still has it.
const applyForLoanTool = tool(
  async (
    {
      loanPurpose,
      propertyValue,
      deposit,
      requestedAmount,
      salary,
      expenses,
      employment,
      existingDebts,
      currency,
    },
    config,
  ) => {
    const { userId, userEmail, userName } = getAgentContext(config);

    // salary/employment are optional in the schema so a call can omit a
    // field already recorded in the draft (executeTools merges the draft
    // in as a fallback before invoke()) - if it's still missing after that
    // merge, neither the model nor the draft has it, so bail out here.
    if (salary === undefined || employment === undefined) {
      return JSON.stringify({
        error: "invalid_application",
        message: "Missing required fields.",
      });
    }

    const validation = validateLoanApplication({
      salary,
      expenses: expenses ?? 0,
      deposit,
      propertyValue,
      existingDebts: existingDebts ?? 0,
      employment,
      loanPurpose,
      requestedAmount,
    });
    if (!validation.valid) {
      return JSON.stringify({
        error: "invalid_application",
        message: validation.error,
      });
    }

    const financials = {
      salary,
      expenses: expenses ?? 0,
      deposit: deposit ?? 0,
      propertyValue: propertyValue ?? 0,
      existingDebts: existingDebts ?? 0,
    };

    // requestedAmount only feeds the loanAmount calculation for unsecured
    // loans (see computeAffordability) - it's not a DB column, so it's
    // never spread into createLoanApplication below, just recorded in the
    // answers JSON blob for the audit trail.
    const { loanAmount, dti, ltv } = computeAffordability({
      ...financials,
      requestedAmount,
    });

    const aiSummary = await generateUnderwritingSummary({
      userName,
      employment,
      ...financials,
      loanAmount,
      dti,
      ltv,
    });

    const id = uuid();
    await createLoanApplication({
      id,
      userId,
      userName,
      email: userEmail,
      ...financials,
      employmentType: employment,
      loanAmount,
      dti,
      ltv,
      answers: JSON.stringify({
        loanPurpose,
        employment,
        currency: currency ?? "EUR",
        requestedAmount,
        ...financials,
      }),
    });

    await dbRun(`UPDATE loan_applications SET ai_summary = ? WHERE id = ?`, [
      aiSummary,
      id,
    ]);

    const emailSent = await sendLoanConfirmation({
      to: userEmail,
      userName,
      loanPurpose: loanPurpose ?? "mortgage",
      propertyValue: financials.propertyValue,
      deposit: financials.deposit,
      loanAmount,
    });

    return JSON.stringify({
      action: "SHOW_LOAN_CONFIRMATION",
      loanPurpose: loanPurpose ?? "mortgage",
      propertyValue: financials.propertyValue,
      deposit: financials.deposit,
      loanAmount,
      currency: currency ?? "EUR",
      employment,
      emailSent,
    });
  },
  {
    name: "apply_for_loan",
    description:
      "Submit a loan or mortgage application for human review once the loan " +
      "draft has salary, employment type, and currency, plus either property " +
      "value and deposit (for mortgage, home, remortgage, or buy-to-let) or " +
      "a requested loan amount (for personal or car loans). Confirm the " +
      "summary with the user before calling this - only call it once " +
      "they've explicitly agreed to submit.",
    schema: z.object({
      loanPurpose: z
        .enum([
          "mortgage",
          "personal",
          "car",
          "home",
          "remortgage",
          "buy-to-let",
        ])
        .optional()
        .describe("What the loan is for. Default to mortgage if unspecified."),
      currency: z
        .enum(["EUR", "GBP"])
        .optional()
        .describe(
          "Currency the applicant's figures are in. Ask if not stated, " +
            "default to EUR if the user never clarifies. Never assume GBP.",
        ),
      propertyValue: z
        .number()
        .optional()
        .describe(
          "Property value in the stated currency - only required for " +
            "mortgage, home, remortgage, or buy-to-let loans",
        ),
      deposit: z
        .number()
        .optional()
        .describe(
          "Deposit amount in the stated currency, must be less than " +
            "property value - only required for mortgage, home, " +
            "remortgage, or buy-to-let loans",
        ),
      requestedAmount: z
        .number()
        .optional()
        .describe(
          "How much the applicant wants to borrow, in the stated currency - " +
            "only required for personal or car loans (loans with no " +
            "property). Not applicable to mortgage, home, remortgage, or " +
            "buy-to-let loans, which derive the loan amount from property " +
            "value minus deposit instead.",
        ),
      salary: z
        .number()
        .optional()
        .describe(
          "Applicant's monthly salary in the stated currency. Optional here " +
            "because it will fall back to the loan draft if omitted, but " +
            "provide it directly when you have it.",
        ),
      expenses: z
        .number()
        .optional()
        .describe(
          "Applicant's monthly expenses in the stated currency, default 0",
        ),
      employment: z
        .enum(ALLOWED_EMPLOYMENT)
        .optional()
        .describe(
          "Applicant's employment type. Optional here for the same reason " +
            "as salary, falls back to the loan draft if omitted.",
        ),
      existingDebts: z
        .number()
        .optional()
        .describe(
          "Existing monthly loan/credit repayments in the stated currency, default 0",
        ),
    }),
  },
);

// ── Tool: Book an appointment ─────────────────────────────────────────────────
// executeTools merges the current appointmentDraft into these args the same
// way it does for apply_for_loan, so a forgotten field still falls back to
// whatever's already been recorded via update_appointment_draft.
const bookAppointmentTool = tool(
  async ({ advisorType, preferredDate, preferredTime, reason }, config) => {
    const { userId, userEmail, userName } = getAgentContext(config);
    const type = advisorType ?? "general";

    if (!preferredTime || !isValidSlotTime(preferredTime)) {
      return JSON.stringify({
        error: "invalid_time",
        message: `${preferredTime ?? "(missing)"} is not a bookable time.`,
        validTimes: SLOT_TIMES,
      });
    }

    if (!preferredDate) {
      return JSON.stringify({
        error: "invalid_date",
        message: "No date was provided.",
      });
    }

    const window = validateBookingWindow(preferredDate);
    if (!window.valid) {
      return JSON.stringify({
        error: "invalid_date",
        message: `${preferredDate} is not bookable: ${window.reason}.`,
      });
    }

    if (await isSlotTaken(type, preferredDate, preferredTime)) {
      const alternatives = await findNearbySlots(
        type,
        preferredDate,
        preferredTime,
      );
      return JSON.stringify({
        error: "slot_taken",
        message: "That slot is already booked.",
        alternatives,
      });
    }

    const id = uuid();
    await createAppointment({
      id,
      userId,
      userName,
      email: userEmail,
      advisorType: type,
      preferredDate,
      preferredTime,
      reason: reason ?? "",
    });

    const emailSent = await sendAppointmentConfirmation({
      to: userEmail,
      userName,
      advisorType: type,
      preferredDate,
      preferredTime,
      reason,
    });

    return JSON.stringify({
      action: "SHOW_APPOINTMENT_CONFIRMATION",
      advisorType: type,
      preferredDate,
      preferredTime,
      reason: reason ?? "",
      emailSent,
    });
  },
  {
    name: "book_appointment",
    description:
      "Book an appointment with a NovaBank advisor once the appointment " +
      "draft has a date and time. Use when the user wants to speak to an " +
      "advisor, book a call, or schedule a meeting - only call this after " +
      "collecting date and time through conversation, not on the first ask.",
    schema: z.object({
      advisorType: z
        .enum(["general", "mortgage", "investment", "business"])
        .optional()
        .describe(
          "Type of advisor. Default to general if the user has no preference.",
        ),
      preferredDate: z
        .string()
        .optional()
        .describe(
          "ISO date YYYY-MM-DD, resolved from natural language relative to " +
            "today's date. Optional here, falls back to the appointment " +
            "draft if omitted.",
        ),
      preferredTime: z
        .string()
        .optional()
        .describe(
          `24-hour HH:MM, must be one of: ${SLOT_TIMES.join(", ")}. Optional ` +
            "here, falls back to the appointment draft if omitted.",
        ),
      reason: z
        .string()
        .optional()
        .describe("Optional free-text reason for the appointment"),
    }),
  },
);

// NOT currently registered in ALL_TOOLS - credit card applications haven't
// been reviewed for the same Annex III creditworthiness-assessment scrutiny
// the loan tool went through. Re-add once that review is done.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
const ALL_TOOLS = [
  knowledgeSearchTool,
  updateLoanDraftTool,
  updateAppointmentDraftTool,
  applyForLoanTool,
  bookAppointmentTool,
];

// draft-only tools never touch the DB or email, kept as a named set purely
// so executeTools can special-case merging their output into graph state.
const DRAFT_TOOL_NAMES = new Set([
  "update_loan_draft",
  "update_appointment_draft",
]);

// ── Gemini setup ──────────────────────────────────────────────────────────────
const MAX_TOOL_ATTEMPTS = 2; // primary call + 1 nudge retry, both tool-bound

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.1,
}).bindTools(ALL_TOOLS);

// Used for a single retry when the primary model returns a genuinely empty
// completion (0 completion tokens, finishReason STOP) for a given input.
const retryModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
}).bindTools(ALL_TOOLS);

// Guaranteed-answer fallback, used only if both tool-bound attempts above
// still come back empty. Deliberately has NO bindTools() call at all.
//
// Root cause (confirmed by direct A/B testing against the live API, and
// matched by known upstream reports - langchain-ai/langchain-google#1020,
// #936; langchain-ai/deepagents#417): gemini-2.5-flash's function-calling
// path can deterministically return a 0-token completion for certain
// prompt/tool-schema combinations. It's not sampling noise - the SAME
// input reproduces the empty result 100% of the time regardless of
// temperature or nudge messages, correlating with prompt/schema size
// (this app's 5-tool schema runs ~2964 tokens vs ~65 with no tools bound).
// This is a known, currently-unresolved issue with the model/SDK, not a
// bug in this codebase - dropping tool-calling ability entirely for this
// one call is what reliably produces a real answer (proven 4/4 in testing).
const fallbackModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
});

const toolMap = Object.fromEntries(ALL_TOOLS.map((t) => [t.name, t]));

// Gemini occasionally returns a genuinely empty completion - no tool call
// and no text, just `content: []`. Nothing is wrong with the conversation
// when this happens, it's a flaky generation. Since shouldContinue treats
// "no tool calls" as "done", an empty completion used to end the turn on
// a blank message with no way to recover, surfacing as a generic failure
// to the user even though nothing actually errored.
// AIMessage.content isn't always a plain string - LangChain types it as
// string | MessageContentComplex[], and the google-genai integration can
// return an array of parts. Pull the text out of either shape rather than
// silently treating a non-string content as "no answer".
function extractText(content: unknown): string | null {
  if (typeof content === "string") return content.trim() ? content : null;
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === "string"
          ? part
          : typeof part === "object" && part && "text" in part
            ? String((part as { text: unknown }).text ?? "")
            : "",
      )
      .join("")
      .trim();
    return text || null;
  }
  return null;
}

function isEmptyCompletion(message: AIMessage): boolean {
  const hasToolCalls = (message.tool_calls?.length ?? 0) > 0;
  const hasText = extractText(message.content) !== null;
  return !hasToolCalls && !hasText;
}

// Structured log for every phase of the empty-completion mitigation below,
// tagged so it's easy to grep/alert on in server logs. This is a known,
// currently-unresolved upstream Gemini/langchain issue (see the comment on
// fallbackModel above) - logging real frequency here is what lets anyone
// decide later whether further mitigation (e.g. trimming tool schema size)
// is actually worth investing in, instead of guessing.
function logEmptyCompletion(fields: Record<string, unknown>) {
  console.error(
    "[GeminiEmptyCompletion]",
    JSON.stringify({ timestamp: new Date().toISOString(), ...fields }),
  );
}

// ── Node 1: Call Gemini ───────────────────────────────────────────────────────
async function callModel(
  state: typeof AgentState.State,
  config: RunnableConfig,
) {
  const { userId } = getAgentContext(config);
  const baseMessages = [
    new SystemMessage(getSystemPrompt(state.loanDraft, state.appointmentDraft)),
    ...state.messages,
  ];

  // Phase 1: tool-bound attempts (primary + one nudge retry). A retry
  // rarely recovers this specific failure (it's deterministic given
  // identical input, not sampling noise) but it's cheap and does work
  // sometimes once the nudge message changes the actual input tokens.
  let response = await model.invoke(baseMessages);
  let attempt = 0;
  let retryMessages = baseMessages;

  while (isEmptyCompletion(response) && attempt < MAX_TOOL_ATTEMPTS - 1) {
    attempt++;
    logEmptyCompletion({ userId, phase: "tool_retry", attempt });
    retryMessages = [
      ...retryMessages,
      new HumanMessage(
        "(Your last response was empty - reply now, either with a tool call or a direct answer to my last message.)",
      ),
    ];
    response = await retryModel.invoke(retryMessages);
  }

  if (!isEmptyCompletion(response)) {
    if (attempt > 0) {
      logEmptyCompletion({ userId, phase: "recovered_via_tool_retry", attempt });
    }
    return { messages: [response] };
  }

  // Phase 2: guaranteed-answer fallback - no tools bound at all. See the
  // comment on fallbackModel above for why this is the reliable path.
  logEmptyCompletion({ userId, phase: "falling_back_no_tools", attempt });
  const fallbackMessages = [
    new SystemMessage(
      getSystemPrompt(state.loanDraft, state.appointmentDraft, {
        toolsUnavailable: true,
      }),
    ),
    ...state.messages,
  ];
  let fallbackResponse: AIMessage = await fallbackModel.invoke(fallbackMessages);

  if (isEmptyCompletion(fallbackResponse)) {
    // Never observed in testing, but must not loop forever or silently
    // reproduce the old generic message unlogged - this is a genuine hard
    // failure, distinct from the two recoverable phases above.
    logEmptyCompletion({ userId, phase: "hard_failure" });
    fallbackResponse = new AIMessage(
      "Sorry, I'm having trouble responding right now - could you try rephrasing that, or try again in a moment?",
    );
  } else {
    logEmptyCompletion({ userId, phase: "recovered_via_no_tools_fallback" });
  }

  return { messages: [fallbackResponse] };
}

// ── Node 2: Execute tools ─────────────────────────────────────────────────────
// Runs whatever tool(s) Gemini asked for. Two special cases beyond the
// original behaviour:
// - update_loan_draft / update_appointment_draft: merge their args straight
//   into the matching draft channel, don't just log them as a ToolMessage.
// - apply_for_loan / book_appointment: merge the current draft in as
//   defaults underneath whatever the model explicitly passed, so a
//   forgotten field still falls back to what's already been recorded.
async function executeTools(
  state: typeof AgentState.State,
  config: RunnableConfig,
) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls ?? [];

  let loanDraftUpdate: LoanDraft = {};
  let appointmentDraftUpdate: AppointmentDraft = {};

  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const toolFn = toolMap[toolCall.name];

      if (!toolFn) {
        return new ToolMessage({
          content: `Tool ${toolCall.name} not found`,
          tool_call_id: toolCall.id!,
          name: toolCall.name,
        });
      }

      try {
        let args = toolCall.args as Record<string, unknown>;

        if (toolCall.name === "apply_for_loan") {
          args = { ...state.loanDraft, ...args };
        }
        if (toolCall.name === "book_appointment") {
          args = { ...state.appointmentDraft, ...args };
        }

        const result = await (toolFn as any).invoke(args, config);

        if (toolCall.name === "update_loan_draft") {
          loanDraftUpdate = {
            ...loanDraftUpdate,
            ...(toolCall.args as LoanDraft),
          };
        }
        if (toolCall.name === "update_appointment_draft") {
          appointmentDraftUpdate = {
            ...appointmentDraftUpdate,
            ...(toolCall.args as AppointmentDraft),
          };
        }

        const content =
          typeof result === "string" ? result : JSON.stringify(result);
        return new ToolMessage({
          content: DRAFT_TOOL_NAMES.has(toolCall.name)
            ? `Noted: ${content}`
            : content,
          tool_call_id: toolCall.id!,
          name: toolCall.name,
        });
      } catch (err) {
        console.error(`Tool ${toolCall.name} failed:`, err);
        return new ToolMessage({
          content: `Tool ${toolCall.name} failed. Tell the user something went wrong and to try again.`,
          tool_call_id: toolCall.id!,
          name: toolCall.name,
        });
      }
    }),
  );

  return {
    messages: results,
    loanDraft: loanDraftUpdate,
    appointmentDraft: appointmentDraftUpdate,
  };
}

// ── Routing function ──────────────────────────────────────────────────────────
function shouldContinue(
  state: typeof AgentState.State,
): "execute_tools" | typeof END {
  const last = state.messages[state.messages.length - 1] as AIMessage;
  const hasCalls = last.tool_calls && last.tool_calls.length > 0;
  return hasCalls ? "execute_tools" : END;
}

// ── Build the LangGraph ───────────────────────────────────────────────────────
const workflow = new StateGraph(AgentState)
  .addNode("call_model", callModel)
  .addNode("execute_tools", executeTools)
  .addEdge(START, "call_model")
  .addConditionalEdges("call_model", shouldContinue)
  .addEdge("execute_tools", "call_model");

export const bankAgent = workflow.compile();

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AgentInput {
  message: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  // round-tripped from the previous turn's AgentOutput - the caller stores
  // these (client-side, or wherever conversation state lives) and sends
  // them back with each new message, same pattern already used for
  // conversationHistory.
  loanDraft?: LoanDraft;
  appointmentDraft?: AppointmentDraft;
}

export interface AgentOutput {
  response: string;
  toolsUsed: string[];
  ctaAction?:
    | "SHOW_LOAN_CONFIRMATION"
    | "SHOW_APPOINTMENT_CONFIRMATION"
    | "SHOW_CREDIT_CARD_FORM";
  ctaData?: Record<string, unknown>;
  // current draft state after this turn - send this back on the next call
  loanDraft: LoanDraft;
  appointmentDraft: AppointmentDraft;
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function runBankAgent(input: AgentInput): Promise<AgentOutput> {
  const history = (input.conversationHistory ?? [])
    .slice(-6)
    .map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    );

  const userMessage = new HumanMessage(input.message);

  const result = await bankAgent.invoke(
    {
      messages: [...history, userMessage],
      loanDraft: input.loanDraft ?? {},
      appointmentDraft: input.appointmentDraft ?? {},
    },
    {
      configurable: {
        userId: input.userId,
        userEmail: input.userEmail ?? "",
        userName: input.userName ?? "",
      },
    },
  );

  const messages = result.messages as Array<
    AIMessage | HumanMessage | ToolMessage
  >;

  const finalMessage = [...messages]
    .reverse()
    .find(
      (m): m is AIMessage =>
        m._getType() === "ai" && !(m as AIMessage).tool_calls?.length,
    );

  const responseText =
    extractText(finalMessage?.content) ??
    "I could not process that request. Please try again.";

  const toolsUsed = messages
    .filter((m): m is ToolMessage => m._getType() === "tool")
    .map((m) => m.name ?? "")
    .filter(Boolean);

  const ctaResult = messages
    .filter((m): m is ToolMessage => m._getType() === "tool")
    .map((m) => {
      try {
        return JSON.parse(typeof m.content === "string" ? m.content : "{}");
      } catch {
        return {};
      }
    })
    .find((r) => r.action);

  const ctaAction = ctaResult?.action as AgentOutput["ctaAction"] | undefined;
  const { action: _action, ...ctaData } = ctaResult ?? {};
  void _action;

  return {
    response: responseText,
    toolsUsed,
    ctaAction,
    ctaData: ctaAction ? ctaData : undefined,
    loanDraft: result.loanDraft ?? {},
    appointmentDraft: result.appointmentDraft ?? {},
  };
}
