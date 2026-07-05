/**
 * Mock Bank Data
 * All data used for seeding ChromaDB (vector store) and SQLite (relational)
 * NovaBanк — fictional bank for demo purposes
 */

// ─── VECTOR STORE DATA (goes into ChromaDB) ───────────────────────────────────

export const FAQ_DATA = [
  {
    id: "faq-001",
    question: "What are your branch opening hours?",
    answer:
      "NovaBanк branches are open Monday to Friday 9:00 AM – 5:00 PM, and Saturday 9:00 AM – 1:00 PM. We are closed on Sundays and public holidays. Our ATMs are available 24/7. Online and mobile banking is available around the clock.",
    category: "hours",
    metadata: { type: "faq", category: "hours" },
  },
  {
    id: "faq-002",
    question: "How do I open a bank account?",
    answer:
      "You can open an account online through our chat assistant or by visiting a branch. You'll need: a valid government-issued photo ID (passport or driver's licence), proof of address (utility bill or bank statement dated within 3 months), your National Insurance or Tax ID number, and an initial deposit of £10 or more. The online process takes about 10 minutes.",
    category: "accounts",
    metadata: { type: "faq", category: "accounts" },
  },
  {
    id: "faq-003",
    question: "What documents do I need to open an account?",
    answer:
      "To open a NovaBanк account you need: (1) Primary ID — passport, national ID card, or driver's licence. (2) Proof of address — utility bill, council tax letter, or bank statement, all dated within the last 3 months. (3) Tax/NI number. (4) A selfie for identity verification. We do not accept expired documents.",
    category: "accounts",
    metadata: { type: "faq", category: "accounts" },
  },
  {
    id: "faq-004",
    question: "How long does account verification take?",
    answer:
      "Most accounts are verified instantly through our automated system. If additional checks are needed, verification takes 1–2 business days. You'll receive an email and SMS notification once your account is active. You can track your application status in the app.",
    category: "accounts",
    metadata: { type: "faq", category: "accounts" },
  },
  {
    id: "faq-005",
    question: "What are your interest rates on savings accounts?",
    answer:
      "NovaBanк offers the following savings rates: Easy Access Saver — 4.5% AER variable. Fixed 1-Year Bond — 5.1% AER fixed. Fixed 2-Year Bond — 5.3% AER fixed. Junior ISA — 4.8% AER tax-free. Cash ISA — 4.6% AER tax-free. Rates are correct as of 2025 and may change. AER stands for Annual Equivalent Rate.",
    category: "products",
    metadata: { type: "faq", category: "products" },
  },
  {
    id: "faq-006",
    question: "How do I transfer money to another bank?",
    answer:
      "You can transfer money via: Online banking or our app (Faster Payments — usually instant, free, up to £250,000). CHAPS for same-day large transfers (£25 fee). International SWIFT transfers (£15–£30 fee depending on destination). Standing orders for regular payments. Direct debits for bills. Transfers within NovaBanк are instant and free 24/7.",
    category: "transfers",
    metadata: { type: "faq", category: "transfers" },
  },
  {
    id: "faq-007",
    question: "What is the daily ATM withdrawal limit?",
    answer:
      "The standard daily ATM withdrawal limit is £500. You can temporarily increase this to £1,000 for 24 hours via the app under Settings > Card Limits. Premium account holders have a default limit of £1,000. If you need a higher limit, please contact us.",
    category: "cards",
    metadata: { type: "faq", category: "cards" },
  },
  {
    id: "faq-008",
    question: "How do I report a lost or stolen card?",
    answer:
      "Report a lost or stolen card immediately by: (1) Freezing your card instantly in the NovaBanк app under Cards > Freeze. (2) Calling our 24/7 emergency line: 0800 123 4567. (3) Using our online banking portal. Your card will be cancelled and a replacement sent within 3–5 working days. You will not be liable for fraudulent transactions if reported promptly.",
    category: "cards",
    metadata: { type: "faq", category: "cards" },
  },
  {
    id: "faq-009",
    question: "What are the fees for a current account?",
    answer:
      "NovaBanк Standard Current Account has no monthly fee. Our Premium Account is £9.99/month and includes worldwide travel insurance, breakdown cover, and fee-free foreign transactions. Business accounts start from £7.50/month. There are no fees for UK transfers, direct debits, or standing orders on any account.",
    category: "fees",
    metadata: { type: "faq", category: "fees" },
  },
  {
    id: "faq-010",
    question: "How do I apply for a mortgage?",
    answer:
      "To apply for a NovaBanк mortgage: speak to our AI assistant to get an estimate, then book a free consultation with a mortgage adviser. You'll need 3 months' payslips, 2 years' tax returns (self-employed), bank statements, and proof of deposit. We offer fixed-rate mortgages from 4.2% and tracker mortgages from 3.9%. Use our mortgage calculator on the website for an instant estimate.",
    category: "mortgages",
    metadata: { type: "faq", category: "mortgages" },
  },
  {
    id: "faq-011",
    question: "Is my money protected?",
    answer:
      "Yes. NovaBanк is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority. Your eligible deposits are protected up to £85,000 per person under the Financial Services Compensation Scheme (FSCS). Joint accounts are protected up to £170,000.",
    category: "security",
    metadata: { type: "faq", category: "security" },
  },
  {
    id: "faq-012",
    question: "How do I get a bank statement?",
    answer:
      "You can get statements through: Online banking — download PDF statements for any date range instantly. The app — tap Account > Statements. Email — request via secure message. Post — request a paper statement (£2 fee per statement). If you are a logged-in customer, just ask me for your statement and I can show you transactions for any date range.",
    category: "statements",
    metadata: { type: "faq", category: "statements" },
  },
  {
    id: "faq-013",
    question: "Can I open a joint account?",
    answer:
      "Yes, you can open a joint account with one other person. Both account holders need to complete identity verification. You can apply online — both parties will receive a verification link to their email. Joint accounts share the same account number and both holders can transact freely. Either holder can close the account, which requires both to consent.",
    category: "accounts",
    metadata: { type: "faq", category: "accounts" },
  },
  {
    id: "faq-014",
    question: "What is the overdraft limit and interest?",
    answer:
      "NovaBanк offers arranged overdrafts up to £1,500 for eligible customers. The overdraft interest rate is 39.9% EAR variable. There are no daily or monthly fees on arranged overdrafts — you only pay interest on what you use. Unarranged overdrafts are not available; transactions will be declined if you have insufficient funds.",
    category: "overdraft",
    metadata: { type: "faq", category: "overdraft" },
  },
  {
    id: "faq-015",
    question: "How do I contact customer support?",
    answer:
      "You can reach NovaBanк support through: This AI chat assistant — available 24/7 for most queries. Phone — 0800 123 4567 (free, Mon–Fri 8am–8pm, Sat 9am–5pm). Secure message in the app or online banking. Branch visit — find your nearest branch on our website. For lost cards or fraud, call the 24/7 emergency line immediately.",
    category: "support",
    metadata: { type: "faq", category: "support" },
  },
];

