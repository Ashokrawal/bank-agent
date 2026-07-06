/**
 * data/knowledge/products.ts
 * NovaBank - Product sheets for ChromaDB RAG
 *
 * Each product is its own document chunk.
 * Written to be self-contained - the chunk answers questions
 * about that product without needing any other context.
 */

export interface ProductEntry {
  id: string;
  name: string;
  type: string;
  content: string;
}

export const PRODUCT_DATA: ProductEntry[] = [
  {
    id: "prod-001",
    name: "Standard Current Account",
    type: "current",
    content:
      "NovaBank Standard Current Account is a free everyday bank account with no monthly fee. Features: Visa debit card for UK and international payments, instant UK transfers via Faster Payments up to £250,000, mobile and online banking 24 hours, contactless payments, Apple Pay and Google Pay support, real-time transaction notifications. Limits: £500 daily ATM limit (increase to £1,000 temporarily in app), £250,000 per Faster Payment. No minimum monthly deposit. Overdraft available up to £1,500 at 39.9% EAR. FSCS protected up to £85,000. Suitable for: anyone wanting a free UK current account.",
  },
  {
    id: "prod-002",
    name: "Premium Current Account",
    type: "current",
    content:
      "NovaBank Premium Current Account costs £9.99 per month and includes benefits worth over £30 per month for regular travellers. Benefits: worldwide travel insurance covering medical, cancellation, and baggage, UK and European breakdown cover, fee-free spending and ATM withdrawals worldwide, 1% cashback on all card spending for the first 6 months, £1,000 daily ATM limit as standard, priority phone support with no queue. Everything in the Standard Account is included. Best for: people who travel regularly or spend abroad frequently.",
  },
  {
    id: "prod-003",
    name: "Easy Access Savings Account",
    type: "savings",
    content:
      "NovaBank Easy Access Saver pays 4.5% AER variable interest. No lock-in period - withdraw anytime without penalty. Minimum opening balance £1. Maximum balance £500,000. Interest calculated daily, paid monthly. Rate is variable meaning it can go up or down. Manage entirely through the app or online banking. Good for: emergency funds, short-term savings, anyone who may need access to their money quickly.",
  },
  {
    id: "prod-004",
    name: "Fixed 1-Year Bond",
    type: "savings",
    content:
      "NovaBank Fixed 1-Year Bond pays 5.1% AER fixed for 12 months. Minimum deposit £1,000, maximum £500,000. No withdrawals allowed during the term - your money is locked in for 12 months in exchange for the guaranteed fixed rate. Interest paid at maturity. On maturity your funds roll into Easy Access Saver automatically unless you instruct otherwise. Good for: money you will not need for a year that you want earning the best rate.",
  },
  {
    id: "prod-005",
    name: "Fixed 2-Year Bond",
    type: "savings",
    content:
      "NovaBank Fixed 2-Year Bond pays 5.3% AER fixed for 24 months - the highest rate NovaBank offers. Minimum deposit £1,000, maximum £500,000. No withdrawals for 2 years. Interest paid annually and at maturity. Rate is guaranteed regardless of Bank of England base rate changes during the term. Good for: longer-term savings goals where you are confident you will not need the money for 2 years.",
  },
  {
    id: "prod-006",
    name: "Cash ISA",
    type: "isa",
    content:
      "NovaBank Cash ISA pays 4.6% AER tax-free. Annual ISA allowance is £20,000 per tax year (April to April). All interest earned is free of UK income tax and capital gains tax. Flexible ISA - you can withdraw and replace funds in the same tax year without losing your allowance. Transfer in existing ISAs from other providers without affecting your annual allowance. Minimum opening £1. Good for: higher-rate taxpayers, anyone wanting to protect interest from tax.",
  },
  {
    id: "prod-007",
    name: "Junior ISA",
    type: "isa",
    content:
      "NovaBank Junior ISA pays 4.8% AER tax-free for children under 18. Annual allowance £9,000 per tax year. Opened by a parent or guardian, managed on behalf of the child. Child cannot access the money until they turn 18 when it converts to an adult ISA. Contributions from family members are allowed up to the annual limit. Good for: parents saving for their children's future, university costs, or a first home deposit.",
  },
  {
    id: "prod-008",
    name: "Residential Mortgage",
    type: "mortgage",
    content:
      "NovaBank residential mortgages for purchasing or remortgaging a home. Fixed rates from 4.2% for 2-year fix and 4.5% for 5-year fix. Tracker mortgage from 3.9% above Bank of England base rate. Minimum deposit 10% (5% for first-time buyers with government scheme). Borrow up to 4.5 times annual income. Repayment or interest-only options. No early repayment charge on tracker mortgages. Fixed rate products have ERCs in years 1 to 2. Free valuation on applications above £150,000. Decision in principle within 24 hours. Full application takes 3 to 4 weeks.",
  },
  {
    id: "prod-009",
    name: "Personal Loan",
    type: "loan",
    content:
      "NovaBank personal loans from £1,000 to £25,000 over 1 to 7 years. Representative APR 6.9% for loans £7,500 to £25,000. Smaller amounts have higher representative APR. Instant decision in the app. Same-day funding if approved before 3pm. No early repayment penalties. Fixed monthly repayments throughout the term. Not for business purposes. You must be a NovaBank account holder for at least 3 months to apply, or a new customer subject to full credit assessment.",
  },
  {
    id: "prod-010",
    name: "Cashback Credit Card",
    type: "credit_card",
    content:
      "NovaBank Cashback Credit Card earns 1% cashback on all UK spending and 0.5% on international spending. No annual fee. 0% interest on purchases for the first 3 months. After that, 22.9% APR representative variable. £5,000 credit limit for eligible applicants. Minimum monthly payment is the higher of 1% of balance or £25. Cashback paid to your NovaBank current account monthly. Requires credit check. Best for: everyday spending with a free card.",
  },
  {
    id: "prod-011",
    name: "Premium Rewards Credit Card",
    type: "credit_card",
    content:
      "NovaBank Premium Rewards Credit Card costs £12 per month and earns 2% cashback on all spending worldwide. Benefits: Priority Pass airport lounge access (2 free visits per year), worldwide travel insurance, 0% foreign transaction fees, concierge service, purchase protection up to £1,000 per item. £10,000 credit limit for eligible applicants. 19.9% APR representative variable on purchases. Best for: frequent travellers who want rewards and travel benefits from their credit card.",
  },
];
