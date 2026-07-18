// Branded, self-contained HTML shell for Collab47 emails. Inline styles only
// (email clients strip <style>/external CSS). Palette matches the app: cobalt
// #B95402, ink #12100E, cream #FBF8F4.

export interface EmailShellOpts {
  title: string;
  intro?: string;
  /** Trusted HTML for the body region (escape any user content before passing). */
  bodyHtml?: string;
  cta?: { text: string; href: string };
  footerNote?: string;
}

export function emailShell(o: EmailShellOpts): string {
  const cta = o.cta
    ? `<div style="margin-top:22px"><a href="${o.cta.href}" style="display:inline-block;background:#B95402;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">${o.cta.text}</a></div>`
    : "";
  const intro = o.intro
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#42506B">${o.intro}</p>`
    : "";
  const body = o.bodyHtml
    ? `<div style="font-size:15px;line-height:1.6;color:#42506B">${o.bodyHtml}</div>`
    : "";
  const footer = o.footerNote ?? "Collab47, India's academia-industry collaboration network.";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#FBF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#12100E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F4;padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E6E9F0;border-radius:16px;overflow:hidden">
      <tr><td style="padding:22px 28px;border-bottom:1px solid #EEF1F6">
        <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#12100E">Collab<span style="color:#B95402">47</span></span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.25;color:#12100E">${o.title}</h1>
        ${intro}
        ${body}
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #EEF1F6;font-size:12px;line-height:1.5;color:#8A93A6">${footer}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