export const PRODUCT_DATA = [
  {
    id: "prod-001",
    name: "Standard Current Account",
    type: "current",
    description:
      "A fee-free everyday current account with a Visa debit card, mobile banking, and instant UK transfers.",
    features: [
      "No monthly fee",
      "Visa debit card",
      "Instant UK transfers",
      "Apple Pay and Google Pay",
      "Overdraft up to £500 (subject to eligibility)",
      "24/7 mobile app",
    ],
    requirements: ["Valid ID", "Proof of address", "UK resident aged 18+"],
    minimumDeposit: 10,
    monthlyFee: 0,
    metadata: { type: "product", category: "current" },
  },
  {
    id: "prod-002",
    name: "Premium Current Account",
    type: "current",
    description:
      "Our premium account with worldwide travel insurance, fee-free foreign spending, and priority support.",
    features: [
      "£9.99/month",
      "Worldwide travel insurance",
      "Fee-free foreign transactions",
      "Airport lounge access (2 per year)",
      "Priority customer support",
      "Overdraft up to £1,500",
      "Cashback on purchases",
    ],
    requirements: [
      "Valid ID",
      "Proof of address",
      "UK resident aged 18+",
      "Credit check",
    ],
    minimumDeposit: 10,
    monthlyFee: 9.99,
    metadata: { type: "product", category: "current" },
  },
  {
    id: "prod-003",
    name: "Easy Access Saver",
    type: "savings",
    description:
      "A flexible savings account with a competitive rate. Withdraw anytime with no penalty.",
    features: [
      "4.5% AER variable",
      "Withdraw anytime",
      "No minimum balance",
      "Interest paid monthly",
      "Manage via app",
    ],
    requirements: ["NovaBanк current account required", "Aged 18+"],
    minimumDeposit: 1,
    monthlyFee: 0,
    metadata: { type: "product", category: "savings" },
  },
  {
    id: "prod-004",
    name: "1-Year Fixed Bond",
    type: "savings",
    description:
      "Lock your money for 12 months and earn a guaranteed higher rate. No withdrawals during the term.",
    features: [
      "5.1% AER fixed",
      "Guaranteed rate for 12 months",
      "Interest paid on maturity",
      "FSCS protected",
      "Minimum £500",
    ],
    requirements: ["Aged 18+", "Minimum £500 deposit"],
    minimumDeposit: 500,
    monthlyFee: 0,
    metadata: { type: "product", category: "savings" },
  },
  {
    id: "prod-005",
    name: "Cash ISA",
    type: "isa",
    description:
      "A tax-free savings account. Save up to £20,000 per tax year with no tax on interest.",
    features: [
      "4.6% AER tax-free",
      "Save up to £20,000/year ISA allowance",
      "Interest tax-free",
      "Transfer from other ISAs",
      "Easy access",
    ],
    requirements: ["UK resident aged 18+", "Valid ID"],
    minimumDeposit: 1,
    monthlyFee: 0,
    metadata: { type: "product", category: "isa" },
  },
];

