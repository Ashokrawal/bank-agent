/**
 * data/knowledge/faqs.ts
 * NovaBanк - FAQ knowledge base for ChromaDB RAG
 *
 * These are chunked into ChromaDB as individual documents.
 * Each entry is one chunk - write them to be self-contained
 * so the answer makes sense without needing surrounding context.
 *
 * 30+ FAQs across 8 categories - much richer than Prototype.1
 */

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const FAQ_DATA: FAQEntry[] = [
  // ── ACCOUNTS ────────────────────────────────────────────────────────────────
  {
    id: "faq-001",
    question: "How do I open a NovaBanк account?",
    answer:
      "Opening a NovaBanк account takes about 10 minutes online. You need a valid photo ID (passport or driving licence), proof of address dated within 3 months (utility bill or bank statement), your National Insurance number, and an initial deposit of at least £10. Start through the chat assistant or visit any branch. Most accounts are verified instantly. You will receive your account number and sort code immediately on approval.",
    category: "accounts",
  },
  {
    id: "faq-002",
    question: "What documents do I need to open an account?",
    answer:
      "To open a NovaBanк account you need three things. Primary ID - passport, national ID card, or driving licence (must be valid, not expired). Proof of address - utility bill, council tax letter, or bank statement dated within the last 3 months. National Insurance or Tax ID number. We also take a selfie for identity verification. Expired documents are not accepted under any circumstances.",
    category: "accounts",
  },
  {
    id: "faq-003",
    question: "How long does account verification take?",
    answer:
      "Most accounts are verified instantly through our automated KYC system. If additional checks are needed - usually for complex cases or mismatched documents - verification takes 1 to 2 business days. You get an email and SMS once your account is active. You can track application status in the app under Profile > Application Status.",
    category: "accounts",
  },
  {
    id: "faq-004",
    question: "Can I open a joint account?",
    answer:
      "Yes. NovaBanк joint accounts work for two people. Both account holders complete identity verification separately - each receives a verification link by email. Both can transact freely on the account. Either holder can freeze the card, but closing the account requires consent from both. Joint accounts are protected up to £170,000 under the FSCS scheme.",
    category: "accounts",
  },
  {
    id: "faq-005",
    question: "Can I have more than one account with NovaBanк?",
    answer:
      "Yes. You can hold a current account, a savings account, and a Cash ISA simultaneously. You cannot hold two current accounts of the same type. If you have a Standard Current Account and want to upgrade to Premium, you convert rather than open a second one. Business accounts are separate from personal accounts and can be held at the same time.",
    category: "accounts",
  },

  // ── SAVINGS AND RATES ────────────────────────────────────────────────────────
  {
    id: "faq-006",
    question: "What are NovaBanк savings interest rates?",
    answer:
      "NovaBanк savings rates as of 2025: Easy Access Saver 4.5% AER variable, withdraw anytime. Fixed 1-Year Bond 5.1% AER fixed, no withdrawals during term. Fixed 2-Year Bond 5.3% AER fixed. Cash ISA 4.6% AER tax-free, up to £20,000 per year. Junior ISA 4.8% AER tax-free for under 18s. Rates may change - fixed bonds lock your rate at the time of opening.",
    category: "savings",
  },
  {
    id: "faq-007",
    question: "What is the difference between AER and gross rate?",
    answer:
      "AER stands for Annual Equivalent Rate - it shows what you would earn if interest was paid and compounded once a year. Gross rate is the interest rate before tax, without compounding. AER lets you compare accounts fairly regardless of how often they pay interest. NovaBanк quotes both - AER is the standardised comparison figure.",
    category: "savings",
  },
  {
    id: "faq-008",
    question: "How does a Cash ISA work?",
    answer:
      "A Cash ISA is a tax-free savings account. You can deposit up to £20,000 per tax year. Interest earned is completely free of UK income tax. NovaBanк Cash ISA pays 4.6% AER. You can transfer existing ISAs from other providers to NovaBanк without using your annual allowance. Withdrawals are allowed but in a flexible ISA you can replace what you withdraw in the same tax year.",
    category: "savings",
  },
  {
    id: "faq-009",
    question: "Can I withdraw from a fixed-rate bond early?",
    answer:
      "No. NovaBanк fixed-rate bonds do not allow early withdrawals during the fixed term. Your money is locked in for the full 1 or 2 year period. In exchange you get a guaranteed rate that will not change regardless of what happens to interest rates. If you need access to your money, choose the Easy Access Saver instead at 4.5% AER.",
    category: "savings",
  },

  // ── MORTGAGES AND LOANS ──────────────────────────────────────────────────────
  {
    id: "faq-010",
    question: "What mortgage rates does NovaBanк offer?",
    answer:
      "NovaBanк mortgage rates start from 4.2% for a 2-year fixed rate and 4.5% for a 5-year fixed rate. Tracker mortgages start from 3.9% above the Bank of England base rate. Rates depend on your loan-to-value ratio - lower LTV means better rates. A 60% LTV gets better rates than 90% LTV. Get an instant estimate using our mortgage calculator or book a free adviser consultation.",
    category: "mortgages",
  },
  {
    id: "faq-011",
    question: "Can I get a mortgage if I am self-employed?",
    answer:
      "Yes, NovaBanк lends to self-employed applicants. You need at least 2 years of self-employment history with SA302 tax calculations and tax year overviews from HMRC. We also need 2 years of certified accounts prepared by a qualified accountant. The application process is the same as employed applicants. A specialist self-employed mortgage adviser will handle your case - book through the chat assistant.",
    category: "mortgages",
  },
  {
    id: "faq-012",
    question: "How much can I borrow for a mortgage?",
    answer:
      "NovaBanк typically lends up to 4.5 times your annual income. For joint applications we use the combined income. Exact amounts depend on your credit score, existing debts, monthly outgoings, and the property value. Use the mortgage calculator for an estimate. A mortgage adviser can give you a decision in principle within 24 hours - this does not affect your credit score.",
    category: "mortgages",
  },
  {
    id: "faq-013",
    question: "What is the minimum deposit for a NovaBanк mortgage?",
    answer:
      "The minimum deposit is 5% of the property value for first-time buyers using the government mortgage guarantee scheme. For standard purchases the minimum is 10%. A 25% deposit gives you access to our best fixed rates. Higher deposits mean lower monthly payments and better interest rates. For buy-to-let properties the minimum deposit is 25%.",
    category: "mortgages",
  },
  {
    id: "faq-014",
    question: "How do I apply for a personal loan?",
    answer:
      "NovaBanк personal loans range from £1,000 to £25,000 over 1 to 7 years. Representative APR is 6.9% for loans between £7,500 and £25,000. Smaller loans have higher APR. Apply in the app or chat - you get an instant decision. Funds arrive in your account the same day if approved before 3pm. Early repayment is allowed with no penalty.",
    category: "loans",
  },
  {
    id: "faq-015",
    question: "What affects my loan application decision?",
    answer:
      "NovaBanк assesses loan applications using your credit score, income, employment status, existing debts, and account history. Being a NovaBanк customer improves your chances. We use soft search for initial quotes which does not affect your credit score. A hard search is only done when you formally apply. If declined, we explain why and you can reapply after 3 months.",
    category: "loans",
  },

  // ── CARDS ────────────────────────────────────────────────────────────────────
  {
    id: "faq-016",
    question: "What is the daily ATM withdrawal limit?",
    answer:
      "Standard accounts have a £500 daily ATM limit. You can temporarily raise this to £1,000 for 24 hours in the app under Settings > Card Limits. Premium account holders have a £1,000 default limit. International ATM withdrawals are included in this limit. NovaBanк ATMs are free - other ATM operators may charge their own fees.",
    category: "cards",
  },
  {
    id: "faq-017",
    question: "How do I freeze my card?",
    answer:
      "Freeze your NovaBanк card instantly in the app: tap Cards, select the card, toggle Freeze. The card stops working for all transactions immediately. You can unfreeze it the same way anytime. Freezing does not cancel the card or affect direct debits. If you think the card is stolen rather than lost, call 0800 123 4567 to cancel it permanently.",
    category: "cards",
  },
  {
    id: "faq-018",
    question: "How do I report a lost or stolen card?",
    answer:
      "Report a lost card immediately. Freeze it first in the app under Cards > Freeze to stop any transactions instantly. Then call 0800 123 4567 available 24 hours to cancel the card and request a replacement. Replacements arrive in 3 to 5 working days. You are not liable for fraudulent transactions made after you report the card missing.",
    category: "cards",
  },
  {
    id: "faq-019",
    question: "Does NovaBanк have a credit card?",
    answer:
      "Yes. NovaBanк offers two credit cards. The Cashback Card gives 1% cashback on all UK spending, 0.5% on international spending, no annual fee, and 0% on purchases for the first 3 months. The Premium Rewards Card gives 2% cashback, airport lounge access, travel insurance, and costs £12 per month. Both require a credit check. Apply through the chat assistant.",
    category: "cards",
  },

  // ── TRANSFERS AND PAYMENTS ───────────────────────────────────────────────────
  {
    id: "faq-020",
    question: "How do I transfer money to another bank?",
    answer:
      "NovaBanк supports several transfer methods. Faster Payments is instant, free, available 24 hours, up to £250,000. CHAPS is same-day for large amounts, costs £25, must be requested before 3pm. International SWIFT transfers cost £15 to £30 depending on destination and take 1 to 3 business days. Standing orders are free for regular fixed payments. Direct debits are free for bills.",
    category: "transfers",
  },
  {
    id: "faq-021",
    question: "What is the maximum Faster Payments transfer limit?",
    answer:
      "The NovaBanк Faster Payments limit is £250,000 per transaction. There is no daily limit as long as you have sufficient funds. For transfers above £250,000 use CHAPS (£25 fee, same day). New payees have a temporary lower limit of £10,000 for the first 24 hours as a fraud prevention measure - this lifts automatically.",
    category: "transfers",
  },
  {
    id: "faq-022",
    question: "How do I set up a standing order?",
    answer:
      "Set up a standing order in online banking or the app. Go to Payments > Standing Orders > New Standing Order. Enter the payee sort code and account number, the amount, start date, and frequency (weekly, monthly, annually). Standing orders are free and can be edited or cancelled anytime before the payment runs. They process at 1am on the scheduled date.",
    category: "transfers",
  },

  // ── SECURITY ─────────────────────────────────────────────────────────────────
  {
    id: "faq-023",
    question: "Is my money protected at NovaBanк?",
    answer:
      "Yes. NovaBanк is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority. Your eligible deposits are protected up to £85,000 per person under the Financial Services Compensation Scheme (FSCS). Joint accounts are protected up to £170,000. This protection applies automatically - you do not need to register.",
    category: "security",
  },
  {
    id: "faq-024",
    question: "How does NovaBanк protect me from fraud?",
    answer:
      "NovaBanк uses real-time transaction monitoring that flags unusual activity instantly. We use 3D Secure for online card payments requiring app confirmation. Strong Customer Authentication applies to all logins and payments above £30. We will never call asking for your PIN or password - if someone does, hang up and call 0800 123 4567. Enable push notifications to see every transaction as it happens.",
    category: "security",
  },
  {
    id: "faq-025",
    question: "What should I do if I notice an unauthorised transaction?",
    answer:
      "If you see a transaction you do not recognise, freeze your card immediately in the app, then report it through the app under Help > Dispute a Transaction or call 0800 123 4567. We investigate within 5 business days. For most cases you receive a provisional refund within 24 hours while we investigate. Do not delay reporting - disputes reported within 13 months are covered.",
    category: "security",
  },

  // ── FEES ─────────────────────────────────────────────────────────────────────
  {
    id: "faq-026",
    question: "What fees does NovaBanк charge?",
    answer:
      "NovaBanк Standard Current Account has no monthly fee. Premium Account costs £9.99 per month. UK transfers, direct debits, and standing orders are free on all accounts. CHAPS transfers cost £25. International SWIFT transfers cost £15 to £30. Paper statements cost £2 each - digital statements are free. There are no fees for using NovaBanк ATMs.",
    category: "fees",
  },
  {
    id: "faq-027",
    question: "Are there fees for using my card abroad?",
    answer:
      "Standard Account holders pay a 2.99% foreign transaction fee on card payments abroad plus a £1.50 ATM fee for international withdrawals. Premium Account holders pay no foreign transaction fees and no international ATM fees worldwide. If you travel frequently, the Premium Account at £9.99 per month often saves money compared to individual transaction fees.",
    category: "fees",
  },

  // ── OVERDRAFT ────────────────────────────────────────────────────────────────
  {
    id: "faq-028",
    question: "Does NovaBanк offer an overdraft?",
    answer:
      "NovaBanк offers arranged overdrafts up to £1,500 for eligible customers. The interest rate is 39.9% EAR variable. There are no daily fees - you only pay interest on the exact amount you use. Unarranged overdrafts are not available - transactions are declined if you have no funds rather than putting you into unarranged debt. Apply for an overdraft in the app under Account > Overdraft.",
    category: "overdraft",
  },

  // ── SUPPORT ──────────────────────────────────────────────────────────────────
  {
    id: "faq-029",
    question: "How do I contact NovaBanк customer support?",
    answer:
      "NovaBanк support options: Chat assistant available 24 hours in the app and website. Phone 0800 123 4567 available 24 hours for urgent issues including lost cards and fraud. Secure message through online banking, response within 4 hours. Branch visits Monday to Friday 9am to 5pm, Saturday 9am to 1pm. For complaints, use the complaints form in the app or email complaints@novabank.co.uk.",
    category: "support",
  },
  {
    id: "faq-030",
    question: "What are NovaBanк branch opening hours?",
    answer:
      "NovaBanк branches are open Monday to Friday 9am to 5pm and Saturday 9am to 1pm. Closed Sundays and UK public holidays. ATMs are available 24 hours. Online banking and the app work around the clock. The chat assistant in the app handles most queries without needing to visit a branch.",
    category: "support",
  },
];
