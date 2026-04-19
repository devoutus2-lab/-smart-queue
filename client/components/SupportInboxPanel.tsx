import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type SupportInboxPanelProps = {
  mode: "requester" | "admin";
  title: string;
  description: string;
  autoCreate?: boolean;
};

export function SupportInboxPanel({ mode, title, description, autoCreate = false }: SupportInboxPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const scopeId = user?.role === "owner" ? scope.ownerBusinessId : scope.userId;
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [messageAreaHeight, setMessageAreaHeight] = useState(520);
  const [isResizing, setIsResizing] = useState(false);
  const [triageForm, setTriageForm] = useState({
    status: "active",
    priority: "medium",
    category: "general",
    assignedAdminId: "",
    internalNotes: "",
  });
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(520);

  const conversationsQuery = useQuery({
    queryKey: accountQueryKeys.supportConversations(scope.role, scopeId),
    queryFn: api.getSupportConversations,
    enabled: Boolean(user),
  });

  const createConversation = useMutation({
    mutationFn: () => api.createSupportConversation({ subject: "Technical support" }),
    onSuccess: async (response) => {
      setSelectedConversationId(response.conversation.id);
      await queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
      queryClient.setQueryData(accountQueryKeys.supportConversation(scope.role, scopeId, response.conversation.id), response);
    },
  });

  const conversations = conversationsQuery.data?.conversations ?? [];

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId || !conversations.some((item) => item.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!autoCreate || mode !== "requester" || conversationsQuery.isLoading || createConversation.isPending) return;
    if (!conversations.length) {
      createConversation.mutate();
    }
  }, [autoCreate, conversations.length, conversationsQuery.isLoading, createConversation, mode]);

  const conversationQuery = useQuery({
    queryKey: accountQueryKeys.supportConversation(scope.role, scopeId, selectedConversationId),
    queryFn: () => api.getSupportConversation(selectedConversationId!),
    enabled: selectedConversationId != null,
  });

  const adminAccountsQuery = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: api.getAdminAccounts,
    enabled: Boolean(user && mode === "admin"),
  });

  const sendMessage = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.sendSupportMessage(id, { body }),
    onSuccess: async (response) => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
      queryClient.setQueryData(accountQueryKeys.supportConversation(scope.role, scopeId, response.conversation.id), response);
    },
  });

  const saveTriage = useMutation({
    mutationFn: (payload: { id: number; status: string; priority: string; category: string; assignedAdminId: string; internalNotes: string }) =>
      api.updateAdminSupportTriage(payload.id, {
        status: payload.status as "active" | "in_progress" | "resolved" | "escalated",
        priority: payload.priority as "low" | "medium" | "high" | "urgent",
        category: payload.category as "general" | "bug" | "technical" | "account_access" | "subscription" | "data_issue" | "onboarding" | "business_setup",
        assignedAdminId: payload.assignedAdminId ? Number(payload.assignedAdminId) : null,
        internalNotes: payload.internalNotes,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["support-conversations"] });
      queryClient.setQueryData(accountQueryKeys.supportConversation(scope.role, scopeId, response.conversation.id), response);
    },
  });

  useEffect(() => {
    if (selectedConversationId == null) return;
    api.markSupportConversationRead(selectedConversationId).catch(() => {});
  }, [conversationQuery.data?.conversation.messages.length, selectedConversationId]);

  useEffect(() => {
    if (!messageViewportRef.current) return;
    messageViewportRef.current.scrollTop = messageViewportRef.current.scrollHeight;
  }, [conversationQuery.data?.conversation.messages.length]);

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
  const adminAccounts = (adminAccountsQuery.data?.accounts ?? []).filter((account) => account.role === "admin");
  const titleLine = useMemo(() => {
    if (!selectedConversation) return title;
    return mode === "admin" ? `${selectedConversation.requesterName} support chat` : "Smart Queue support chat";
  }, [mode, selectedConversation, title]);

  useEffect(() => {
    if (!selectedConversation || mode !== "admin") return;
    setTriageForm({
      status: selectedConversation.status,
      priority: selectedConversation.priority,
      category: selectedConversation.category,
      assignedAdminId: selectedConversation.assignedAdminId ? String(selectedConversation.assignedAdminId) : "",
      internalNotes: selectedConversation.internalNotes ?? "",
    });
  }, [mode, selectedConversation]);

  return (
    <div className={`grid gap-6 ${mode === "admin" ? "xl:grid-cols-[320px_minmax(0,1fr)]" : ""}`}>
      {mode === "admin" ? (
        <aside className="section-shell overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          </div>

          <div className="max-h-[680px] space-y-3 overflow-y-auto px-4 py-4">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`w-full rounded-[1.45rem] border px-4 py-4 text-left transition ${
                  selectedConversationId === conversation.id
                    ? "border-blue-300 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-slate-950"
                    : "border-slate-100 bg-slate-50 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950/60"
                }`}
                onClick={() => setSelectedConversationId(conversation.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{conversation.requesterName}</div>
                    <div className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{conversation.requesterRole}</div>
                  </div>
                  {conversation.unreadCount ? (
                    <span className="rounded-full bg-amber-500 px-2 py-1 text-xs font-semibold text-white">{conversation.unreadCount}</span>
                  ) : null}
                </div>
                <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {conversation.latestMessage ?? conversation.subject}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {conversation.status.replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    {conversation.priority}
                  </span>
                </div>
              </button>
            ))}

            {!conversations.length ? <div className="empty-panel p-5">No support conversations yet.</div> : null}
          </div>
        </aside>
      ) : null}

      <section className="section-shell p-0">
        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,255,0.92))] px-6 py-5 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))]">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-blue-600" />
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{titleLine}</div>
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</div>
        </div>

        {selectedConversation ? (
          <>
            {mode === "admin" ? (
              <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
                  <select className="field-select" value={triageForm.status} onChange={(event) => setTriageForm((current) => ({ ...current, status: event.target.value }))}>
                    {["active", "in_progress", "resolved", "escalated"].map((status) => (
                      <option key={status} value={status}>{status.replace("_", " ")}</option>
                    ))}
                  </select>
                  <select className="field-select" value={triageForm.priority} onChange={(event) => setTriageForm((current) => ({ ...current, priority: event.target.value }))}>
                    {["low", "medium", "high", "urgent"].map((priority) => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                  <select className="field-select" value={triageForm.category} onChange={(event) => setTriageForm((current) => ({ ...current, category: event.target.value }))}>
                    {["general", "bug", "technical", "account_access", "subscription", "data_issue", "onboarding", "business_setup"].map((category) => (
                      <option key={category} value={category}>{category.replace("_", " ")}</option>
                    ))}
                  </select>
                  <select className="field-select" value={triageForm.assignedAdminId} onChange={(event) => setTriageForm((current) => ({ ...current, assignedAdminId: event.target.value }))}>
                    <option value="">Assign to me</option>
                    {adminAccounts.map((admin) => (
                      <option key={admin.id} value={admin.id}>{admin.name}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="field-textarea mt-4 min-h-[96px]"
                  placeholder="Internal admin-only notes"
                  value={triageForm.internalNotes}
                  onChange={(event) => setTriageForm((current) => ({ ...current, internalNotes: event.target.value }))}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Requested by {selectedConversation.requesterName} • {selectedConversation.requesterRole}
                  </div>
                  <Button
                    className="site-primary-button"
                    disabled={saveTriage.isPending}
                    onClick={() =>
                      saveTriage.mutate({
                        id: selectedConversation.id,
                        ...triageForm,
                      })
                    }
                  >
                    {saveTriage.isPending ? "Saving triage..." : "Save triage"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div ref={messageViewportRef} className="space-y-4 overflow-y-auto px-6 py-6" style={{ height: `${messageAreaHeight}px` }}>
              {selectedConversation.messages.map((message) => {
                const isMine = user?.id === message.senderId;
                return (
                  <div key={message.id} className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {message.senderName} | {new Date(message.createdAt).toLocaleString()}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        isMine
                          ? "bg-[linear-gradient(135deg,#2457d6,#4c73ef,#d1a447)] text-white"
                          : "border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {message.body}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              aria-label="Resize support chat"
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

            <div className="border-t border-slate-200/80 px-6 py-4 dark:border-slate-800">
              <div className="relative">
                <Input
                  className="min-h-[52px] pr-12"
                  placeholder={mode === "admin" ? "Reply as technical support..." : "Describe the issue or reply to support..."}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && draft.trim()) {
                      event.preventDefault();
                      sendMessage.mutate({ id: selectedConversation.id, body: draft.trim() });
                    }
                  }}
                />
                <button
                  className="absolute inset-y-0 right-1 my-auto rounded-full p-2 text-blue-600 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                  disabled={!draft.trim() || sendMessage.isPending}
                  onClick={() => sendMessage.mutate({ id: selectedConversation.id, body: draft.trim() })}
                  type="button"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 py-10 text-sm leading-7 text-slate-500 dark:text-slate-400">
            {mode === "requester" ? "Creating your support chat..." : "Select a support conversation to read and reply."}
          </div>
        )}
      </section>
    </div>
  );
}
