import { notFound, redirect } from "next/navigation";
import { requireRetailClient } from "@/lib/retail/guard";
import ReceiptClient from "../receipt-client";

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const res = await requireRetailClient();

  if ("error" in res) {
    if (res.status === 401) redirect("/client/login");
    if (res.status === 403) redirect("/dashboard");
    if (res.status === 404) redirect("/dashboard");
    notFound();
  }

  return <ReceiptClient transactionId={params.id} />;
}