export const POLICY_DATA = [
  {
    id: "pol-001",
    title: "KYC Identity Verification Policy",
    content:
      "All new customers must complete Know Your Customer (KYC) verification before accessing full banking services. Accepted primary IDs: passport, national identity card, UK driving licence (full or provisional). Accepted proof of address: utility bill, council tax bill, bank statement, HMRC letter — all must be dated within 3 months. Documents must be clear, unobstructed photos or scans. We use automated AI verification with a human review fallback. Verification is typically instant; complex cases take up to 2 business days.",
    metadata: { type: "policy", category: "kyc" },
  },
  {
    id: "pol-002",
    title: "Account Opening Eligibility",
    content:
      "To open a NovaBanк account you must be: aged 18 or over (16+ for Junior ISA with guardian consent), a UK resident with a valid UK address, not bankrupt or subject to a debt relief order, not previously banned from NovaBanк. We conduct a soft credit check for current accounts and a hard check for overdraft applications. We do not discriminate based on nationality for UK residents.",
    metadata: { type: "policy", category: "eligibility" },
  },
  {
    id: "pol-003",
    title: "Fraud and Security Policy",
    content:
      "NovaBanк will never ask for your PIN, full password, or one-time passcode via phone, email, or chat. If you receive such a request, it is fraud — report it immediately to 0800 123 4567. We monitor transactions 24/7 with AI fraud detection. Suspicious transactions are blocked automatically and you are notified immediately. Customers are not liable for unauthorised transactions if reported promptly and they have not acted fraudulently or negligently.",
    metadata: { type: "policy", category: "security" },
  },
  {
    id: "pol-004",
    title: "Data Privacy Policy Summary",
    content:
      "NovaBanк collects personal data to provide banking services, comply with legal obligations, and improve our products. We do not sell your data to third parties. Data is stored securely in UK-based data centres. You have the right to access, correct, and delete your data under GDPR. We retain account data for 7 years after account closure as required by financial regulations. Contact our DPO at privacy@novabank.co.uk for data requests.",
    metadata: { type: "policy", category: "privacy" },
  },
];

// ─── RELATIONAL DB DATA (SQLite — mock users and transactions) ────────────────

