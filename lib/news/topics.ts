/**
 * Reader-facing news topics.
 *
 * Internal `branch_tags` (CSE / ECE / MBA / ...) are a routing/matching detail
 * and must NEVER render in the UI. This module maps those internal codes - plus
 * a few keyword rules - into a small, human-readable topic vocabulary that the
 * cards and reader actually show (Tech / Business / Careers / ...), exactly like
 * Apple News / Google News reader-facing categories.
 */

export const TOPICS = [
  "Tech",
  "Business",
  "Careers",
  "Science",
  "Design",
  "Engineering",
  "Policy",
  "Campus",
] as const;

export type Topic = (typeof TOPICS)[number];

// Internal branch code -> the reader topics it implies.
const BRANCH_TO_TOPICS: Record<string, Topic[]> = {
  CSE: ["Tech"],
  ECE: ["Tech", "Engineering"],
  Electrical: ["Engineering"],
  Mechanical: ["Engineering"],
  Civil: ["Engineering"],
  MBA: ["Business"],
  BBA: ["Business"],
  Design: ["Design"],
  Biotech: ["Science"],
};

// Lowercased keyword -> topic, scanned over title + summary. These add the
// reader-facing topics that branch codes don't capture (careers, campus,
// policy, science).
const KEYWORD_TO_TOPIC: Array<[RegExp, Topic]> = [
  [/\b(placement|placements|internship|intern|hiring|recruit|recruitment|job|jobs|salary|offer letter|campus drive|layoff|layoffs)\b/, "Careers"],
  [/\b(exam|admission|admissions|scholarship|university|college|iit|nit|iim|iiser|jee|neet|gate|cuet|semester|student|students)\b/, "Campus"],
  [/\b(government|ministry|policy|parliament|regulation|regulator|supreme court|election|budget|law|bill|sebi|rbi)\b/, "Policy"],
  [/\b(research|study|scientists|space|isro|nasa|climate|physics|chemistry|biology|genome|vaccine)\b/, "Science"],
  [/\b(startup|startups|funding|ipo|stocks|market|economy|revenue|valuation|acquisition|fintech)\b/, "Business"],
  [/\b(ai|artificial intelligence|software|app|chip|semiconductor|cloud|cybersecurity|gadget|smartphone|google|apple|microsoft|openai)\b/, "Tech"],
];

/**
 * Map internal branch tags + free text into a small, ordered set of
 * reader-facing topics. Order = priority (branch-implied first, then keyword).
 * Always returns at least one topic so every card can show a clean label.
 */
export function branchToTopics(
  branchTags: string[],
  title = "",
  summary = ""
): string[] {
  const out: string[] = [];
  const push = (t: Topic) => {
    if (!out.includes(t)) out.push(t);
  };

  for (const b of branchTags) {
    for (const t of BRANCH_TO_TOPICS[b] ?? []) push(t);
  }

  const hay = `${title} ${summary}`.toLowerCase();
  for (const [re, topic] of KEYWORD_TO_TOPIC) {
    if (re.test(hay)) push(topic);
  }

  // Honest default: a general headline with no signal is "News" -> we surface
  // the broadest real topic rather than an internal code or an empty chip.
  if (out.length === 0) push("Business");

  return out;
}
