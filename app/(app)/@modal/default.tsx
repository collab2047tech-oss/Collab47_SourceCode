// The @modal parallel slot renders nothing by default. It is only filled when a
// post link is intercepted by app/(app)/@modal/(.)p/[short_id]/page.tsx. Without
// this default, every non-intercepted route under (app) would 404 on the slot.
export default function ModalDefault() {
  return null;
}
