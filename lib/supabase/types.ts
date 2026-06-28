/**
 * Database types. Hand-written for v0.1.
 * After first Supabase migration runs, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
 */

export type DMPermission = "everyone" | "connections" | "nobody";
export type AccountType = "student" | "researcher" | "faculty" | "institution" | "industry";
export type ReportCategory = "spam" | "hate" | "sexual" | "other";
export type ConversationType = "one_to_one" | "group";
export type ProjectStatus = "open" | "team_formed" | "in_progress" | "delivered" | "closed";
export interface ProfileLinks {
  website?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

export type NotificationKind =
  | "follow"
  | "like"
  | "comment"
  | "repost"
  | "mention"
  | "dm"
  | "dm_request"
  | "project_invite"
  | "project_accepted"
  | "system";

export interface Profile {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  /** Chosen built-in banner preset id (null when an uploaded cover is used). */
  banner_preset: string | null;
  /** Uploaded-cover focal point, 0..100 (% from left / top). Default 50/50. */
  cover_focal_x: number;
  cover_focal_y: number;
  college: string | null;
  branch: string | null;
  year_of_study: string | null;
  city: string | null;
  birthdate: string | null;
  interests: string[];
  account_type: AccountType | null;
  organization: string | null;
  cluster_id: number | null;
  verified: boolean;
  suspended_at: string | null;
  deleted_at: string | null;
  dm_permission: DMPermission;
  onboarded: boolean;
  feed_prefs: Record<string, unknown> | null;
  privacy: Record<string, boolean> | null;
  notification_prefs: Record<string, { email: boolean; push: boolean }> | null;
  links: ProfileLinks | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  short_id: string;
  author_id: string;
  body: string;
  image_urls: string[];
  video_url: string | null;
  hashtags: string[];
  branch_tags: string[];
  city_tags: string[];
  is_pinned: boolean;
  is_repost: boolean;
  reposted_from_post_id: string | null;
  is_highlight: boolean;
  expires_at: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  bookmark_count: number;
  impressions: number;
  deleted_at: string | null;
  created_at: string;
  /** Optional link to a project for progress posts. */
  project_id: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Connection {
  user_a_id: string;
  user_b_id: string;
  status: "pending" | "accepted";
  created_at: string;
  accepted_at: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  project_id: string | null;
  /** Human-readable title for group conversations; null for 1:1. */
  title: string | null;
  created_at: string;
  last_message_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  muted: boolean;
  last_read_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  is_request: boolean;
  read_at: string | null;
  created_at: string;
  /** Client-generated id used to reconcile optimistic-send temp bubbles. */
  client_id: string | null;
}

export interface Project {
  id: string;
  short_id: string;
  author_id: string;
  title: string;
  brief: string;
  deliverable: string;
  deadline: string;
  slot_count: number;
  status: ProjectStatus;
  delivered_at: string | null;
  deliverable_url: string | null;
  created_at: string;
}

export interface ProjectApplication {
  id: string;
  project_id: string;
  applicant_id: string;
  pitch: string;
  links: string[];
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type NewsSummaryStatus = "ai" | "headline" | "raw" | "none";

export interface NewsItem {
  id: string;
  source: string;
  url: string;
  title: string;
  /** Raw publisher blurb, kept for provenance. The UI reads `summary`. */
  excerpt: string | null;
  /** Guaranteed-real summary (AI or honest fallback). Read this in the UI. */
  summary: string | null;
  /** How the summary was produced - lets the UI promise a real brief. */
  summary_status: NewsSummaryStatus;
  /** Reader-facing categories (Tech / Business / Careers / ...). Renderable. */
  topics: string[];
  lang: string;
  image_url: string | null;
  /** Internal taxonomy for MATCHING only. Never render as a chip. */
  branch_tags: string[];
  city_tags: string[];
  published_at: string;
  fetched_at: string;
  like_count: number;
  dislike_count: number;
  comment_count: number;
}
