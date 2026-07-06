/**
 * lib/loans/underwriting.ts
 *
 * Shared loan math, validation, and AI summary generation - used by both
 * the standalone /loan/apply form (via app/api/loan/route.ts) and the
 * conversational apply_for_loan agent tool, so the two entry points can't
 * drift apart on what counts as a valid application.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

export const ALLOWED_EMPLOYMENT = [
  "full-time",
  "part-time",
  "self-employed",
  "contractor",
  "retired",
] as const;

const FINANCIAL_RANGES: Record<string, [number, number]> = {
  salary: [100, 1_000_000],
  expenses: [0, 500_000],
  deposit: [1, 10_000_000],
  propertyValue: [1, 50_000_000],
  existingDebts: [0, 500_000],
  loanAmount: [1, 20_000_000],
  dti: [0, 200],
  ltv: [0, 200],
};

export interface LoanFinancials {
  salary: number;
  expenses: number;
  deposit: number;
  propertyValue: number;
  existingDebts: number;
  // How much the applicant wants to borrow - only meaningful for unsecured
  // loans (personal, car) where there's no property value to derive it
  // from. Ignored when propertyValue > 0 (property-backed loans derive
  // loanAmount from propertyValue - deposit instead).
  requestedAmount?: number;
}

export interface Affordability {
  loanAmount: number;
  dti: number;
  ltv: number;
}

// Same formulas the old inline form used client-side - now the one source
// of truth, computed server-side so the agent never has to do this math.
export function computeAffordability(f: LoanFinancials): Affordability {
  const loanAmount =
    f.propertyValue > 0 ? f.propertyValue - f.deposit : (f.requestedAmount ?? 0);
  const dti =
    f.salary > 0 ? Math.round(((f.expenses + f.existingDebts) / f.salary) * 100) : 0;
  const ltv = f.propertyValue > 0 ? Math.round((loanAmount / f.propertyValue) * 100) : 0;
  return { loanAmount, dti, ltv };
}

// Property value and deposit only make sense for a loan secured against a
// property - a mortgage, home purchase, remortgage, or buy-to-let. Personal
// loans, car loans, and other unsecured credit have no property to value.
const PROPERTY_BACKED_PURPOSES = ["mortgage", "home", "remortgage", "buy-to-let"];

export function validateLoanApplication(
  fields: Partial<Pick<LoanFinancials, "propertyValue" | "deposit">> &
    Omit<LoanFinancials, "propertyValue" | "deposit"> & {
      employment: string;
      loanPurpose?: string;
    },
): { valid: true } | { valid: false; error: string } {
  const { salary, propertyValue, deposit, employment, loanPurpose, requestedAmount } =
    fields;
  const requiresProperty =
    !loanPurpose || PROPERTY_BACKED_PURPOSES.includes(loanPurpose);

  if (!salary || !employment)
    return { valid: false, error: "Missing required fields." };

  if (requiresProperty && (!propertyValue || !deposit))
    return { valid: false, error: "Missing required fields." };

  if (requiresProperty && deposit! >= propertyValue!)
    return { valid: false, error: "Deposit cannot exceed the property value." };

  // Unsecured loans (personal, car) have no property to derive an amount
  // from - the applicant has to state how much they want to borrow instead.
  if (!requiresProperty && !requestedAmount)
    return { valid: false, error: "Missing required fields." };

  const { loanAmount, dti, ltv } = computeAffordability({
    ...fields,
    deposit: deposit ?? 0,
    propertyValue: propertyValue ?? 0,
  });

  const values: Record<string, number> = {
    salary,
    expenses: fields.expenses,
    existingDebts: fields.existingDebts,
    dti,
    loanAmount,
  };
  if (requiresProperty) {
    values.deposit = deposit!;
    values.propertyValue = propertyValue!;
    values.ltv = ltv;
  }

  for (const [field, [min, max]] of Object.entries(FINANCIAL_RANGES)) {
    if (!(field in values)) continue; // not applicable to this loan type
    const val = values[field];
    if (!Number.isFinite(val) || val < min || val > max)
      return { valid: false, error: `Invalid value for ${field}.` };
  }

  if (!ALLOWED_EMPLOYMENT.includes(employment.toLowerCase() as (typeof ALLOWED_EMPLOYMENT)[number]))
    return { valid: false, error: "Invalid employment type." };

  return { valid: true };
}

// Internal underwriter note - admin-only (see app/admin/loans/[id]/page.tsx).
// Never surface this to the customer-facing agent response.
export async function generateUnderwritingSummary(params: {
  userName: string;
  employment: string;
  salary: number;
  expenses: number;
  existingDebts: number;
  propertyValue: number;
  deposit: number;
  loanAmount: number;
  dti: number;
  ltv: number;
}): Promise<string> {
  try {
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.1,
      maxOutputTokens: 200,
    });
    const prompt =
      `You are a mortgage underwriter. Write a 3-sentence assessment for a loan officer.\n` +
      `Applicant: ${params.userName} | Employment: ${params.employment}\n` +
      `Salary: £${params.salary}/mo | Expenses: £${params.expenses}/mo | Existing debts: £${params.existingDebts}/mo\n` +
      `Property: £${params.propertyValue} | Deposit: £${params.deposit} | Loan: £${params.loanAmount}\n` +
      `DTI: ${params.dti}% | LTV: ${params.ltv}%\n\n` +
      `Be concise. End with "Risk: LOW", "Risk: MEDIUM", or "Risk: HIGH".`;

    const res = await llm.invoke([new HumanMessage(prompt)]);
    return res.content as string;
  } catch (e) {
    console.error("AI summary error:", e);
    return "Summary unavailable - please review manually.";
  }
}
