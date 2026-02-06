"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type ReceiptTransaction = {
  id: string;
  type: "sale" | "payment" | "refund";
  occurred_at: string;
  reference: string | null;
  method: string | null;
  subtotal_cents: number | null;
  discount_type: string | null;
  discount_value: number | null;
  tax_enabled: boolean | null;
  tax_rate_bps: number | null;
  tax_cents: number | null;
  total_cents: number;
  amount_paid_cents: number | null;
  payment_cents: number | null;
  refund_cents: number | null;
  balance_change_cents: number;
  receipt_prefix?: string | null;
  receipt_number?: number | null;
  retail_customers?: { full_name?: string | null; email?: string | null; phone?: string | null } | null;
};

function toMoney(cents: number) {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
}

export default function ReceiptClient({ transactionId }: { transactionId: string }) {
  const [tx, setTx] = useState<ReceiptTransaction | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const shouldPrint = searchParams.get("print") === "1";

  useEffect(() => {
    async function loadReceipt() {
      try {
        const res = await fetch(`/api/retail/receipt/${transactionId}`, { cache: "no-store" });
        if (!res.ok) {
          setError(await res.text());
          return;
        }
        const json = await res.json();
        setTx(json.transaction || null);
        setBusinessName(json.business?.business_name || null);
      } catch (err: any) {
        setError(err?.message || "Failed to load receipt.");
      }
    }
    loadReceipt();
  }, [transactionId]);

  useEffect(() => {
    if (shouldPrint && tx) {
      setTimeout(() => window.print(), 300);
    }
  }, [shouldPrint, tx]);

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  if (!tx) {
    return <div className="p-6 text-white/70">Loading receipt...</div>;
  }

  const receiptNumber =
    tx.receipt_prefix && tx.receipt_number ? `${tx.receipt_prefix}-${tx.receipt_number}` : "—";
  const subtotal = tx.subtotal_cents || 0;
  let discountCents = 0;
  if (tx.discount_type === "percent" && tx.discount_value) {
    discountCents = Math.round((subtotal * tx.discount_value) / 100);
  }
  if (tx.discount_type === "fixed" && tx.discount_value) {
    discountCents = Math.round(tx.discount_value * 100);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">{businessName || "Business"}</div>
            <div className="text-sm text-slate-500">Receipt #{receiptNumber}</div>
          </div>
          <Button className="print:hidden" onClick={() => window.print()}>
            Download PDF
          </Button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between text-sm">
            <div>
              <div className="font-medium">Customer</div>
              <div>{tx.retail_customers?.full_name || "—"}</div>
              <div className="text-slate-500">{tx.retail_customers?.email || ""}</div>
              <div className="text-slate-500">{tx.retail_customers?.phone || ""}</div>
            </div>
            <div className="text-right">
              <div className="font-medium capitalize">{tx.type}</div>
              <div className="text-slate-500">{new Date(tx.occurred_at).toLocaleString()}</div>
              {tx.method ? <div className="text-slate-500">{tx.method}</div> : null}
            </div>
          </div>

          {tx.type === "sale" ? (
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{toMoney(tx.subtotal_cents || 0)}</span>
              </div>
              {tx.discount_type && tx.discount_type !== "none" ? (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount</span>
                  <span>-{toMoney(discountCents)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <span>{toMoney(tx.tax_cents || 0)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{toMoney(tx.total_cents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Paid</span>
                <span>{toMoney(tx.amount_paid_cents || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Owed</span>
                <span>{toMoney(Math.max(0, tx.balance_change_cents))}</span>
              </div>
            </div>
          ) : null}

          {tx.type === "payment" ? (
            <div className="mt-6 text-sm">
              <div className="flex items-center justify-between font-semibold">
                <span>Payment</span>
                <span>{toMoney(tx.payment_cents || 0)}</span>
              </div>
            </div>
          ) : null}

          {tx.type === "refund" ? (
            <div className="mt-6 text-sm">
              <div className="flex items-center justify-between font-semibold">
                <span>Refund</span>
                <span>{toMoney(tx.refund_cents || 0)}</span>
              </div>
            </div>
          ) : null}

          {tx.reference ? (
            <div className="mt-4 text-xs text-slate-500">Reference: {tx.reference}</div>
          ) : null}
        </div>

        <div className="mt-6 text-xs text-slate-500">Generated by MG&CO Dashboard</div>
      </div>
    </div>
  );
}
