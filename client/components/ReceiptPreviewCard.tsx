import { useEffect, useMemo, useState } from "react";
import type { ReceiptItem } from "@shared/api";
import { Download, Printer, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type ReceiptPreviewCardProps = {
  receipt: ReceiptItem;
  title?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
};

function formatCurrency(cents: number | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function ReceiptPreviewCard({
  receipt,
  title = "Digital receipt",
  primaryLabel,
  onPrimary,
  primaryDisabled,
}: ReceiptPreviewCardProps) {
  const [isPrinted, setIsPrinted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setIsPrinted(false);
  }, [receipt.id]);

  const receiptRows = useMemo(
    () =>
      [
        ["Reference", receipt.referenceNumber],
        ["Visit type", receipt.visitType === "queue" ? "Live queue" : "Appointment"],
        ["Service", receipt.serviceName ?? "General service"],
        ["Issued", new Date(receipt.issuedAt).toLocaleString()],
      ] as Array<[string, string]>,
    [receipt],
  );

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const { blob, fileName } = await api.downloadReceipt(receipt.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className={`receipt-printer-card ${isPrinted ? "is-active" : ""}`}>
      <div className="receipt-printer-shell">
        <div className="receipt-printer-top" />
        <div className="receipt-printer-display">
          <div className="receipt-printer-title">{title}</div>
          <div className="receipt-printer-message">{receipt.referenceNumber}</div>
        </div>
        <button className="receipt-printer-trigger" type="button" onClick={() => setIsPrinted(true)}>
          <Printer className="h-4 w-4" />
        </button>
      </div>

      <div className="receipt-paper-wrapper">
        <div className="receipt-paper">
          <div className="receipt-paper-header">
            <div>
              <div className="receipt-paper-kicker">{receipt.businessName}</div>
              <div className="receipt-paper-title">Soft-copy receipt</div>
            </div>
            <div className="receipt-paper-icon">
              <ReceiptText className="h-4 w-4" />
            </div>
          </div>

          <div className="receipt-paper-meta">
            {receiptRows.map(([label, value]) => (
              <div key={label} className="receipt-paper-meta-row">
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {(receipt.lineItemLabel || receipt.totalCents != null || receipt.paymentNote) ? (
            <div className="receipt-paper-charge-box">
              {receipt.lineItemLabel ? (
                <div className="receipt-paper-meta-row">
                  <span>{receipt.lineItemLabel}</span>
                  <span>{formatCurrency(receipt.amountCents) ?? "Included"}</span>
                </div>
              ) : null}
              {receipt.totalCents != null ? (
                <div className="receipt-paper-total">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.totalCents)}</span>
                </div>
              ) : null}
              {receipt.paymentNote ? <div className="receipt-paper-note">{receipt.paymentNote}</div> : null}
            </div>
          ) : null}

          {receipt.ownerNote ? <div className="receipt-paper-note">{receipt.ownerNote}</div> : null}

          <div className="receipt-paper-actions">
            <Button className="site-primary-button w-full" disabled={isDownloading} onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? "Preparing download..." : "Download receipt"}
            </Button>
            {primaryLabel && onPrimary ? (
              <Button className="w-full" variant="outline" disabled={primaryDisabled} onClick={onPrimary}>
                {primaryLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
