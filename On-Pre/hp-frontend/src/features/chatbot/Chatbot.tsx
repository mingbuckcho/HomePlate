"use client";

import { useState, useRef, useEffect } from "react";
import {
  Ticket,
  FileText,
  LayoutGrid,
  Cloud,
  Headphones,
  X,
  ChevronLeft,
  Send,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { getApiBase } from "@/shared/api/client";
import { askChatbot } from "@/shared/api/chat";

const BOT_NAME = "HOMEPLATE 챗봇";

const PRESET_BUTTONS = [
  { key: "ticket_guide", label: "티켓 예매 방법", icon: Ticket, menuId: 1 },
  { key: "refund_guide", label: "환불 규정 안내", icon: FileText, menuId: 2 },
  {
    key: "seat_status",
    label: "구장 별 좌석 현황",
    icon: LayoutGrid,
    menuId: 3,
  },
  { key: "weather", label: "경기 날씨 조회", icon: Cloud, menuId: 4 },
  { key: "customer_service", label: "고객 센터", icon: Headphones, menuId: 5 },
] as const;

type MessageRole = "user" | "bot";
type Message = { role: MessageRole; text: string; presetKey?: string };

type ConversationState = {
  awaitingGameId?: boolean;
  awaitingZoneNumber?: boolean;
  menuId?: number;
  gameId?: number | null;
};

function getPlaceholderReply(key: string): string {
  switch (key) {
    case "ticket_guide":
      return "홈플레이트 예매는 로그인 후 '경기 일정' -> '예매하기' 버튼을 통해 가능합니다. 1인당 최대 4매까지 예매 가능합니다.";
    case "refund_guide":
      return "경기 시작 전까지 100% 환불 가능하며, 경기 시작 후에는 환불 불가합니다.";
    case "seat_status":
      return "구장별 좌석 현황을 조회하려면 경기 ID를 입력해주세요. (예: 1)";
    case "weather":
      return "경기 날씨를 조회하려면 경기 ID를 입력해주세요. (예: 1)";
    case "customer_service":
      return "고객센터 전화번호는 1588-0000 이며, 운영 시간은 평일 09:00 ~ 18:00 입니다.";
    default:
      return "요청하신 내용을 처리할 수 없습니다. 다른 메뉴를 선택해주세요.";
  }
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convState, setConvState] = useState<ConversationState>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resetConversation = () => {
    setMessages([]);
    setConvState({});
  };

  const callChatApi = async (
    menuId: number,
    gameId?: number | null,
    zoneNumber?: string | null,
  ): Promise<string> => {
    if (!getApiBase()) {
      const preset = PRESET_BUTTONS.find((p) => p.menuId === menuId);
      return getPlaceholderReply(preset?.key ?? "");
    }
    try {
      const res = await askChatbot({ menuId, gameId, zoneNumber });
      return res.answer;
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      return (
        err?.response?.data?.message ?? "요청 처리 중 오류가 발생했습니다."
      );
    }
  };

  const sendPreset = async (key: string, label: string, menuId: number) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", text: label, presetKey: key },
    ]);

    if (menuId === 3) {
      setConvState({ awaitingGameId: true, menuId: 3 });
      const reply = await callChatApi(3, null, null);
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
      return;
    }

    if (menuId === 4) {
      setConvState({ awaitingGameId: true, menuId: 4 });
      const reply = await callChatApi(4, null, null);
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
      return;
    }

    setLoading(true);
    const reply = await callChatApi(menuId);
    setLoading(false);
    setMessages((prev) => [...prev, { role: "bot", text: reply }]);
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    if (convState.awaitingGameId && convState.menuId) {
      const gameId = parseInt(text, 10);
      if (isNaN(gameId)) {
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: "올바른 경기 ID(숫자)를 입력해주세요." },
        ]);
        return;
      }

      if (convState.menuId === 3) {
        setConvState({ awaitingZoneNumber: true, menuId: 3, gameId });
        setLoading(true);
        const reply = await callChatApi(3, gameId, null);
        setLoading(false);
        setMessages((prev) => [...prev, { role: "bot", text: reply }]);
        return;
      }

      if (convState.menuId === 4) {
        setConvState({});
        setLoading(true);
        const reply = await callChatApi(4, gameId, null);
        setLoading(false);
        setMessages((prev) => [...prev, { role: "bot", text: reply }]);
        return;
      }
    }

    if (convState.awaitingZoneNumber && convState.menuId === 3) {
      setConvState({});
      setLoading(true);
      const reply = await callChatApi(3, convState.gameId, text);
      setLoading(false);
      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        text: "위 메뉴 버튼을 선택해주세요. 😊",
      },
    ]);
  };

  const showPresets = messages.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)] shadow-xl ring-2 ring-[var(--border-subtle)] transition hover:ring-[var(--accent)]/50 hover:shadow-2xl"
        aria-label="챗봇 열기"
      >
        <MessageCircle className="h-7 w-7 text-[var(--accent)]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end p-0 sm:p-4 pointer-events-none"
          aria-modal="true"
          role="dialog"
          aria-label="챗봇"
        >
          {/* 배경은 흐리지 않음, 클릭 통과(pointer-events-none). 패널만 클릭 가능 */}
          <div
            className={cn(
              "relative flex w-full flex-col rounded-t-3xl border-2 border-[var(--border-subtle)] bg-[var(--page-bg)] shadow-2xl sm:w-[420px] sm:max-h-[85vh] sm:rounded-3xl pointer-events-auto",
              "h-[90vh] sm:h-[620px]",
              "animate-chatbot-open",
            )}
          >
            <div className="flex shrink-0 items-center gap-2 rounded-t-3xl border-b-2 border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-4 sm:rounded-t-3xl">
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={resetConversation}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"
                  aria-label="처음으로"
                  title="처음으로"
                >
                  <RotateCcw className="h-5 w-5 text-[var(--text-secondary)]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"
                  aria-label="닫기"
                >
                  <ChevronLeft className="h-5 w-5 text-[var(--text-secondary)]" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold tracking-tight text-[var(--text-primary)]">
                  HOME<span style={{ color: "var(--accent)" }}>PLATE</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  몇 분 내 답변 받으실 수 있어요
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"
                aria-label="챗봇 닫기"
              >
                <X className="h-5 w-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {showPresets && (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-sm text-[var(--text-primary)]">
                    <p className="font-semibold">안녕하세요, 고객님!</p>
                    <p className="mt-1">
                      HOMEPLATE 챗봇입니다. 무엇을 도와드릴까요?
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      로그인 후 문의하시면 더 정확한 안내가 가능합니다 😊
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="shrink-0">⏰</span>
                    <div>
                      <p className="font-semibold text-[var(--text-secondary)]">
                        상담 운영 시간
                      </p>
                      <p>
                        월–금 10:00–17:00 · 점심 12:00–13:00 · 주말/공휴일 휴무
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {PRESET_BUTTONS.map(
                      ({ key, label, icon: Icon, menuId }) => (
                        <button
                          key={key}
                          type="button"
                          disabled={loading}
                          onClick={() => void sendPreset(key, label, menuId)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-3.5 text-left text-sm font-semibold text-[var(--text-primary)]",
                            "hover:bg-[var(--surface-hover)] hover:border-[var(--accent)]/20 transition",
                            loading && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          {label}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        m.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                          m.role === "user"
                            ? "bg-[var(--accent)] text-white shadow-md"
                            : "rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-primary)]",
                        )}
                      >
                        {m.role === "bot" && (
                          <p className="mb-1 text-[10px] font-semibold text-[var(--text-muted)]">
                            {BOT_NAME}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap">{m.text}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 rounded-b-3xl border-t-2 border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:rounded-b-3xl">
              {messages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {PRESET_BUTTONS.map(({ key, label, icon: Icon, menuId }) => (
                    <button
                      key={key}
                      type="button"
                      disabled={loading}
                      onClick={() => void sendPreset(key, label, menuId)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--page-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                        loading && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Icon className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  disabled={loading}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      void sendText();
                    }
                  }}
                  placeholder={
                    convState.awaitingGameId
                      ? "경기 ID를 입력하세요 (예: 1)"
                      : convState.awaitingZoneNumber
                        ? "구역 번호를 입력하세요 (예: 101)"
                        : "메뉴를 선택하거나 입력하세요"
                  }
                  className={cn(
                    "input-base flex-1 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--page-bg)] px-4 py-3 text-sm placeholder:text-[var(--text-muted)]",
                    loading && "opacity-50",
                  )}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void sendText()}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white shadow-md hover:opacity-90",
                    loading && "opacity-50 cursor-not-allowed",
                  )}
                  aria-label="전송"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
