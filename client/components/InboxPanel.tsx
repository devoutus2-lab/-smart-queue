import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, MessageSquareMore, Send, Sparkles } from "lucide-react";
import type { ConversationDetail, ConversationSummary } from "@shared/api";
import { ConversationRatingCard } from "@/components/ConversationRatingCard";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type InboxPanelProps = {
  mode: "user" | "owner";
  title: string;
  emptyLabel: string;
  businessId?: number;
  businessName?: string;
  autoCreate?: boolean;
};

const ownerQuickReplies = [
  "Thanks for checking in. Smart Queue will keep your place updated here.",
  "The line is moving, and the current estimate still looks on track.",
  "You can keep running errands for now. We will send another update when your turn is closer.",
];

function formatVisitBadge(conversation: ConversationSummary | ConversationDetail) {
  if (conversation.status !== "active") return "Visit closed";
  if (conversation.visitType === "queue") return "Live queue";
  if (conversation.visitType === "appointment") return "Upcoming appointment";
  return "Business chat";
}

function formatCloseReason(conversation: ConversationDetail) {
  switch (conversation.closeReason) {
    case "completed":
      return "This visit was completed and moved to your archive.";
    case "cancelled":
      return "This visit was cancelled and moved to your archive.";
    case "expired":
      return "This visit expired and moved to your archive.";
    case "no_show":
      return "This visit was marked as missed and moved to your archive.";
    case "transferred":
      return "This visit was transferred and moved to your archive.";
    default:
      return "This conversation has ended and is now read-only in your archive.";
  }
}

