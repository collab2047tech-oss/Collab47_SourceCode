import { Reveal } from "@/components/motion/Reveal";
import { MessagesShell } from "@/components/composite/MessagesShell";

export const dynamic = "force-dynamic";

export default function MessagesPage() {
  // The conversation list now lives in MessagesProvider (seeded once in the
  // messages layout), so this page is just the two-pane shell. No per-visit
  // inbox re-derivation here - the rail paints instantly from client cache.
  return (
    <Reveal>
      <MessagesShell />
    </Reveal>
  );
}
