export const dynamic = "force-dynamic";

/**
 * Messages layout. The inbox is now seeded ONCE app-wide in app/(app)/layout.tsx
 * (a single MessagesProvider wraps the whole shell), so the conversation rail is
 * held in client memory and the DM unread badge stays live on every page - not
 * only inside /messages. This layout is kept as a thin pass-through so the
 * existing route nesting (index, requests, each thread) is unchanged.
 */
export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
