import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminRegisterInput, AuthPayload, LoginInput, OwnerRegisterInput, RegisterInput } from "@shared/api";
import { api } from "@/lib/api";
import { accountScopedQueryRoots } from "@/lib/accountQueryKeys";

type SessionContextValue = {
  user: Awaited<ReturnType<typeof api.me>>["user"] | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<AuthPayload>;
  register: (input: RegisterInput) => Promise<AuthPayload>;
  registerOwner: (input: OwnerRegisterInput) => Promise<AuthPayload>;
  registerAdmin: (input: AdminRegisterInput) => Promise<AuthPayload>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.me,
  });

  const clearAccountScopedQueries = () =>
    queryClient.removeQueries({
      predicate: (query) => {
        const root = query.queryKey[0];
        return typeof root === "string" && accountScopedQueryRoots.has(root);
      },
    });

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      clearAccountScopedQueries();
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: api.register,
    onSuccess: async () => {
      clearAccountScopedQueries();
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const registerOwnerMutation = useMutation({
    mutationFn: api.registerOwner,
    onSuccess: async () => {
      clearAccountScopedQueries();
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const registerAdminMutation = useMutation({
    mutationFn: api.registerAdmin,
    onSuccess: async () => {
      clearAccountScopedQueries();
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      clearAccountScopedQueries();
      queryClient.setQueryData(["session"], { user: null });
      await queryClient.invalidateQueries();
    },
  });

  const value = useMemo(
    () => ({
      user: sessionQuery.data?.user ?? null,
      isLoading: sessionQuery.isLoading,
      login: async (input: LoginInput) => {
        return await loginMutation.mutateAsync(input);
      },
      register: async (input: RegisterInput) => {
        return await registerMutation.mutateAsync(input);
      },
      registerOwner: async (input: OwnerRegisterInput) => {
        return await registerOwnerMutation.mutateAsync(input);
      },
      registerAdmin: async (input: AdminRegisterInput) => {
        return await registerAdminMutation.mutateAsync(input);
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
      },
      refresh: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
    }),
    [loginMutation, logoutMutation, queryClient, registerAdminMutation, registerMutation, registerOwnerMutation, sessionQuery.data?.user, sessionQuery.isLoading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