export const MOCK_USERS = [
  {
    id: "user-admin",
    email: "admin@novabank.com",
    password_hash: "admin-hash",
    name: "NovaBanк Admin",
    phone: "+44 7700 900000",
    address: "1 Bank Street, London, EC2V 8RF",
    ni_number: "AA 00 00 00 A",
    date_of_birth: "1990-01-01",
    kyc_status: "verified",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "user-001",
    email: "james.carter@example.com",
    password_hash: "$2a$10$mockhashjamescarterasdf", // password: demo123
    name: "James Carter",
    phone: "+44 7700 900001",
    address: "12 Maple Street, London, EC1A 1BB",
    ni_number: "AB 12 34 56 C",
    date_of_birth: "1988-03-15",
    kyc_status: "verified",
    created_at: "2023-01-10T09:00:00Z",
  },
  {
    id: "user-002",
    email: "sofia.patel@example.com",
    password_hash: "$2a$10$mockhashsofiapatelasdfasdf", // password: demo123
    name: "Sofia Patel",
    phone: "+44 7700 900002",
    address: "47 Oak Avenue, Manchester, M1 2CD",
    ni_number: "CD 98 76 54 A",
    date_of_birth: "1995-07-22",
    kyc_status: "verified",
    created_at: "2023-06-05T14:30:00Z",
  },
  {
    id: "user-003",
    email: "demo@novabank.com",
    password_hash: "$2a$10$mockhashdemouserq234sdfsdf", // password: demo123
    name: "Alex Demo",
    phone: "+44 7700 900003",
    address: "1 Demo Lane, London, SW1A 0AA",
    ni_number: "EF 11 22 33 B",
    date_of_birth: "1990-01-01",
    kyc_status: "verified",
    created_at: "2024-01-01T00:00:00Z",
  },
];

export const MOCK_ACCOUNTS = [
  // James Carter's accounts
  {
    id: "acc-001",
    user_id: "user-001",
    account_number: "12345678",
    sort_code: "20-00-00",
    type: "current",
    name: "Standard Current Account",
    balance: 4823.5,
    currency: "GBP",
    status: "active",
    opened_at: "2023-01-10T09:00:00Z",
  },
  {
    id: "acc-002",
    user_id: "user-001",
    account_number: "12345679",
    sort_code: "20-00-00",
    type: "savings",
    name: "Easy Access Saver",
    balance: 12500.0,
    currency: "GBP",
    status: "active",
    opened_at: "2023-02-01T09:00:00Z",
  },
  // Sofia Patel's accounts
  {
    id: "acc-003",
    user_id: "user-002",
    account_number: "87654321",
    sort_code: "20-00-00",
    type: "current",
    name: "Premium Current Account",
    balance: 8341.2,
    currency: "GBP",
    status: "active",
    opened_at: "2023-06-05T14:30:00Z",
  },
  // Demo user accounts
  {
    id: "acc-004",
    user_id: "user-003",
    account_number: "11223344",
    sort_code: "20-00-00",
    type: "current",
    name: "Standard Current Account",
    balance: 2150.75,
    currency: "GBP",
    status: "active",
    opened_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "acc-005",
    user_id: "user-003",
    account_number: "11223345",
    sort_code: "20-00-00",
    type: "isa",
    name: "Cash ISA",
    balance: 5000.0,
    currency: "GBP",
    status: "active",
    opened_at: "2024-01-15T00:00:00Z",
  },
];

