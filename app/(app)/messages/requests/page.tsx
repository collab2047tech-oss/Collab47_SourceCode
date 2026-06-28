import { RequestsList } from "@/components/messages/RequestsList";

export const dynamic = "force-dynamic";

export default function RequestsPage() {
  // The requests list is read from MessagesProvider (seeded once in the messages
  // layout), so Accept/Decline animate optimistically and the shared rail stays
  // in sync. No per-visit re-fetch here.
  return <RequestsList />;
}
