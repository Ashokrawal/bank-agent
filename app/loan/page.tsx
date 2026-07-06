"use client";

/**
 * app/chat/page.tsx
 *
 * CHANGES vs previous version
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. CONVERSATION HISTORY  — last 6 turns sent to /api/chat on every request
 *    so the LLM has context for follow-ups like "what about last month?".
 *
 * 2. CONTEXTUAL CHIPS  — after every bot reply, 3 smart follow-up chips appear
 *    below the message, chosen based on the detected intent returned by the API.
 *    They disappear the moment the user sends their next message.
 *
 * 3. SPENDING CHIPS  — when intent === "spending", chips offer drill-down
 *    queries like "Show my transactions" or "Which month was worst?".
 */

import { useState, useRef, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  intent?: string;
  metadata?: Record<string, unknown>;
}

// ── Contextual chips per intent ────────────────────────────────────────────────
const CHIPS_BY_INTENT: Record<string, string[]> = {
  onboard: [
    "What documents do I need?",
    "How long does verification take?",
    "What accounts do you offer?",
  ],
  rag: [
    "What are your opening hours?",
    "How do I open an account?",
    "Is my money protected?",
  ],
  greeting: [
    "Book an appointment",
    "Apply for a loan",
    "How do I open an account?",
  ],
};

// ── Fallback chips shown before first message ──────────────────────────────────
const INITIAL_SUGGESTED = [
  "What are your opening hours?",
  "How do I open an account?",
  "What documents do I need?",
  "What savings rates do you offer?",
  "How do I report a lost card?",
  "Is my money protected?",
];

// ── Icons ─────────────────────────────────────────────────────────────────────
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M1 8h14M9 2l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "var(--brand-500)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: 14,
      }}
    >
      🏦
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <BotAvatar />
      <div
        className="bubble-bot"
        style={{
          display: "flex",
          gap: 5,
          alignItems: "center",
          padding: "12px 16px",
        }}
      >
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

// ── Chip button ───────────────────────────────────────────────────────────────
function ChipButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: "var(--radius-full)",
        fontSize: "0.8rem",
        color: "var(--text-brand)",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--brand-50)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--brand-200, #c7d8ff)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--surface-raised)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--surface-border)";
      }}
    >
      {label}
    </button>
  );
}

// ── Loan application confirmation card ──────────────────────────────────────────
// The agent now collects loan details conversationally and submits them
// itself (see apply_for_loan in lib/agent/mcpGraph.ts) - this just summarises
// what was submitted, it no longer links out to a separate form.
const LOAN_PURPOSE_LABELS: Record<string, string> = {
  mortgage: "Mortgage",
  personal: "Personal loan",
  car: "Car loan",
  home: "Home loan",
  remortgage: "Remortgage",
  "buy-to-let": "Buy to let",
};

function LoanConfirmationCard({ details }: { details?: Record<string, unknown> }) {
  if (!details) return null;

  const loanPurpose = String(details.loanPurpose ?? "mortgage");
  const propertyValue = Number(details.propertyValue ?? 0);
  const deposit = Number(details.deposit ?? 0);
  const loanAmount = Number(details.loanAmount ?? propertyValue - deposit);
  const employment = String(details.employment ?? "");
  const emailSent = !!details.emailSent;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "16px",
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 420,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 500,
          fontSize: "0.875rem",
          color: "var(--text-primary)",
        }}
      >
        <span>✅</span> Application Submitted for Review
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
        🏠 {LOAN_PURPOSE_LABELS[loanPurpose] ?? loanPurpose} • £
        {propertyValue.toLocaleString()} property, £{deposit.toLocaleString()} deposit
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
        💷 Loan amount: £{loanAmount.toLocaleString()}
      </div>
      {employment && (
        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          💼 {employment}
        </div>
      )}
      <div
        style={{
          fontSize: "0.75rem",
          color: emailSent ? "var(--text-muted)" : "var(--error-700, #b91c1c)",
          marginTop: 4,
        }}
      >
        {emailSent
          ? "A confirmation email is on its way. A NovaBank advisor will review your details and contact you within 2–3 business days."
          : "We couldn't send a confirmation email, but your application is submitted. A NovaBank advisor will review it and contact you within 2–3 business days."}
      </div>
    </div>
  );
}

