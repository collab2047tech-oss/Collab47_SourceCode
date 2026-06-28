// Thread-pane skeleton shown while a conversation's messages load, so switching
// chats swaps the pane instantly instead of blanking on the server round-trip.
export default function ChatLoading() {
  return (
    <div className="flex h-full flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-bone px-4 py-3">
        <div className="size-9 shrink-0 animate-pulse rounded-full bg-bone" />
        <div className="h-3 w-32 animate-pulse rounded bg-bone" />
      </div>
      {/* Bubbles */}
      <div className="flex-1 space-y-4 p-4">
        {[
          "w-40 self-start",
          "w-56 self-end",
          "w-32 self-start",
          "w-48 self-end",
          "w-44 self-start",
        ].map((c, i) => (
          <div key={i} className={`flex ${c.includes("self-end") ? "justify-end" : "justify-start"}`}>
            <div className={`h-10 animate-pulse rounded-2xl bg-bone/70 ${c.replace("self-start", "").replace("self-end", "")}`} />
          </div>
        ))}
      </div>
      {/* Composer */}
      <div className="border-t border-bone p-3">
        <div className="h-11 w-full animate-pulse rounded-full bg-bone/60" />
      </div>
    </div>
  );
}
