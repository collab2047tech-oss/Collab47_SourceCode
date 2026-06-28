"use server";

import { searchAll, followUser, unfollowUser } from "@/lib/db/social";

/** Top-bar dropdown + explore typeahead: few rows per group, ranked. */
export async function searchAction(query: string) {
  return searchAll(query, { compact: true });
}

/** Full /explore?q= results page: more rows per group. */
export async function searchAllAction(query: string) {
  return searchAll(query);
}

// Optimistic follow/unfollow for the discovery surfaces. Deliberately does NOT
// revalidatePath("/explore") - that would refetch the whole tree on every
// click (the lag source). The client holds optimistic state and reconciles on
// the next natural navigation.
export async function followFromExploreAction(targetUserId: string) {
  return followUser(targetUserId);
}

export async function unfollowFromExploreAction(targetUserId: string) {
  return unfollowUser(targetUserId);
}