// ── Main chat component ───────────────────────────────────────────────────────
function ChatContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Hi! I'm NovaBank's AI assistant. I can help you with opening hours, account information, how to open an account, booking an advisor appointment, applying for a loan, and much more.",
      timestamp: new Date(),
      intent: "greeting",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Round-tripped with every /api/chat call - the server has no memory of
  // its own between HTTP requests, so these have to be sent back on every
  // turn or collected loan/appointment facts silently reset each message.
  const [loanDraft, setLoanDraft] = useState<Record<string, unknown>>({});
  const [appointmentDraft, setAppointmentDraft] = useState<
    Record<string, unknown>
  >({});

  // Track which message's chips are currently visible — only the latest bot msg
  const [activeChipsMsgId, setActiveChipsMsgId] = useState<string>("welcome");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Build history from current messages for next API call (last 6 turns).
  // The API expects "assistant" not "bot" - it filters on that role name,
  // so sending "bot" silently dropped every past bot reply from context.
  function buildHistory(msgs: Message[]): HistoryTurn[] {
    return msgs
      .filter((m) => m.id !== "welcome")
      .slice(-6)
      .map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.content,
      }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Hide chips the moment user sends
    setActiveChipsMsgId("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    // Build history BEFORE updating state, then update state and fire API separately
    const currentHistory = buildHistory([...messages, userMsg]);
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    fetchBot(trimmed, currentHistory);
  }

  async function fetchBot(text: string, history: HistoryTurn[]) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, loanDraft, appointmentDraft }),
      });
      const data = await res.json();

      // persist the server's updated draft so the next message carries it
      // forward - without this, collected loan/appointment facts reset
      // every single turn since the server keeps no state of its own
      setLoanDraft(data.loanDraft ?? {});
      setAppointmentDraft(data.appointmentDraft ?? {});

      const botId = (Date.now() + 1).toString();
      const botMsg: Message = {
        id: botId,
        role: "bot",
        content: data.response || data.error || "Sorry, something went wrong.",
        timestamp: new Date(),
        intent: data.intent,
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, botMsg]);
      setActiveChipsMsgId(botId);
    } catch {
      const errId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: "bot",
          content: "Connection error. Please try again or call 0800 123 4567.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const initialChips = INITIAL_SUGGESTED;
  const showInitialChips = messages.length <= 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {/* Session bar */}
      {session && (
        <div
          style={{
            padding: "10px 20px",
            background: "var(--brand-50)",
            borderBottom: "1px solid var(--brand-100, #e0eaff)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.8125rem",
            color: "var(--text-brand)",
          }}
        >
          <span>🔐</span>
          <span>
            Signed in as <strong>{session.user?.name}</strong>
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
        {/* Initial chips — only before first message */}
        {showInitialChips && (
          <div style={{ marginBottom: 24 }}>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Try asking
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {initialChips.map((s) => (
                <ChipButton key={s} label={s} onClick={() => sendMessage(s)} />
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingBottom: 20,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-fade-in"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 4,
              }}
            >
              {msg.role === "bot" && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-end",
                    maxWidth: "100%",
                  }}
                >
                  <BotAvatar />
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div
                      className="bubble-bot"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {msg.content}
                    </div>

                    {/* Loan application confirmation card */}
                    {!!msg.metadata?.showLoanConfirmation && (
                      <LoanConfirmationCard
                        details={
                          msg.metadata!.loanDetails as
                            | Record<string, unknown>
                            | undefined
                        }
                      />
                    )}

                    {/* Contextual follow-up chips — only for the latest bot message */}
                    {msg.id === activeChipsMsgId &&
                      msg.intent &&
                      CHIPS_BY_INTENT[msg.intent] && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          {CHIPS_BY_INTENT[msg.intent].map((chip) => (
                            <ChipButton
                              key={chip}
                              label={chip}
                              onClick={() => sendMessage(chip)}
                            />
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {msg.role === "user" && (
                <div className="bubble-user">{msg.content}</div>
              )}

              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginLeft: msg.role === "bot" ? 40 : 0,
                }}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "16px 20px 20px",
          borderTop: "1px solid var(--surface-border)",
          background: "var(--surface-raised)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
            background: "var(--surface-subtle)",
            border: "1px solid var(--surface-border)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 14px",
            transition: "border-color 0.15s",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about NovaBank..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              background: "transparent",
              fontSize: "0.9375rem",
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              maxHeight: 120,
              overflow: "auto",
            }}
          />
          <button
            className="btn-primary"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: "50%",
              flexShrink: 0,
              marginBottom: 2,
            }}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--text-muted)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          NovaBank AI may make mistakes. For urgent help call 0800 123 4567.
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
