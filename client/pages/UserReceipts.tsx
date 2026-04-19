import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { CachedDataNote } from "@/components/CachedDataNote";
import ReceiptPreviewCard from "@/components/ReceiptPreviewCard";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

export default function UserReceipts() {
  const { user } = useSession();
  const scope = getAccountScope(user);
  const [searchParams] = useSearchParams();
  const selectedReceiptId = Number(searchParams.get("receipt") ?? "0");
  const receiptsQuery = useQuery({
    queryKey: accountQueryKeys.receipts(scope.userId),
    queryFn: api.getReceipts,
  });

  const receipts = receiptsQuery.data?.receipts ?? [];
  const selectedReceipt = useMemo(
    () => receipts.find((item) => item.id === selectedReceiptId) ?? receipts[0] ?? null,
    [receipts, selectedReceiptId],
  );

  return (
    <UserWorkspaceFrame
      title="Receipts"
      subtitle="Keep your soft-copy receipts in their own route so they stay easy to reopen, save, and download."
    >
      <section className="grid gap-7 xl:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)]">
        <div className="section-shell panel-roomy">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-5 w-5 text-blue-600" />
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Saved receipts</h2>
          </div>
          <div className="mt-2">
            <CachedDataNote queryKey={accountQueryKeys.receipts(scope.userId)} />
          </div>
          <div className="mt-6 space-y-4">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                className={`block rounded-[1.4rem] border p-5 transition ${
                  selectedReceipt?.id === receipt.id
                    ? "border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-slate-900"
                    : "border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                }`}
                to={`/account/receipts?receipt=${receipt.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{receipt.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {receipt.serviceName ?? "General service"} | {receipt.visitType === "queue" ? "Live queue" : "Appointment"}
                    </div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:bg-slate-950 dark:text-blue-200">
                    {receipt.referenceNumber}
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{new Date(receipt.issuedAt).toLocaleString()}</div>
              </Link>
            ))}
            {!receipts.length ? <div className="empty-panel p-8 text-center">No digital receipts are available yet. Businesses that support receipts will place them here after a completed visit.</div> : null}
          </div>
        </div>

        <div className="section-shell panel-roomy">
          {selectedReceipt ? (
            <ReceiptPreviewCard receipt={selectedReceipt} />
          ) : (
            <div className="empty-panel p-10 text-center">
              Select a receipt to preview and download its soft copy.
            </div>
          )}
        </div>
      </section>
    </UserWorkspaceFrame>
  );
}
