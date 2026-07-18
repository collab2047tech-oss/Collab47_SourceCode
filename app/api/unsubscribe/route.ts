/**
 * One-click unsubscribe from the weekly digest. GET /api/unsubscribe?u=<id>&t=<token>
 * The token is a stateless HMAC of the user id, so no session is needed.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifyUnsub } from "@/lib/email/token";

export const dynamic = "force-dynamic";

function page(message: string): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collab47</title></head>
<body style="margin:0;background:#FBF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12100E">
<div style="max-width:460px;margin:12vh auto;background:#fff;border:1px solid #E6E9F0;border-radius:16px;padding:32px;text-align:center">
  <div style="font-size:18px;font-weight:800;margin-bottom:16px">Collab<span style="color:#B95402">47</span></div>
  <p style="font-size:15px;line-height:1.6;color:#42506B;margin:0 0 20px">${message}</p>
  <a href="https://collab47.com" style="display:inline-block;background:#B95402;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:10px">Go to Collab47</a>
</div></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!u || !verifyUnsub(u, t)) {
    return page("This unsubscribe link is invalid or has expired.");
  }
  const admin = getAdminClient();
  if (admin) {
    await admin.from("profiles").update({ digest_opt_out: true }).eq("id", u);
  }
  return page("You are unsubscribed. You will no longer receive the weekly Collab47 digest.");
}
