import { notFound, redirect } from "next/navigation";
import RetailLedgerClient from "./retail-ledger-client";
import { requireRetailClient } from "@/lib/retail/guard";

export default async function RetailLedgerPage() {
  const res = await requireRetailClient();

  if ("error" in res) {
    if (res.status === 401) redirect("/client/login");
    if (res.status === 403) redirect("/dashboard");
    if (res.status === 404) redirect("/dashboard");
    notFound();
  }

  return <RetailLedgerClient client={res.client} />;
}
