"use server";

import { searchAll } from "@/lib/db/social";

export async function searchAction(query: string) {
  return searchAll(query);
}
