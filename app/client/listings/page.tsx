import { notFound, redirect } from "next/navigation";
import ListingsClient from "./listings-client";
import { requireRealEstateClient } from "@/lib/listings/realEstate";

export default async function ClientListingsPage() {
  const res = await requireRealEstateClient();

  if ("error" in res) {
    if (res.status === 401) redirect("/client/login");
    if (res.status === 403) notFound();
    if (res.status === 404) redirect("/client/dashboard");
    notFound();
  }

  return <ListingsClient client={res.client} />;
}
