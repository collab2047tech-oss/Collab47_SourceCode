"use server";

import { revalidatePath } from "next/cache";
import {
  followUser, unfollowUser,
  requestConnection, acceptConnection, cancelConnection,
} from "@/lib/db/social";

export async function followUserAction(targetUserId: string) {
  const res = await followUser(targetUserId);
  if (res.ok) revalidatePath("/network");
  return res;
}

export async function unfollowUserAction(targetUserId: string) {
  const res = await unfollowUser(targetUserId);
  if (res.ok) revalidatePath("/network");
  return res;
}

export async function requestConnectionAction(targetUserId: string) {
  const res = await requestConnection(targetUserId);
  if (res.ok) revalidatePath("/network");
  return res;
}

export async function acceptConnectionAction(otherUserId: string) {
  const res = await acceptConnection(otherUserId);
  if (res.ok) revalidatePath("/network");
  return res;
}

export async function cancelConnectionAction(otherUserId: string) {
  const res = await cancelConnection(otherUserId);
  if (res.ok) revalidatePath("/network");
  return res;
}
