"use server";

import {
  followUser, unfollowUser,
  requestConnection, acceptConnection, cancelConnection,
} from "@/lib/db/social";

/**
 * Network mutations. The cards flip their state OPTIMISTICALLY on the client
 * (instant) and call these in the background. We deliberately do NOT call
 * revalidatePath here: a server revalidation refetches the page tree and would
 * clobber the optimistic state mid-interaction (the ~1s "did it work?" lag the
 * founder reported). The server is the source of truth on the next natural
 * navigation; until then the optimistic local state is correct and instant.
 */

export async function followUserAction(targetUserId: string) {
  return followUser(targetUserId);
}

export async function unfollowUserAction(targetUserId: string) {
  return unfollowUser(targetUserId);
}

export async function requestConnectionAction(targetUserId: string) {
  return requestConnection(targetUserId);
}

export async function acceptConnectionAction(otherUserId: string) {
  return acceptConnection(otherUserId);
}

export async function cancelConnectionAction(otherUserId: string) {
  return cancelConnection(otherUserId);
}
