import { sendEmail, escapeHtml } from "./send";
import { emailShell } from "./render";

/**
 * Email the admin team when a new bug/feature report lands, so nothing sits
 * unseen in the triage queue. Recipients come from ADMIN_ALERT_EMAILS
 * (comma-separated). No-ops if unset. Fire-and-forget.
 */
export async function sendFeedbackAlert(f: {
  kind: string;
  subject: string;
  body: string;
  pageUrl?: string | null;
  reporterEmail?: string | null;
}): Promise<void> {
  const to = (process.env.ADMIN_ALERT_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) return;

  const meta = [
    f.pageUrl ? `<p style="margin:0;color:#8A93A6;font-size:13px">Page: ${escapeHtml(f.pageUrl)}</p>` : "",
    f.reporterEmail ? `<p style="margin:4px 0 0;color:#8A93A6;font-size:13px">From: ${escapeHtml(f.reporterEmail)}</p>` : "",
  ].join("");

  const html = emailShell({
    title: `New ${escapeHtml(f.kind)} report`,
    intro: `Someone just submitted a ${escapeHtml(f.kind)} on Collab47.`,
    bodyHtml: `<p style="margin:0 0 8px"><strong style="color:#0A0F1C">${escapeHtml(f.subject)}</strong></p>
      <p style="margin:0 0 14px;white-space:pre-line">${escapeHtml(f.body)}</p>${meta}`,
    cta: { text: "Open triage", href: "https://collab47.com/feedback" },
  });

  await sendEmail({
    to,
    subject: `[Collab47] New ${f.kind}: ${f.subject.slice(0, 60)}`,
    html,
  });
}

// Per-role first moves + framing, so the welcome reads like it was written for
// this specific person, not a template blast.
const ROLE_COPY: Record<string, { label: string; moves: string[] }> = {
  student: {
    label: "student",
    moves: [
      "Put up one thing you are building or genuinely curious about.",
      "Follow two people whose work you would want to learn from.",
      "Find a collab project and apply. First-years get picked here too.",
    ],
  },
  researcher: {
    label: "researcher",
    moves: [
      "Share what you are working on, even a rough direction.",
      "Follow the labs and peers closest to your field.",
      "Post a problem you need hands on. The right people find it here.",
    ],
  },
  faculty: {
    label: "faculty member",
    moves: [
      "Post an opening, a project, or a result you are proud of.",
      "Follow students and researchers working near your area.",
      "Start a collab project and pick your team from who applies.",
    ],
  },
  industry: {
    label: "builder",
    moves: [
      "Post what your team is actually trying to solve.",
      "Follow researchers and builders in your domain.",
      "Open a project brief and let strong people apply to it.",
    ],
  },
  institution: {
    label: "team",
    moves: [
      "Introduce your programs and the people behind them.",
      "Follow the faculty and industry partners you want close.",
      "Post the opportunities your students should not miss.",
    ],
  },
};

const DEFAULT_COPY = {
  label: "member",
  moves: [
    "Put up your first post, even something small.",
    "Follow a few people in your field.",
    "Start or join a collab project.",
  ],
};

/** Welcome email sent once, when a member finishes onboarding. Personalised by
 *  name and account type. Fire-and-forget. */
export async function sendWelcomeEmail(
  to: string | null | undefined,
  name: string,
  accountType?: string | null,
): Promise<void> {
  if (!to) return;
  const first = escapeHtml((name || "").split(" ")[0] || "there");
  const role = ROLE_COPY[(accountType ?? "").toLowerCase()] ?? DEFAULT_COPY;

  const moves = role.moves
    .map((m) => `<li style="margin-bottom:8px">${escapeHtml(m)}</li>`)
    .join("");

  const html = emailShell({
    title: `You are in, ${first}.`,
    intro:
      "I am Shaurya, one of the people building Collab47. The short reason it exists: too much good work in India stays hidden. The student never meets the lab, the founder never meets the researcher. We are fixing that.",
    bodyHtml: `<p style="margin:0 0 10px;color:#0A0F1C;font-weight:600">Three ways to start as a ${escapeHtml(role.label)}:</p>
      <ul style="margin:0 0 18px;padding-left:18px;color:#42506B">${moves}</ul>
      <p style="margin:0">Post something today, even something small. The network only gets good when people like you actually show up.</p>
      <p style="margin:16px 0 0;color:#42506B">See you inside,<br>Shaurya</p>`,
    cta: { text: "Open Collab47", href: "https://collab47.com/home" },
    footerNote:
      "You are getting this because you just created a Collab47 account. Collab47, India's academia-industry collaboration network.",
  });
  await sendEmail({ to, subject: `Welcome to Collab47, ${(name || "").split(" ")[0] || "friend"}`, html });
}
