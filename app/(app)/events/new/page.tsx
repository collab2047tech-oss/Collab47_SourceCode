import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/composite/EventForm";

export default function NewEventPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-sm text-ash transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Back to Events
      </Link>
      <p className="mt-6 text-caption text-ash">Events & Competitions</p>
      <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-h1">
        Post an{" "}
        <span className="italic text-saffron">event.</span>
      </h1>
      <p className="mt-3 text-body-sm text-ash">
        Share a hackathon, competition, workshop, conference, or fest. Anyone on
        Collab47 can browse it and register.
      </p>

      <EventForm />
    </div>
  );
}