export const MOCK_TRANSACTIONS = [
  // Demo user (user-003) transactions — acc-004
  {
    id: "txn-001",
    account_id: "acc-004",
    date: "2025-03-10",
    description: "TESCO SUPERSTORE",
    amount: -67.43,
    type: "debit",
    category: "groceries",
    balance_after: 2150.75,
  },
  {
    id: "txn-002",
    account_id: "acc-004",
    date: "2025-03-09",
    description: "SALARY - ACME CORP",
    amount: 2800.0,
    type: "credit",
    category: "income",
    balance_after: 2218.18,
  },
  {
    id: "txn-003",
    account_id: "acc-004",
    date: "2025-03-08",
    description: "NETFLIX.COM",
    amount: -17.99,
    type: "debit",
    category: "entertainment",
    balance_after: -581.82,
  },
  {
    id: "txn-004",
    account_id: "acc-004",
    date: "2025-03-07",
    description: "COSTA COFFEE",
    amount: -4.5,
    type: "debit",
    category: "food",
    balance_after: -563.83,
  },
  {
    id: "txn-005",
    account_id: "acc-004",
    date: "2025-03-06",
    description: "AMAZON PRIME",
    amount: -8.99,
    type: "debit",
    category: "entertainment",
    balance_after: -559.33,
  },
  {
    id: "txn-006",
    account_id: "acc-004",
    date: "2025-03-05",
    description: "BP PETROL STATION",
    amount: -62.0,
    type: "debit",
    category: "transport",
    balance_after: -550.34,
  },
  {
    id: "txn-007",
    account_id: "acc-004",
    date: "2025-03-03",
    description: "TFL TRAVEL",
    amount: -35.6,
    type: "debit",
    category: "transport",
    balance_after: -488.34,
  },
  {
    id: "txn-008",
    account_id: "acc-004",
    date: "2025-03-01",
    description: "RENT - LANDLORD",
    amount: -950.0,
    type: "debit",
    category: "housing",
    balance_after: -452.74,
  },
  {
    id: "txn-009",
    account_id: "acc-004",
    date: "2025-02-28",
    description: "MARKS & SPENCER",
    amount: -43.21,
    type: "debit",
    category: "shopping",
    balance_after: 497.26,
  },
  {
    id: "txn-010",
    account_id: "acc-004",
    date: "2025-02-26",
    description: "TRANSFER FROM SAVINGS",
    amount: 500.0,
    type: "credit",
    category: "transfer",
    balance_after: 540.47,
  },
  {
    id: "txn-011",
    account_id: "acc-004",
    date: "2025-02-25",
    description: "SPOTIFY",
    amount: -11.99,
    type: "debit",
    category: "entertainment",
    balance_after: 40.47,
  },
  {
    id: "txn-012",
    account_id: "acc-004",
    date: "2025-02-24",
    description: "BOOTS PHARMACY",
    amount: -22.5,
    type: "debit",
    category: "health",
    balance_after: 52.46,
  },
  {
    id: "txn-013",
    account_id: "acc-004",
    date: "2025-02-20",
    description: "DIRECT DEBIT - COUNCIL TAX",
    amount: -145.0,
    type: "debit",
    category: "bills",
    balance_after: 74.96,
  },
  {
    id: "txn-014",
    account_id: "acc-004",
    date: "2025-02-18",
    description: "DIRECT DEBIT - GAS & ELEC",
    amount: -89.0,
    type: "debit",
    category: "bills",
    balance_after: 219.96,
  },
  {
    id: "txn-015",
    account_id: "acc-004",
    date: "2025-02-10",
    description: "SALARY - ACME CORP",
    amount: 2800.0,
    type: "credit",
    category: "income",
    balance_after: 308.96,
  },
  // James Carter transactions — acc-001
  {
    id: "txn-016",
    account_id: "acc-001",
    date: "2025-03-10",
    description: "WAITROSE SUPERMARKET",
    amount: -112.3,
    type: "debit",
    category: "groceries",
    balance_after: 4823.5,
  },
  {
    id: "txn-017",
    account_id: "acc-001",
    date: "2025-03-09",
    description: "SALARY - TECH LTD",
    amount: 4200.0,
    type: "credit",
    category: "income",
    balance_after: 4935.8,
  },
  {
    id: "txn-018",
    account_id: "acc-001",
    date: "2025-03-05",
    description: "MORTGAGE PAYMENT",
    amount: -1450.0,
    type: "debit",
    category: "housing",
    balance_after: 735.8,
  },
];

export const MOCK_APPLICATIONS = [
  {
    id: "app-001",
    user_id: "user-003",
    type: "current_account",
    status: "approved",
    submitted_at: "2024-01-01T00:00:00Z",
    reviewed_at: "2024-01-01T00:05:00Z",
    notes: "Auto-approved via KYC",
  },
];
