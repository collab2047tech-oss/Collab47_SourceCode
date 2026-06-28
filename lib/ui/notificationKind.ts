import {
  Heart,
  MessageCircle,
  MessageSquare,
  CornerDownRight,
  UserPlus,
  UserCheck,
  Briefcase,
  Bell,
  AtSign,
  Repeat2,
  Bookmark,
  Mail,
} from "lucide-react";

/**
 * Per-kind icon for a notification row. Shared by the server page and the
 * client list so the two never diverge. Unknown kinds fall back to Bell.
 */
export const KIND_ICON: Record<string, React.ElementType> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
  comment_reply: CornerDownRight,
  repost: Repeat2,
  bookmark: Bookmark,
  mention: AtSign,
  connection_request: UserCheck,
  dm: Mail,
  dm_request: MessageSquare,
  project_invite: Briefcase,
  project_accepted: Briefcase,
  system: Bell,
};

export function iconForKind(kind: string): React.ElementType {
  return KIND_ICON[kind] ?? Bell;
}
