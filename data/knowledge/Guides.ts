/**
 * data/knowledge/guides.ts
 * NovaBanк - Policies and how-to guides for ChromaDB RAG
 *
 * Two types of content here:
 * - POLICY_DATA: regulatory and policy documents
 * - GUIDE_DATA: step-by-step how-to guides (new in Prototype.2)
 *
 * Guides are the most useful RAG content - they answer
 * "how do I" questions that FAQs cover too briefly.
 */

export interface PolicyEntry {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface GuideEntry {
  id: string;
  title: string;
  content: string;
  category: string;
}

export const POLICY_DATA: PolicyEntry[] = [
  {
    id: "pol-001",
    title: "FSCS Deposit Protection",
    category: "security",
    content:
      "NovaBanк is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority (FCA). Customer deposits are protected by the Financial Services Compensation Scheme (FSCS). Individual accounts are protected up to £85,000 per person per banking group. Joint accounts are protected up to £170,000. Temporary high balances up to £1,000,000 are protected for 6 months following life events such as property sale, divorce settlement, or personal injury compensation. Protection is automatic - customers do not need to register or pay for it.",
  },
  {
    id: "pol-002",
    title: "Fraud and Disputed Transaction Policy",
    category: "security",
    content:
      "NovaBanк customers are protected from unauthorised transactions under the Payment Services Regulations 2017. If you did not authorise a transaction you must report it as soon as you notice it and within 13 months of the transaction date. We investigate within 5 business days and issue a provisional refund within 24 hours for most cases. You will not be liable for unauthorised transactions unless you acted fraudulently, failed to take reasonable steps to keep your credentials safe, or delayed reporting unreasonably. Authorised push payment fraud - where you were tricked into sending money - is covered under the voluntary Contingent Reimbursement Model with full reimbursement in most cases.",
  },
  {
    id: "pol-003",
    title: "Responsible Lending Policy",
    category: "lending",
    content:
      "NovaBanк assesses affordability for all credit products including overdrafts, personal loans, and mortgages. We use a combination of credit reference agency data, income verification, and internal account behaviour. We decline applications where we believe the credit would be unaffordable. We offer debt management referrals and payment holidays for customers in financial difficulty. We report to three credit reference agencies: Experian, Equifax, and TransUnion. A hard credit search is conducted on formal loan applications. Soft searches for eligibility checks do not affect your credit score.",
  },
  {
    id: "pol-004",
    title: "Account Closure Policy",
    category: "accounts",
    content:
      "NovaBanк can close an account with 60 days notice without providing a reason. Immediate closure is possible for suspected fraud, serious breach of terms, or legal obligation. Customers can close accounts at any time by contacting support, visiting a branch, or sending a secure message. Accounts with a remaining balance are settled by bank transfer or cheque within 5 business days. Fixed-term products cannot be closed early. ISAs can be transferred to another provider rather than closed to preserve the tax wrapper.",
  },
  {
    id: "pol-005",
    title: "Data Privacy and GDPR",
    category: "privacy",
    content:
      "NovaBanк processes personal data under the UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018. We collect data necessary to provide banking services, meet regulatory obligations, and prevent fraud. We do not sell customer data to third parties. Data is retained for 7 years after account closure as required by financial regulations. Customers have the right to access their data, correct inaccuracies, and request deletion where legally permitted. For a Subject Access Request contact dataprotection@novabank.co.uk or submit through secure messaging.",
  },
];

export const GUIDE_DATA: GuideEntry[] = [
  {
    id: "guide-001",
    title: "How to switch your bank to NovaBanк",
    category: "accounts",
    content:
      "Switching to NovaBanк takes 7 working days using the Current Account Switch Service (CASS). Step 1: open a NovaBanк account first if you do not have one. Step 2: in the app go to Account > Switch to NovaBanк and enter your old bank details. Step 3: choose a switch date at least 7 working days away. CASS automatically moves all direct debits, standing orders, and incoming payments to your new account. Your old account closes on the switch date. Any payments that accidentally go to your old account are redirected for 3 years. The switch is free and guaranteed.",
  },
  {
    id: "guide-002",
    title: "How to apply for a mortgage with NovaBanк",
    category: "mortgages",
    content:
      "Applying for a NovaBanк mortgage has four stages. Stage 1 - Agreement in Principle: use the mortgage calculator to get an estimate, then request a Decision in Principle through the chat or app. This takes 24 hours and does not affect your credit score. Stage 2 - Full Application: once you have found a property, submit the full application with payslips (last 3 months), bank statements (last 3 months), P60 or SA302 for self-employed, and ID. Stage 3 - Valuation: we instruct a surveyor to value the property. Stage 4 - Offer: mortgage offer issued within 2 to 3 weeks of completed application. You then exchange contracts with your solicitor.",
  },
  {
    id: "guide-003",
    title: "How to set up online banking",
    category: "digital",
    content:
      "Setting up NovaBanк online banking takes 5 minutes. Visit novabank.co.uk and click Register. Enter your account number, sort code, and date of birth. Choose a username and memorable password - at least 8 characters, one uppercase, one number, one symbol. Set up a 6-digit passcode for the app. Enable biometric login using fingerprint or face ID if your device supports it. Set up push notifications to see every transaction in real time. Two-factor authentication is required for login from new devices - a code is sent to your registered mobile number.",
  },
  {
    id: "guide-004",
    title: "How to dispute a transaction",
    category: "security",
    content:
      "To dispute a NovaBanк transaction: Step 1 - check the merchant name. Some businesses trade under a different name (e.g. a gym might appear as a parent company). Step 2 - if still unrecognised, go to the transaction in the app and tap Dispute This Transaction. Step 3 - select the reason: not authorised by me, goods not received, duplicate charge, or incorrect amount. Step 4 - add any relevant details and submit. You get a provisional refund within 24 hours for most cases while we investigate. Do not wait - disputes must be raised within 13 months of the transaction date.",
  },
  {
    id: "guide-005",
    title: "How to set up a NovaBanк ISA",
    category: "savings",
    content:
      "Opening a NovaBanк Cash ISA takes 3 minutes. Go to Savings in the app and tap Open Cash ISA. Confirm your National Insurance number - this is required for all ISAs. Choose how much to deposit: minimum £1, maximum £20,000 for the current tax year. Set up a regular deposit if you want to save monthly. You can also transfer an existing ISA from another provider - go to ISA > Transfer In and enter your old provider details. Transfers take 15 working days and do not count against your annual allowance.",
  },
  {
    id: "guide-006",
    title: "How to increase your credit limit",
    category: "credit",
    content:
      "To request a credit limit increase on your NovaBanк credit card: go to Cards in the app, select your credit card, and tap Manage Limit > Request Increase. We will ask for your current income and employment status. A soft credit search is performed first - this does not affect your score. If eligible, the increase is applied within 24 hours. You can request an increase every 6 months. Limits above £15,000 require a full credit assessment. Your current limit is shown in the app under Cards > Credit Limit.",
  },
  {
    id: "guide-007",
    title: "How to make an international transfer",
    category: "transfers",
    content:
      "To send money internationally from NovaBanк: go to Payments > International Transfer in the app. Enter the recipient name, IBAN, and SWIFT/BIC code (your recipient's bank provides these). Select the currency - we convert at the mid-market rate plus a margin. Standard transfers cost £15 to £30 depending on destination and take 1 to 3 business days. SWIFT transfers over £10,000 may require additional compliance checks. Check the exchange rate in the app before confirming - you see the exact amount the recipient will receive before you approve.",
  },
  {
    id: "guide-008",
    title: "How to open a business account",
    category: "business",
    content:
      "NovaBanк business accounts are available for sole traders, limited companies, and partnerships. Requirements: Companies House registration number for limited companies, your personal ID, proof of business address, and 3 months of business bank statements if switching. Business accounts start from £7.50 per month for the Standard Business Account. Features include batch payments, accounting software integrations (Xero and QuickBooks), multiple user access with different permissions, and a dedicated business support line. Apply at novabank.co.uk/business or book an appointment with a business banking specialist.",
  },
];
