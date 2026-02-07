
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

type RetailClient = {
  id: string;
  business_name: string | null;
  industry: string | null;
};

type RetailSettings = {
  business_id: string;
  province_code: string | null;
  default_tax_enabled: boolean;
  default_tax_rate_bps: number;
  currency_code: string;
  receipt_prefix: string;
  next_receipt_number: number;
};

type RetailCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  balance_after?: number;
  last_activity?: string | null;
};

type RetailTransaction = {
  id: string;
  customer_id: string;
  type: "sale" | "payment" | "refund";
  subtotal: number | null;
  discount_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number;
  amount: number | null;
  balance_after: number | null;
  province: string | null;
  memo: string | null;
  occurred_at: string;
  retail_customers?: { full_name?: string | null } | null;
};

type OverviewKpis = {
  sales_total_cents: number;
  payments_total_cents: number;
  refunds_total_cents: number;
  net_cashflow_cents: number;
  outstanding_receivables_cents: number;
};

type DailyReportRow = {
  date: string;
  sales_cents: number;
  payments_cents: number;
  refunds_cents: number;
};

const provinces = [
  "ON",
  "BC",
  "AB",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "PE",
  "QC",
  "SK",
  "YT",
];

function toMoney(cents: number, currency = "CAD") {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
}

function toDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseCents(value: string) {
  const clean = value.replace(/[^0-9.]/g, "");
  if (!clean) return 0;
  const parsed = Number(clean);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function computeDiscountAmount(
  subtotalCents: number,
  discountType: string,
  discountValueRaw: string
) {
  const value = Number(discountValueRaw || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (discountType === "percent") {
    return Math.round((subtotalCents * Math.min(100, value)) / 100);
  }
  if (discountType === "fixed") {
    return Math.max(0, Math.round(value * 100));
  }
  return 0;
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function RetailLedgerClient({ client }: { client: RetailClient }) {
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "transactions" | "reports">(
    "overview"
  );

  const [settings, setSettings] = useState<RetailSettings | null>(null);
  const [customers, setCustomers] = useState<RetailCustomer[]>([]);
  const [transactions, setTransactions] = useState<RetailTransaction[]>([]);
  const [overview, setOverview] = useState<OverviewKpis | null>(null);
  const [recentTx, setRecentTx] = useState<RetailTransaction[]>([]);
  const [reports, setReports] = useState<DailyReportRow[]>([]);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [rangeStart, setRangeStart] = useState(toDateInput(today));
  const [rangeEnd, setRangeEnd] = useState(toDateInput(today));

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStatus, setCustomerStatus] = useState("all");

  const [txType, setTxType] = useState("all");
  const [txCustomer, setTxCustomer] = useState("all");

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<RetailCustomer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    notes: "",
    status: "active",
  });

  const [selectedCustomer, setSelectedCustomer] = useState<RetailCustomer | null>(null);
  const [customerDetailTx, setCustomerDetailTx] = useState<RetailTransaction[]>([]);

  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({
    type: "sale",
    customer_id: "",
    occurred_at: toDateTimeInput(new Date()),
    memo: "",
    subtotal: "",
    discount_type: "none",
    discount_value: "",
    tax_enabled: true,
    tax_rate_bps: "",
    amount_paid: "",
    payment_amount: "",
    refund_amount: "",
  });

  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [quickCustomerId, setQuickCustomerId] = useState("");
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    full_name: "",
    phone: "",
  });

  const currency = settings?.currency_code || "CAD";

  function rangeToIso() {
    const start = new Date(`${rangeStart}T00:00:00`);
    const end = new Date(`${rangeEnd}T23:59:59.999`);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/retail/settings", { cache: "no-store" });
      if (!res.ok) {
        setErrorBanner(await res.text());
        return;
      }
      const json = await res.json();
      setSettings(json.settings || null);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to load settings.");
    }
  }

  async function loadCustomers() {
    setLoadingCustomers(true);
    setErrorBanner(null);
    try {
      const url = new URL("/api/retail/customers", window.location.origin);
      if (customerSearch.trim()) url.searchParams.set("search", customerSearch.trim());
      if (customerStatus !== "all") url.searchParams.set("status", customerStatus);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        setErrorBanner(await res.text());
        setLoadingCustomers(false);
        return;
      }
      const json = await res.json();
      setCustomers(Array.isArray(json?.customers) ? json.customers : []);
      setLoadingCustomers(false);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to load customers.");
      setLoadingCustomers(false);
    }
  }

  async function loadTransactions() {
    setLoadingTransactions(true);
    setErrorBanner(null);
    try {
      const { start, end } = rangeToIso();
      const url = new URL("/api/retail/transactions", window.location.origin);
      url.searchParams.set("start", start);
      url.searchParams.set("end", end);
      if (txType !== "all") url.searchParams.set("type", txType);
      if (txCustomer !== "all") url.searchParams.set("customer_id", txCustomer);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        setErrorBanner(await res.text());
        setLoadingTransactions(false);
        return;
      }
      const json = await res.json();
      setTransactions(Array.isArray(json?.transactions) ? json.transactions : []);
      setLoadingTransactions(false);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to load transactions.");
      setLoadingTransactions(false);
    }
  }

  async function loadOverview() {
    setLoadingOverview(true);
    setErrorBanner(null);
    try {
      const { start, end } = rangeToIso();
      const url = new URL("/api/retail/overview", window.location.origin);
      url.searchParams.set("start", start);
      url.searchParams.set("end", end);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        setErrorBanner(await res.text());
        setLoadingOverview(false);
        return;
      }
      const json = await res.json();
      setOverview(json.kpis || null);
      setRecentTx(Array.isArray(json?.recent_transactions) ? json.recent_transactions : []);
      setLoadingOverview(false);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to load overview.");
      setLoadingOverview(false);
    }
  }

  async function loadReports() {
    setLoadingReports(true);
    setErrorBanner(null);
    try {
      const { start, end } = rangeToIso();
      const url = new URL("/api/retail/reports/daily", window.location.origin);
      url.searchParams.set("start", start);
      url.searchParams.set("end", end);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        setErrorBanner(await res.text());
        setLoadingReports(false);
        return;
      }
      const json = await res.json();
      setReports(Array.isArray(json?.rows) ? json.rows : []);
      setLoadingReports(false);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to load reports.");
      setLoadingReports(false);
    }
  }

  async function loadCustomerDetail(customerId: string) {
    try {
      const res = await fetch(`/api/retail/customers/${customerId}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setCustomerDetailTx(Array.isArray(json?.transactions) ? json.transactions : []);
    } catch {
      setCustomerDetailTx([]);
    }
  }

  useEffect(() => {
    loadSettings();
    loadOverview();
    loadCustomers();
    loadTransactions();
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "overview") loadOverview();
    if (activeTab === "transactions") loadTransactions();
    if (activeTab === "reports") loadReports();
    if (activeTab === "customers") loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rangeStart, rangeEnd, txType, txCustomer, customerSearch, customerStatus]);

  function openCustomerModal(customer?: RetailCustomer) {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerForm({
        full_name: customer.full_name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        notes: customer.notes || "",
        status: customer.status || "active",
      });
    } else {
      setEditingCustomer(null);
      setCustomerForm({
        full_name: "",
        phone: "",
        email: "",
        notes: "",
        status: "active",
      });
    }
    setShowCustomerModal(true);
  }

  async function saveCustomer() {
    try {
      const payload = { ...customerForm };
      const res = await fetch(
        editingCustomer ? `/api/retail/customers/${editingCustomer.id}` : "/api/retail/customers",
        {
          method: editingCustomer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        setErrorBanner(await res.text());
        return;
      }
      setShowCustomerModal(false);
      await loadCustomers();
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to save customer.");
    }
  }

  function openTxModal(type: "sale" | "payment" | "refund", customerId?: string) {
    setTxForm((prev) => ({
      ...prev,
      type,
      customer_id: customerId || prev.customer_id || "",
      occurred_at: toDateTimeInput(new Date()),
      memo: "",
      subtotal: "",
      discount_type: "none",
      discount_value: "",
      tax_enabled: settings?.default_tax_enabled ?? true,
      tax_rate_bps: settings?.default_tax_rate_bps?.toString() || "",
      amount_paid: "",
      payment_amount: "",
      refund_amount: "",
    }));
    setShowTxModal(true);
  }

  async function createTransaction() {
    try {
      if (!txForm.customer_id) {
        setErrorBanner("Please select a customer.");
        return;
      }
      const payload: any = {
        type: txForm.type,
        customer_id: txForm.customer_id,
        occurred_at: new Date(txForm.occurred_at).toISOString(),
        memo: txForm.memo || null,
        province: settings?.province_code || null,
      };

      if (txForm.type === "sale") {
        const subtotalCents = parseCents(txForm.subtotal);
        if (subtotalCents <= 0) {
          setErrorBanner("Subtotal must be greater than 0.");
          return;
        }
        payload.subtotal = subtotalCents;
        payload.discount_amount = computeDiscountAmount(
          subtotalCents,
          txForm.discount_type,
          txForm.discount_value
        );
        const bps = Number(txForm.tax_rate_bps || 0);
        payload.tax_rate = txForm.tax_enabled ? bps / 100 : 0;
        payload.amount = parseCents(txForm.amount_paid);
      }

      if (txForm.type === "payment") {
        const amount = parseCents(txForm.payment_amount);
        if (amount <= 0) {
          setErrorBanner("Payment amount must be greater than 0.");
          return;
        }
        payload.amount = amount;
      }

      if (txForm.type === "refund") {
        const amount = parseCents(txForm.refund_amount);
        if (amount <= 0) {
          setErrorBanner("Refund amount must be greater than 0.");
          return;
        }
        payload.amount = amount;
      }

      const res = await fetch("/api/retail/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setErrorBanner(await res.text());
        return;
      }

      setShowTxModal(false);
      await Promise.all([loadOverview(), loadTransactions(), loadCustomers()]);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to create transaction.");
    }
  }

  async function updateSettings(patch: Partial<RetailSettings>) {
    try {
      const res = await fetch("/api/retail/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setErrorBanner(await res.text());
        return;
      }
      const json = await res.json();
      setSettings(json.settings || null);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to update settings.");
    }
  }

  function openQuickCustomerModal() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
    setQuickCustomerId(id);
    setQuickCustomerForm({ full_name: "", phone: "" });
    setShowQuickCustomerModal(true);
  }

  async function saveQuickCustomer() {
    try {
      if (!quickCustomerForm.full_name.trim()) {
        setErrorBanner("Customer name is required.");
        return;
      }
      const res = await fetch("/api/retail/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: quickCustomerForm.full_name.trim(),
          phone: quickCustomerForm.phone.trim(),
          notes: `Customer ID: ${quickCustomerId}`,
          status: "active",
        }),
      });

      if (!res.ok) {
        setErrorBanner(await res.text());
        return;
      }

      const json = await res.json();
      const newCustomer = json.customer;
      await loadCustomers();
      setTxForm((prev) => ({ ...prev, customer_id: newCustomer?.id || prev.customer_id }));
      setShowQuickCustomerModal(false);
    } catch (err: any) {
      setErrorBanner(err?.message || "Failed to create customer.");
    }
  }

  function downloadCsv() {
    const { start, end } = rangeToIso();
    const url = new URL("/api/retail/export/csv", window.location.origin);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    if (txType !== "all") url.searchParams.set("type", txType);
    if (txCustomer !== "all") url.searchParams.set("customer_id", txCustomer);
    window.open(url.toString(), "_blank");
  }

  function downloadReportCsv() {
    const rows = reports.map((r) => ({
      date: r.date,
      sales_cents: r.sales_cents,
      payments_cents: r.payments_cents,
      refunds_cents: r.refunds_cents,
      net_cents: r.payments_cents - r.refunds_cents,
    }));
    const header = ["date", "sales_cents", "payments_cents", "refunds_cents", "net_cents"];
    const csv = [header.join(",")]
      .concat(
        rows.map((r) =>
          [r.date, r.sales_cents, r.payments_cents, r.refunds_cents, r.net_cents].join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "retail-daily-report.csv";
    link.click();
  }

  function openReceipt(id: string, print = false) {
    const url = `/dashboard/retail-ledger/receipt/${id}${print ? "?print=1" : ""}`;
    window.open(url, "_blank");
  }

  const customerOptions = useMemo(() => customers, [customers]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-emerald-950/60 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Retail Ledger</h1>
            <div className="mt-1 text-sm opacity-70">
              {client.business_name || "Client"} • {client.industry || "—"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/client/dashboard">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          </div>
        </div>

        {errorBanner ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorBanner}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          {[
            { id: "overview", label: "Overview" },
            { id: "customers", label: "Customers" },
            { id: "transactions", label: "Transactions" },
            { id: "reports", label: "Reports" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={[
                "rounded-full border px-4 py-2 transition",
                activeTab === tab.id
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs opacity-70">Start</Label>
              <Input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="mt-1 bg-black/30 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-xs opacity-70">End</Label>
              <Input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="mt-1 bg-black/30 border-white/10 text-white"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={() => loadOverview()}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase opacity-60">Sales Total</div>
                <div className="mt-2 text-3xl font-semibold">
                  {toMoney(overview?.sales_total_cents || 0, currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase opacity-60">Payments Collected</div>
                <div className="mt-2 text-3xl font-semibold">
                  {toMoney(overview?.payments_total_cents || 0, currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase opacity-60">Refunds Total</div>
                <div className="mt-2 text-3xl font-semibold">
                  {toMoney(overview?.refunds_total_cents || 0, currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase opacity-60">Net Cashflow</div>
                <div className="mt-2 text-3xl font-semibold">
                  {toMoney(overview?.net_cashflow_cents || 0, currency)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase opacity-60">Outstanding Receivables</div>
                <div className="mt-2 text-3xl font-semibold">
                  {toMoney(overview?.outstanding_receivables_cents || 0, currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">Recent Transactions</div>
                    <div className="text-sm opacity-70">Latest activity in this range</div>
                  </div>
                  {loadingOverview ? (
                    <div className="text-xs opacity-70">Loading...</div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {recentTx.length === 0 ? (
                    <div className="text-sm opacity-70">No recent activity.</div>
                  ) : (
                    recentTx.map((tx) => (
                      <div
                        key={tx.id}
                        className="rounded-xl border border-white/10 bg-black/30 p-4 flex items-start justify-between gap-4"
                      >
                        <div>
                          <div className="font-medium capitalize">
                            {tx.type} • {tx.retail_customers?.full_name || "Customer"}
                          </div>
                          <div className="text-xs opacity-70 mt-1">{formatDateTime(tx.occurred_at)}</div>
                        </div>
                        <div className="text-sm font-semibold">
                          {toMoney(tx.total || 0, currency)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
                <div>
                  <div className="text-lg font-semibold">Quick Add</div>
                  <div className="text-sm opacity-70">Record activity in seconds</div>
                </div>
                <div className="space-y-2">
                  <Button className="w-full" onClick={() => openTxModal("sale")}>
                    New Sale
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => openTxModal("payment")}>
                    Record Payment
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => openTxModal("refund")}>
                    Refund
                  </Button>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="text-sm font-medium">Default Tax</div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs opacity-70">Enabled</label>
                    <input
                      type="checkbox"
                      checked={settings?.default_tax_enabled ?? true}
                      onChange={(e) => updateSettings({ default_tax_enabled: e.target.checked })}
                    />
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs opacity-70">Province</Label>
                    <Select
                      value={settings?.province_code || "ON"}
                      onValueChange={(value) => updateSettings({ province_code: value })}
                    >
                      <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        {provinces.map((p) => (
                          <SelectItem key={p} value={p} className="text-white">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs opacity-70">Tax Rate (bps)</Label>
                    <Input
                      value={settings?.default_tax_rate_bps ?? 0}
                      onChange={(e) =>
                        updateSettings({ default_tax_rate_bps: Number(e.target.value || 0) })
                      }
                      className="mt-1 bg-black/30 border-white/10 text-white"
                    />
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs opacity-70">Receipt Prefix</Label>
                    <Input
                      value={settings?.receipt_prefix ?? "MGCO"}
                      onChange={(e) => updateSettings({ receipt_prefix: e.target.value })}
                      className="mt-1 bg-black/30 border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "customers" ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label className="text-xs opacity-70">Search</Label>
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                  placeholder="Name, email, phone"
                />
              </div>
              <div>
                <Label className="text-xs opacity-70">Status</Label>
                <Select value={customerStatus} onValueChange={setCustomerStatus}>
                  <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="all" className="text-white">
                      All
                    </SelectItem>
                    <SelectItem value="active" className="text-white">
                      Active
                    </SelectItem>
                    <SelectItem value="inactive" className="text-white">
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" onClick={loadCustomers} disabled={loadingCustomers}>
                  {loadingCustomers ? "Loading..." : "Refresh"}
                </Button>
                <Button onClick={() => openCustomerModal()}>Add Customer</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide opacity-60 border-b border-white/10">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Balance</th>
                    <th className="py-2 pr-3">Last Activity</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 pr-3 font-medium">{c.full_name}</td>
                      <td className="py-3 pr-3">{c.phone || "—"}</td>
                      <td className="py-3 pr-3">{c.email || "—"}</td>
                      <td className="py-3 pr-3">
                        {toMoney(c.balance_after || 0, currency)}
                      </td>
                      <td className="py-3 pr-3">
                        {c.last_activity ? formatDateTime(c.last_activity) : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs hover:opacity-100 opacity-80"
                            onClick={() => {
                              setSelectedCustomer(c);
                              loadCustomerDetail(c.id);
                            }}
                          >
                            View
                          </button>
                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs hover:opacity-100 opacity-80"
                            onClick={() => openCustomerModal(c)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm opacity-70">
                        No customers yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {selectedCustomer ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{selectedCustomer.full_name}</div>
                    <div className="text-sm opacity-70">
                      Balance: {toMoney(selectedCustomer.balance_after || 0, currency)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openTxModal("sale", selectedCustomer.id)}>
                      New Sale
                    </Button>
                    <Button variant="secondary" onClick={() => openTxModal("payment", selectedCustomer.id)}>
                      Record Payment
                    </Button>
                    <Button variant="secondary" onClick={() => openTxModal("refund", selectedCustomer.id)}>
                      Refund
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {customerDetailTx.length === 0 ? (
                    <div className="text-sm opacity-70">No transactions yet.</div>
                  ) : (
                    customerDetailTx.map((tx) => (
                      <div key={tx.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-start justify-between">
                          <div className="font-medium capitalize">{tx.type}</div>
                          <div className="text-sm font-semibold">{toMoney(tx.total, currency)}</div>
                        </div>
                        <div className="text-xs opacity-70 mt-1">{formatDateTime(tx.occurred_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "transactions" ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <Label className="text-xs opacity-70">Type</Label>
                <Select value={txType} onValueChange={setTxType}>
                  <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="all" className="text-white">
                      All
                    </SelectItem>
                    <SelectItem value="sale" className="text-white">
                      Sale
                    </SelectItem>
                    <SelectItem value="payment" className="text-white">
                      Payment
                    </SelectItem>
                    <SelectItem value="refund" className="text-white">
                      Refund
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs opacity-70">Customer</Label>
                <Select value={txCustomer} onValueChange={setTxCustomer}>
                  <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="all" className="text-white">
                      All
                    </SelectItem>
                    {customerOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-white">
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" onClick={loadTransactions} disabled={loadingTransactions}>
                  {loadingTransactions ? "Loading..." : "Refresh"}
                </Button>
                <Button variant="secondary" onClick={downloadCsv}>
                  Export CSV
                </Button>
                <Button onClick={() => openTxModal("sale")}>New Transaction</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide opacity-60 border-b border-white/10">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Memo</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Balance Change</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 pr-3">{formatDateTime(tx.occurred_at)}</td>
                      <td className="py-3 pr-3 capitalize">{tx.type}</td>
                      <td className="py-3 pr-3">{tx.retail_customers?.full_name || "—"}</td>
                      <td className="py-3 pr-3">{tx.memo || "—"}</td>
                      <td className="py-3 pr-3">{toMoney(tx.total, currency)}</td>
                      <td className="py-3 pr-3">
                        {toMoney(
                          tx.type === "sale"
                            ? (tx.total || 0) - (tx.amount || 0)
                            : -(tx.amount || 0),
                          currency
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs opacity-80 hover:opacity-100"
                            onClick={() => openReceipt(tx.id)}
                          >
                            View Receipt
                          </button>
                          <button
                            className="rounded-md border border-white/10 px-2 py-1 text-xs opacity-80 hover:opacity-100"
                            onClick={() => openReceipt(tx.id, true)}
                          >
                            Download PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm opacity-70">
                        No transactions found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Daily Breakdown</div>
                <div className="text-sm opacity-70">Sales, payments, refunds, and net totals</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={loadReports} disabled={loadingReports}>
                  {loadingReports ? "Loading..." : "Refresh"}
                </Button>
                <Button variant="secondary" onClick={downloadReportCsv}>
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide opacity-60 border-b border-white/10">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Sales</th>
                    <th className="py-2 pr-3">Payments</th>
                    <th className="py-2 pr-3">Refunds</th>
                    <th className="py-2 pr-3">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reports.map((row) => (
                    <tr key={row.date}>
                      <td className="py-3 pr-3">{row.date}</td>
                      <td className="py-3 pr-3">{toMoney(row.sales_cents, currency)}</td>
                      <td className="py-3 pr-3">{toMoney(row.payments_cents, currency)}</td>
                      <td className="py-3 pr-3">{toMoney(row.refunds_cents, currency)}</td>
                      <td className="py-3 pr-3">
                        {toMoney(row.payments_cents - row.refunds_cents, currency)}
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm opacity-70">
                        No report data for this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {showCustomerModal ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="text-lg font-semibold">
              {editingCustomer ? "Edit Customer" : "Add Customer"}
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={customerForm.full_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={customerForm.status}
                  onValueChange={(value) => setCustomerForm({ ...customerForm, status: value })}
                >
                  <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="active" className="text-white">
                      Active
                    </SelectItem>
                    <SelectItem value="inactive" className="text-white">
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCustomerModal(false)}>
                Cancel
              </Button>
              <Button onClick={saveCustomer}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showQuickCustomerModal ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="text-lg font-semibold">New Customer</div>
            <div className="mt-2 text-xs opacity-70">Customer ID: {quickCustomerId}</div>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={quickCustomerForm.full_name}
                  onChange={(e) =>
                    setQuickCustomerForm({ ...quickCustomerForm, full_name: e.target.value })
                  }
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={quickCustomerForm.phone}
                  onChange={(e) =>
                    setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })
                  }
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowQuickCustomerModal(false)}>
                Cancel
              </Button>
              <Button onClick={saveQuickCustomer}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showTxModal ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="text-lg font-semibold">New Transaction</div>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={txForm.type}
                  onValueChange={(value) => setTxForm({ ...txForm, type: value })}
                >
                  <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    <SelectItem value="sale" className="text-white">
                      Sale
                    </SelectItem>
                    <SelectItem value="payment" className="text-white">
                      Payment
                    </SelectItem>
                    <SelectItem value="refund" className="text-white">
                      Refund
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Customer</Label>
                  <button
                    type="button"
                    onClick={openQuickCustomerModal}
                    className="inline-flex items-center gap-1 text-xs text-emerald-200 hover:text-emerald-100"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </button>
                </div>
                <Select
                  value={txForm.customer_id}
                  onValueChange={(value) => setTxForm({ ...txForm, customer_id: value })}
                >
                  <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10">
                    {customerOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-white">
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={txForm.occurred_at}
                  onChange={(e) => setTxForm({ ...txForm, occurred_at: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                />
              </div>
              <div>
                <Label>Memo</Label>
                <Input
                  value={txForm.memo}
                  onChange={(e) => setTxForm({ ...txForm, memo: e.target.value })}
                  className="mt-1 bg-black/30 border-white/10 text-white"
                  placeholder="Optional note"
                />
              </div>

              {txForm.type === "sale" ? (
                <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div>
                    <Label>Subtotal</Label>
                    <Input
                      value={txForm.subtotal}
                      onChange={(e) => setTxForm({ ...txForm, subtotal: e.target.value })}
                      className="mt-1 bg-black/30 border-white/10 text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Discount Type</Label>
                      <Select
                        value={txForm.discount_type}
                        onValueChange={(value) => setTxForm({ ...txForm, discount_type: value })}
                      >
                        <SelectTrigger className="mt-1 bg-black/30 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black border-white/10">
                          <SelectItem value="none" className="text-white">
                            None
                          </SelectItem>
                          <SelectItem value="percent" className="text-white">
                            Percent
                          </SelectItem>
                          <SelectItem value="fixed" className="text-white">
                            Fixed
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Discount Value</Label>
                      <Input
                        value={txForm.discount_value}
                        onChange={(e) => setTxForm({ ...txForm, discount_value: e.target.value })}
                        className="mt-1 bg-black/30 border-white/10 text-white"
                        placeholder={txForm.discount_type === "percent" ? "0-100" : "0.00"}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={txForm.tax_enabled}
                      onChange={(e) => setTxForm({ ...txForm, tax_enabled: e.target.checked })}
                    />
                    <Label>Tax Enabled</Label>
                  </div>
                  <div>
                    <Label>Tax Rate (bps)</Label>
                    <Input
                      value={txForm.tax_rate_bps}
                      onChange={(e) => setTxForm({ ...txForm, tax_rate_bps: e.target.value })}
                      className="mt-1 bg-black/30 border-white/10 text-white"
                      placeholder="1300"
                    />
                  </div>
                  <div>
                    <Label>Amount Paid</Label>
                    <Input
                      value={txForm.amount_paid}
                      onChange={(e) => setTxForm({ ...txForm, amount_paid: e.target.value })}
                      className="mt-1 bg-black/30 border-white/10 text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : null}

              {txForm.type === "payment" ? (
                <div>
                  <Label>Payment Amount</Label>
                  <Input
                    value={txForm.payment_amount}
                    onChange={(e) => setTxForm({ ...txForm, payment_amount: e.target.value })}
                    className="mt-1 bg-black/30 border-white/10 text-white"
                    placeholder="0.00"
                  />
                </div>
              ) : null}

              {txForm.type === "refund" ? (
                <div>
                  <Label>Refund Amount</Label>
                  <Input
                    value={txForm.refund_amount}
                    onChange={(e) => setTxForm({ ...txForm, refund_amount: e.target.value })}
                    className="mt-1 bg-black/30 border-white/10 text-white"
                    placeholder="0.00"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowTxModal(false)}>
                Cancel
              </Button>
              <Button onClick={createTransaction}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

