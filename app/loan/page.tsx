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
  role: "user" | "bot";
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
  balance: [
    "Show my transactions",
    "Analyse my spending",
    "Statement for last month",
  ],
  transactions: [
    "Analyse my spending",
    "Check my balance",
    "Transactions last month",
  ],
  spending: ["Show my transactions", "Check my balance", "Spending last month"],
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
    "Check my balance",
    "Show my transactions",
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

const INITIAL_ACCOUNT_SUGGESTED = [
  "Show me my balance",
  "Analyse my spending",
  "Statement for last month",
  "Show my recent transactions",
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

function TransactionTable({
  transactions,
}: {
  transactions: Record<string, unknown>[];
}) {
  return (
    <div
      style={{
        marginTop: 12,
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--surface-border)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.8125rem",
        }}
      >
        <thead>
          <tr style={{ background: "var(--surface-subtle)" }}>
            {["Date", "Description", "Amount"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.slice(0, 8).map((t, i) => (
            <tr
              key={i}
              style={{ borderTop: "1px solid var(--surface-divider)" }}
            >
              <td
                style={{
                  padding: "8px 12px",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {String(t.date)}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {String(t.description)}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  whiteSpace: "nowrap",
                  fontWeight: 500,
                  color:
                    Number(t.amount) < 0
                      ? "var(--error-700)"
                      : "var(--success-700)",
                }}
              >
                {Number(t.amount) < 0 ? "-" : "+"}£
                {Math.abs(Number(t.amount)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

// ── Loan CTA button ───────────────────────────────────────────────────────────
function LoanApplyButton() {
  return (
    <a
      href="/loan/apply"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 10,
        padding: "10px 20px",
        background: "var(--brand-500, #4f6ef7)",
        color: "#fff",
        borderRadius: 8,
        fontSize: "0.875rem",
        fontWeight: 500,
        textDecoration: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      Start loan application →
    </a>
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
        "Hi! I'm NovaBanк's AI assistant. I can help you with opening hours, account information, how to open an account, and much more.\n\nIf you're signed in, I can also show your balance, transactions, and spending breakdown.",
      timestamp: new Date(),
      intent: "greeting",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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

  // Build history from current messages for next API call (last 6 turns)
  function buildHistory(msgs: Message[]): HistoryTurn[] {
    return msgs
      .filter((m) => m.id !== "welcome")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
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
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();

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

  const initialChips = session ? INITIAL_ACCOUNT_SUGGESTED : INITIAL_SUGGESTED;
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
            Signed in as <strong>{session.user?.name}</strong> — I can access
            your account details.
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

                    {/* Transaction table */}
                    {Array.isArray(msg.metadata?.transactions) &&
                      (msg.metadata!.transactions as unknown[]).length > 0 &&
                      msg.intent === "transactions" && (
                        <TransactionTable
                          transactions={
                            msg.metadata!.transactions as Record<
                              string,
                              unknown
                            >[]
                          }
                        />
                      )}

                    {/* Loan apply CTA */}
                    {!!msg.metadata?.showLoanCTA && <LoanApplyButton />}

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
            placeholder="Ask me anything about NovaBanк..."
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
          NovaBanк AI may make mistakes. For urgent help call 0800 123 4567.
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
