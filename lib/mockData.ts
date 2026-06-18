import type { Post } from "@/components/composite/PostCard";

export const mockPosts: Post[] = [
  {
    id: "p1",
    author: { name: "Riya Sharma", handle: "riya", college: "Thapar TIET" },
    time: "2h",
    body: "Shipped my first AI-powered study planner for Hindi-medium engineering students. 240 active users in the first week. Looking for designers to collaborate on the v2.",
    tags: ["AI", "Hindi", "Education"],
    stats: { likes: 142, comments: 23, saves: 41 },
  },
  {
    id: "p2",
    author: { name: "Arjun Mehta", handle: "arjun", college: "Punjabi University" },
    time: "5h",
    body: "Just placed 1st at the GNDU hackathon with a real-time crop-disease detector built for Punjab farmers. Open-sourcing the weights this weekend.",
    tags: ["Hackathon", "AgriTech"],
    stats: { likes: 318, comments: 47, saves: 89 },
  },
  {
    id: "p3",
    author: { name: "Vikram Singh", handle: "viks", college: "DAV Amritsar" },
    time: "8h",
    body: "Got rejected by 47 internships. Built my own SaaS this week instead. Took 9 days. Already have 12 paying users. The platform is broken, build your own door.",
    tags: ["Founder", "SaaS"],
    stats: { likes: 1241, comments: 89, saves: 234 },
  },
  {
    id: "p4",
    author: { name: "Sunita Mehta", handle: "sunita", college: "Khalsa College" },
    time: "1d",
    body: "Career-Impact alert. The new IT export incentives announced today affect every CSE final-year student in Tier-2 cities. Reading the bill so you don't have to.",
    tags: ["News", "Policy", "CSE"],
    stats: { likes: 89, comments: 12, saves: 56 },
  },
];

export const mockPeople = [
  { name: "Riya Sharma", handle: "riya", role: "CSE '26", college: "Thapar TIET" },
  { name: "Arjun Mehta", handle: "arjun", role: "ECE '25", college: "Punjabi Univ" },
  { name: "Vikram Singh", handle: "viks", role: "Mech '27", college: "DAV Amritsar" },
  { name: "Sunita Mehta", handle: "sunita", role: "MBA '26", college: "Khalsa College" },
  { name: "Karthik Iyer", handle: "kart", role: "Design '25", college: "NID Ahmedabad" },
  { name: "Priya Joshi", handle: "priya", role: "CSE '26", college: "IIT Ropar" },
  { name: "Aman Verma", handle: "aman", role: "Civil '25", college: "Chitkara" },
  { name: "Ishita Roy", handle: "ishita", role: "BBA '27", college: "LPU" },
  { name: "Rohan Patel", handle: "rohan", role: "AI/ML '26", college: "PEC Chandigarh" },
];

export const mockMessages = [
  { id: "m1", name: "Riya Sharma", last: "yo are you free for the hackathon?", time: "2m", unread: true },
  { id: "m2", name: "Arjun Mehta", last: "sent you the brief on Telegram", time: "1h", unread: false },
  { id: "m3", name: "Project Aurora", last: "Karthik: pushed the new designs", time: "3h", unread: true },
  { id: "m4", name: "Vikram Singh", last: "thanks for the intro!", time: "1d", unread: false },
  { id: "m5", name: "Sunita Mehta", last: "see you at the meetup", time: "2d", unread: false },
];

export const mockTrending = [
  { tag: "FundingWinter2026", count: 412 },
  { tag: "ThaparHackathon", count: 234 },
  { tag: "PunjabStartups", count: 189 },
  { tag: "AIInternships", count: 156 },
  { tag: "GenAIIndia", count: 98 },
];
