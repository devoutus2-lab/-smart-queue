import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssistantActionProposal, AssistantFeedbackInput, AssistantRequest, AssistantResponse, AuthPayload } from "@shared/api";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

type SessionUser = AuthPayload["user"];

function getAssistantScopeId(user: SessionUser) {
  const scope = getAccountScope(user);
  return user?.role === "owner" ? scope.ownerBusinessId : scope.userId;
}

export function useAssistantThread(user: SessionUser) {
  const queryClient = useQueryClient();
  const scopeId = getAssistantScopeId(user);
  const role = user?.role ?? "guest";
  const threadQuery = useQuery({
    queryKey: accountQueryKeys.assistantThread(role, scopeId),
    queryFn: api.getAssistantThread,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!user) return;
    queryClient.removeQueries({ queryKey: ["assistant-thread"] });
  }, [queryClient, user?.id, user?.role]);

  const syncThread = async (response: AssistantResponse) => {
    if (!user || !response.thread) return response;
    queryClient.setQueryData(accountQueryKeys.assistantThread(user.role, scopeId), { thread: response.thread });
    return response;
  };

  const askAssistant = useMutation({
    mutationFn: async (payload: AssistantRequest) => {
      if (user?.role === "owner") return syncThread(await api.askOwnerAssistant(payload));
      if (user?.role === "admin") return syncThread(await api.askAdminAssistant(payload));
      return syncThread(await api.askUserAssistant(payload));
    },
  });

  const executeAssistantAction = useMutation({
    mutationFn: async (payload: AssistantActionProposal) => syncThread(await api.executeAssistantAction(payload)),
  });

  const submitAssistantFeedback = useMutation({
    mutationFn: async (payload: AssistantFeedbackInput) => {
      const response = await api.submitAssistantFeedback(payload);
      if (user) {
        queryClient.setQueryData(accountQueryKeys.assistantThread(user.role, scopeId), { thread: response.thread });
      }
      return response;
    },
  });

  return {
    thread: threadQuery.data?.thread ?? null,
    threadQuery,
    askAssistant,
    executeAssistantAction,
    submitAssistantFeedback,
  };
}
