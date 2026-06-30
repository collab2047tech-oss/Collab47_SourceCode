"use server";

import { submitFeedback, setFeedbackStatus, type FeedbackKind, type FeedbackStatus } from "@/lib/db/feedback";

export async function submitFeedbackAction(input: {
  kind: FeedbackKind;
  subject: string;
  body: string;
  page_url?: string;
  user_agent?: string;
}) {
  return submitFeedback(input);
}

export async function setFeedbackStatusAction(id: string, status: FeedbackStatus, note?: string) {
  return setFeedbackStatus(id, status, note);
}
