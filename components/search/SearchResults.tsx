"use client";

import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Tag } from "@/components/primitives/Tag";
import { relativeTime } from "@/lib/ui/toCardPost";
import { cn } from "@/lib/cn";
import { Briefcase, Hash, TrendingUp } from "lucide-react";
import type { SearchResults } from "@/lib/db/social";

// A flat, ordered list of every result link in render order. The keyboard
// navigation in GlobalSearch indexes into this so Arrow/Enter map to the
// correct destination across all groups.
export interface FlatResult {
  href: string;
  kind: "person" | "post" | "project" | "hashtag";
}

export function flattenResults(r: SearchResults): FlatResult[] {
  const out: FlatResult[] = [];
  for (const p of r.people) out.push({ href: `/u/${p.handle}`, kind: "person" });
  for (const p of r.posts) out.push({ href: `/p/${p.short_id}`, kind: "post" });
  for (const p of r.projects) out.push({ href: `/c/${p.short_id}`, kind: "project" });
  for (const h of r.hashtags) out.push({ href: `/t/${h.tag}`, kind: "hashtag" });
  return out;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  team_formed: "Team formed",
  in_progress: "In progress",
  delivered: "Delivered",
  closed: "Closed",
};

function GroupHeader({ icon, label, count }: { icon?: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-3">
      {icon}
      <span className="text-[11px] font-semibold uppercase tracking-widest text-ash">{label}</span>
      <span className="text-[11px] tabular-nums text-ash">{count}</span>
    </div>
  );
}

// Always-visible active state for keyboard nav (never a faint tint that
// disappears): cobalt-tinted bg + ink text, high contrast on white paper.
const activeCls = "bg-saffron/10";

interface RowProps {
  active?: boolean;
  onActivate?: () => void;
  onHover?: (href: string) => void;
}

export function PersonRow({
  person,
  ...rest
}: RowProps & { person: SearchResults["people"][number] }) {
  const href = `/u/${person.handle}`;
  return (
    <ResultLink href={href} {...rest}>
      <Avatar name={person.name} src={person.avatar_url ?? undefined} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
        <p className="truncate text-xs text-ash">
          @{person.handle}
          {person.college ? ` · ${person.college}` : ""}
        </p>
      </div>
      {person.reason ? (
        <span className="shrink-0 rounded-full bg-saffron/10 px-2 py-0.5 text-[10px] font-semibold text-saffron-dk">
          {person.reason}
        </span>
      ) : null}
    </ResultLink>
  );
}

export function PostRow({ post, ...rest }: RowProps & { post: SearchResults["posts"][number] }) {
  const href = `/p/${post.short_id}`;
  return (
    <ResultLink href={href} {...rest}>
      <Avatar name={post.author.name} src={post.author.avatar_url ?? undefined} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs text-ash">
          <span className="truncate font-medium text-ink">{post.author.name}</span>
          <span className="shrink-0">· {relativeTime(post.created_at)}</span>
        </p>
        <p className="line-clamp-2 text-sm text-ink">{post.body}</p>
      </div>
    </ResultLink>
  );
}

export function ProjectRow({ project, ...rest }: RowProps & { project: SearchResults["projects"][number] }) {
  const href = `/c/${project.short_id}`;
  return (
    <ResultLink href={href} {...rest}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bone text-ink">
        <Briefcase className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{project.title}</p>
        {project.brief ? <p className="truncate text-xs text-ash">{project.brief}</p> : null}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          project.status === "open" ? "bg-moss/10 text-moss" : "bg-bone text-ash"
        )}
      >
        {STATUS_LABEL[project.status] ?? project.status}
      </span>
    </ResultLink>
  );
}

export function HashtagRow({ hashtag, ...rest }: RowProps & { hashtag: SearchResults["hashtags"][number] }) {
  const href = `/t/${hashtag.tag}`;
  return (
    <ResultLink href={href} {...rest}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-saffron/10 text-saffron-dk">
        <Hash className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">#{hashtag.tag}</p>
        <p className="text-xs text-ash tabular-nums">
          {hashtag.use_count} {hashtag.use_count === 1 ? "post" : "posts"}
        </p>
      </div>
    </ResultLink>
  );
}

function ResultLink({
  href,
  active,
  onActivate,
  onHover,
  children,
}: RowProps & { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="option"
      aria-selected={active}
      onClick={onActivate}
      onMouseEnter={() => onHover?.(href)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-cream",
        active && activeCls
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The grouped result list, shared by the top-bar dropdown and the full
 * /explore?q= results view. `activeHref` highlights the keyboard-active row.
 */
export function SearchResultsList({
  results,
  activeHref,
  onActivate,
  onHover,
}: {
  results: SearchResults;
  activeHref?: string | null;
  onActivate?: () => void;
  onHover?: (href: string) => void;
}) {
  const { people, posts, projects, hashtags } = results;
  return (
    <div role="listbox" aria-label="Search results">
      {people.length > 0 && (
        <section>
          <GroupHeader label="People" count={people.length} />
          {people.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              active={activeHref === `/u/${p.handle}`}
              onActivate={onActivate}
              onHover={onHover}
            />
          ))}
        </section>
      )}
      {posts.length > 0 && (
        <section>
          <GroupHeader label="Posts" count={posts.length} />
          {posts.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              active={activeHref === `/p/${p.short_id}`}
              onActivate={onActivate}
              onHover={onHover}
            />
          ))}
        </section>
      )}
      {projects.length > 0 && (
        <section>
          <GroupHeader label="Projects" count={projects.length} />
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              active={activeHref === `/c/${p.short_id}`}
              onActivate={onActivate}
              onHover={onHover}
            />
          ))}
        </section>
      )}
      {hashtags.length > 0 && (
        <section>
          <GroupHeader icon={<TrendingUp className="size-3 text-saffron" />} label="Hashtags" count={hashtags.length} />
          {hashtags.map((h) => (
            <HashtagRow
              key={h.tag}
              hashtag={h}
              active={activeHref === `/t/${h.tag}`}
              onActivate={onActivate}
              onHover={onHover}
            />
          ))}
        </section>
      )}
    </div>
  );
}