export function InboxPanel({ mode, title, emptyLabel, businessId, businessName, autoCreate = false }: InboxPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const sessionScope = getAccountScope(user);
  const conversationScopeId = mode === "owner" ? sessionScope.ownerBusinessId : sessionScope.userId;
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<"active" | "archive">("active");
  const [ratedConversationIds, setRatedConversationIds] = useState<number[]>([]);
  const [messageAreaHeight, setMessageAreaHeight] = useState(520);
  const [isResizing, setIsResizing] = useState(false);
  const isBusinessScoped = mode === "user" && businessId != null;
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(520);

  const conversationsQuery = useQuery({
    queryKey: accountQueryKeys.conversations(mode, conversationScopeId, view),
    queryFn: () => api.getConversations(view),
  });

  const conversations = conversationsQuery.data?.conversations ?? [];
  const visibleConversations = useMemo(
    () => (isBusinessScoped ? conversations.filter((conversation) => conversation.businessId === businessId) : conversations),
    [businessId, conversations, isBusinessScoped],
  );

  const createConversation = useMutation({
    mutationFn: (nextBusinessId: number) => api.createConversation({ businessId: nextBusinessId }),
    onSuccess: async (response) => {
      setView("active");
      setSelectedConversationId(response.conversation.id);
      await queryClient.invalidateQueries({
        queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "active"),
      });
      queryClient.setQueryData(
        accountQueryKeys.conversation(mode, conversationScopeId, response.conversation.id),
        response,
      );
    },
  });

  const conversationQuery = useQuery({
    queryKey: accountQueryKeys.conversation(mode, conversationScopeId, selectedConversationId),
    queryFn: () => api.getConversation(selectedConversationId!),
    enabled: selectedConversationId != null,
  });

  const sendMessage = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.sendMessage(id, { body }),
    onSuccess: async (response) => {
      setDraft("");
      queryClient.setQueryData(
        accountQueryKeys.conversation(mode, conversationScopeId, response.conversation.id),
        response,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "active") }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "archive") }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "all") }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(sessionScope.userId) }),
        queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(sessionScope.ownerBusinessId) }),
      ]);
    },
  });

  useEffect(() => {
    if (!visibleConversations.length) {
      setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId || !visibleConversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(visibleConversations[0].id);
    }
  }, [selectedConversationId, visibleConversations]);

  useEffect(() => {
    if (!autoCreate || !businessId || view !== "active") return;
    if (conversationsQuery.isLoading || createConversation.isPending) return;
    const existing = visibleConversations.find((conversation) => conversation.businessId === businessId);
    if (existing) {
      setSelectedConversationId(existing.id);
      return;
    }
    createConversation.mutate(businessId);
  }, [autoCreate, businessId, conversationsQuery.isLoading, createConversation, view, visibleConversations]);

  useEffect(() => {
    if (view !== "active" || selectedConversationId == null) return;
    api.markConversationRead(selectedConversationId)
      .then(async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "active") }),
          queryClient.invalidateQueries({ queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "archive") }),
          queryClient.invalidateQueries({ queryKey: accountQueryKeys.conversations(mode, conversationScopeId, "all") }),
          queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(sessionScope.userId) }),
          queryClient.invalidateQueries({ queryKey: accountQueryKeys.ownerDashboard(sessionScope.ownerBusinessId) }),
        ]);
      })
      .catch(() => {});
  }, [conversationQuery.data?.conversation.messages.length, conversationScopeId, mode, queryClient, selectedConversationId, sessionScope.ownerBusinessId, sessionScope.userId, view]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextHeight = resizeStartHeightRef.current + (event.clientY - resizeStartYRef.current);
      const maxHeight = Math.max(420, window.innerHeight - 260);
      setMessageAreaHeight(Math.min(Math.max(nextHeight, 320), maxHeight));
    };

    const handlePointerUp = () => setIsResizing(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  const selectedConversation = conversationQuery.data?.conversation ?? null;
  const readOnly = selectedConversation?.status !== "active";
  const activeListTitle = mode === "owner" ? "Active guest chats" : "Active business chats";
  const archiveListTitle = "Visit archive";

  useEffect(() => {
    if (!messageViewportRef.current) return;
    messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
  }, [selectedConversation?.id, selectedConversation?.messages.length]);

  const headerName = useMemo(() => {
    if (!selectedConversation) return null;
    return mode === "owner" ? selectedConversation.userName : selectedConversation.businessName;
  }, [mode, selectedConversation]);
  const conversationRated = selectedConversation ? ratedConversationIds.includes(selectedConversation.id) : false;

  return (
    <div className={`grid gap-6 ${isBusinessScoped ? "" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
      {!isBusinessScoped ? (
      <aside className="section-shell overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquareMore className="h-4 w-4 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {mode === "owner"
              ? "Keep live guest conversations separate from finished visit history."
              : "Use active chats for current visits, then revisit older visit history in the archive."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${view === "active" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
              onClick={() => setView("active")}
              type="button"
            >
              {activeListTitle}
            </button>
            <button
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${view === "archive" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950" : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
              onClick={() => setView("archive")}
              type="button"
            >
              {archiveListTitle}
            </button>
          </div>
        </div>

        <div className="max-h-[640px] space-y-3 overflow-y-auto px-4 py-4">
          {visibleConversations.map((conversation) => {
            const isActive = selectedConversationId === conversation.id;
            const primaryLabel = mode === "owner" ? conversation.userName : conversation.businessName;
            const secondaryLabel = mode === "owner" ? conversation.businessName : conversation.userName;

            return (
              <button
                key={conversation.id}
                className={`w-full rounded-[1.45rem] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-slate-950"
                    : "border-slate-100 bg-slate-50 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950/60"
                }`}
                onClick={() => setSelectedConversationId(conversation.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{primaryLabel}</div>
                    <div className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{secondaryLabel}</div>
                  </div>
                  {conversation.unreadCount ? (
                    <span className="rounded-full bg-amber-500 px-2 py-1 text-xs font-semibold text-white">{conversation.unreadCount}</span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="workspace-chip">{formatVisitBadge(conversation)}</span>
                  {conversation.status !== "active" ? (
                    <span className="workspace-chip border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <Archive className="h-3.5 w-3.5" />
                      Archived
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {conversation.latestMessage ?? conversation.contextLabel ?? "Start a conversation"}
                </div>
                {conversation.latestMessageAt ? (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(conversation.latestMessageAt).toLocaleString()}
                  </div>
                ) : null}
              </button>
            );
          })}

          {!visibleConversations.length ? <div className="empty-panel p-5">{emptyLabel}</div> : null}
        </div>
      </aside>
      ) : null}

      <section className="section-shell p-0">
        {selectedConversation ? (
          <>
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,255,0.92))] px-6 py-5 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquareMore className="h-4 w-4 text-blue-600" />
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {isBusinessScoped ? (businessName ?? headerName ?? "Business chat") : headerName}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="workspace-chip">{formatVisitBadge(selectedConversation)}</span>
                    {selectedConversation.contextLabel ? (
                      <span className="workspace-chip border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {selectedConversation.contextLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                {selectedConversation.latestMessageAt ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Last update {new Date(selectedConversation.latestMessageAt).toLocaleString()}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              ref={messageViewportRef}
              className="space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(247,249,255,0.78),rgba(255,255,255,0.98))] px-6 py-5 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.96))]"
              style={{ height: `${messageAreaHeight}px` }}
            >
              {selectedConversation.messages.map((message) => {
                const isCurrentSender =
                  (mode === "user" && message.senderRole === "user") ||
                  (mode === "owner" && message.senderRole === "owner") ||
                  (mode === "owner" && message.senderRole === "admin");

                return (
                  <div key={message.id} className={`flex flex-col gap-1 ${isCurrentSender ? "items-end" : "items-start"}`}>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div
                      className={`max-w-[88%] rounded-[1.45rem] px-4 py-3 text-sm shadow-sm ${
                        isCurrentSender
                          ? "rounded-tr-[0.5rem] bg-[linear-gradient(135deg,#2457d6,#4c73ef,#d1a447)] text-white"
                          : "rounded-tl-[0.5rem] border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      }`}
                    >
                      <div className={`text-xs font-semibold uppercase tracking-[0.2em] ${isCurrentSender ? "text-blue-100/90" : "text-slate-500 dark:text-slate-400"}`}>
                        {message.senderName}
                      </div>
                      <div className="mt-2 leading-6">{message.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              aria-label="Resize chat"
              className={`flex w-full cursor-row-resize items-center justify-center border-t border-slate-100 bg-white/90 py-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:border-slate-800 dark:bg-slate-950/90 dark:hover:bg-slate-900 dark:hover:text-slate-200 ${
                isResizing ? "text-blue-600 dark:text-blue-300" : ""
              }`}
              onPointerDown={(event) => {
                resizeStartYRef.current = event.clientY;
                resizeStartHeightRef.current = messageAreaHeight;
                setIsResizing(true);
              }}
              type="button"
            >
              <span className="pointer-events-none flex items-center gap-1">
                <span className="h-1.5 w-10 rounded-full bg-current/50" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Drag to expand</span>
                <span className="h-1.5 w-10 rounded-full bg-current/50" />
              </span>
            </button>

            {readOnly ? (
              <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Conversation ended</div>
                    <div className="mt-2">{formatCloseReason(selectedConversation)}</div>
                  </div>
                  {!conversationRated ? (
                    <ConversationRatingCard
                      description="Let us know how clear and helpful this conversation felt once the visit was finished."
                      onSubmit={async () => setRatedConversationIds((current) => [...current, selectedConversation.id])}
                      submitLabel="Rate chat"
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,255,0.96))] px-6 py-5 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
                {mode === "owner" ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {ownerQuickReplies.map((reply) => (
                      <button
                        key={reply}
                        className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        onClick={() => setDraft(reply)}
                        type="button"
                      >
                        <Sparkles className="mr-2 inline h-4 w-4" />
                        Quick reply
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="relative">
                    <Input
                      className="h-12 border-0 bg-transparent pr-14 text-sm shadow-none focus-visible:ring-0"
                      placeholder={
                        mode === "owner"
                          ? "Send a calm update or answer a guest question..."
                          : "Write a message to this business..."
                      }
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        const nextBody = draft.trim();
                        if (event.key === "Enter" && selectedConversationId != null && nextBody) {
                          event.preventDefault();
                          sendMessage.mutate({ id: selectedConversationId, body: nextBody });
                        }
                      }}
                    />
                    <button
                      className="absolute inset-y-0 right-1 my-auto rounded-full p-2 text-blue-600 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                      disabled={!draft.trim() || selectedConversationId == null || sendMessage.isPending}
                      onClick={() => {
                        const nextBody = draft.trim();
                        if (selectedConversationId == null || !nextBody) return;
                        sendMessage.mutate({ id: selectedConversationId, body: nextBody });
                      }}
                      type="button"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="empty-panel flex min-h-[420px] items-center justify-center text-center">
            {createConversation.isPending
              ? "Opening a chat for this business..."
              : isBusinessScoped
                ? emptyLabel
                : "Choose a conversation from the sidebar to view the visit details here."}
          </div>
        )}
      </section>
    </div>
  );
}
