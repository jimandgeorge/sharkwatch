"""Email sending for invites.

Default is a STUB that logs the invite link (so the flow works with no provider). If
RESEND_API_KEY is set, sends a branded HTML email via Resend's HTTP API (httpx — already
a dependency; no Resend SDK needed).
"""
from ..core.config import settings


def _invite_html(inviter: str, org: str, link: str) -> str:
    return f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
  <div style="padding:28px 0;text-align:center;border-bottom:1px solid #f0f0f0">
    <span style="font-weight:600;letter-spacing:.2em;font-size:15px;color:#0F1B2D">EIGG</span>
  </div>
  <div style="padding:32px 24px">
    <h1 style="font-size:20px;font-weight:600;margin:0 0 12px">You've been invited to EIGG</h1>
    <p style="font-size:14px;line-height:1.6;color:#52525b;margin:0 0 24px">
      {inviter} has set up an EIGG workspace for <strong>{org}</strong>.
      Click below to set your password and get started.
    </p>
    <a href="{link}" style="display:inline-block;background:#0F1B2D;color:#fff;text-decoration:none;
      font-size:14px;font-weight:500;padding:12px 22px;border-radius:8px">Accept invitation</a>
    <p style="font-size:12px;color:#a1a1aa;margin:24px 0 0">This link expires in 72 hours.</p>
  </div>
  <div style="padding:18px 24px;border-top:1px solid #f0f0f0;font-size:11px;color:#a1a1aa;text-align:center">
    EIGG · eigg.io · If you weren't expecting this email, ignore it.
  </div>
</div>"""


async def send_invite(*, to: str, inviter: str, org: str, link: str) -> dict:
    subject = "You've been invited to EIGG"
    if not settings.resend_api_key:
        print(f"[email stub] invite -> {to} | {org} | {link}", flush=True)
        return {"sent": False, "stubbed": True, "link": link}

    import httpx
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject,
                  "html": _invite_html(inviter, org, link)},
        )
        res.raise_for_status()
        return {"sent": True, "stubbed": False, "id": res.json().get("id")}
