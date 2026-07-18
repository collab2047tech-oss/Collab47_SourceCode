import { PostModal } from "@/components/composite/PostModal";
import { PostDetail, loadPostDetail } from "@/components/composite/PostDetail";

/**
 * Intercepting route. Any client-side navigation to /p/[short_id] from INSIDE
 * the (app) group (feed card click, comment link, repost link, share preview...)
 * is caught here and rendered as an overlay on top of the still-mounted feed,
 * instead of tearing down the app shell. A hard navigation / external share hits
 * the real full page at app/p/[short_id] (outside this group) for SEO.
 *
 * Same data (loadPostDetail) + same component (PostDetail) as the full page.
 */
export default async function InterceptedPostModal({
  params,
}: {
  params: Promise<{ short_id: string }>;
}) {
  const { short_id } = await params;
  const data = await loadPostDetail(short_id);

  if (!data) {
    return (
      <PostModal>
        <div className="p-10 text-center text-sm text-ash">This post is no longer available.</div>
      </PostModal>
    );
  }

  return (
    <PostModal>
      <PostDetail data={data} layout="modal" />
    </PostModal>
  );
}
