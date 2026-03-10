"""
ODD Compliance Log PDF Generator — Sentinel Authority
Matches the visual language of the certificate PDF.
"""

from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

# ── Palette (matches certificate_pdf.py) ─────────────────────────────────────
INK    = Color(0.059, 0.063, 0.129)   # #0f1021 near-black
INDIGO = Color(0.165, 0.145, 0.376)   # #2a2560
DK     = Color(0.114, 0.102, 0.231)   # #1d1a3b
FILL   = Color(0.949, 0.945, 0.965)   # #f2f1f6 light field
BORDER = Color(0.831, 0.824, 0.871)   # #d4d2de
GREEN  = Color(0.086, 0.529, 0.243)   # #16873e
RED    = Color(0.706, 0.204, 0.204)   # #b43434
AMBER  = Color(0.824, 0.533, 0.102)   # #d28819
DIM    = Color(0.541, 0.565, 0.612)   # #8a909c
WHITE  = Color(1, 1, 1)
GOLD   = Color(0.824, 0.686, 0.200)   # accent

W, H, M = 612, 792, 40
SA_KEY_ID = "sa-compliance-key-1"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _field(c, x, y, w, h, label, value, bold=False, vcol=None, mono=False, small=False):
    c.setFillColor(FILL)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.roundRect(x, y, w, h, 3, fill=1, stroke=1)
    c.setFont("Helvetica", 7)
    c.setFillColor(DIM)
    c.drawString(x + 10, y + h - 13, label.upper())
    fn = ("Courier-Bold" if mono else "Helvetica-Bold") if bold else (
        "Courier" if mono else "Helvetica"
    )
    fs = 9 if small else 10.5
    c.setFont(fn, fs)
    c.setFillColor(vcol if vcol else INK)
    # Wrap long values
    max_chars = int(w / (fs * 0.55))
    if len(str(value)) > max_chars:
        value = str(value)[: max_chars - 3] + "..."
    c.drawString(x + 10, y + 12, str(value))


def _section_header(c, y, title):
    c.setFillColor(DK)
    c.rect(M, y, W - 2 * M, 22, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(WHITE)
    c.drawString(M + 10, y + 7, title.upper())
    return y - 8


def _divider(c, y):
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(M, y, W - M, y)


def _badge(c, x, y, w, h, text, bg_color):
    c.setFillColor(bg_color)
    c.roundRect(x, y, w, h, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(WHITE)
    c.drawCentredString(x + w / 2, y + h / 2 - 4, text)


def _wrap_text(c, text, x, y, max_width, font="Helvetica", size=8, color=None, line_height=12):
    c.setFont(font, size)
    if color:
        c.setFillColor(color)
    lines = simpleSplit(str(text), font, size, max_width)
    for line in lines:
        c.drawString(x, y, line)
        y -= line_height
    return y


# ── Main generator ────────────────────────────────────────────────────────────

def generate_compliance_log_pdf(
    payload: dict,
    signature: str,
    payload_hash: str,
) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle(f"ODD Compliance Log — {payload['certificate']['certificate_number']}")

    cert = payload["certificate"]
    summary = payload["summary"]
    period = payload["reporting_period"]
    violations = payload.get("violations", [])
    odd_spec = payload.get("odd_specification", {})

    # ── Header bar ────────────────────────────────────────────────────────────
    c.setFillColor(DK)
    c.rect(0, H - 60, W, 60, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(WHITE)
    c.drawString(M, H - 35, "SENTINEL AUTHORITY")

    c.setFont("Helvetica", 9)
    c.setFillColor(Color(1, 1, 1, 0.6))
    c.drawString(M, H - 50, "ODD COMPLIANCE LOG  ·  OPERATIONAL DESIGN DOMAIN CONFORMANCE")

    # Document type badge
    _badge(c, W - M - 130, H - 47, 130, 22, "COMPLIANCE LOG", INDIGO)

    # ── Sub-header: cert number + period ─────────────────────────────────────
    c.setFillColor(FILL)
    c.rect(0, H - 90, W, 30, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DK)
    c.drawString(M, H - 79, cert["certificate_number"])
    c.setFont("Helvetica", 9)
    c.setFillColor(DIM)

    def _fmt_date(iso):
        try:
            return datetime.fromisoformat(iso.rstrip("Z")).strftime("%b %d, %Y")
        except Exception:
            return iso or "—"

    period_str = f"Reporting Period: {_fmt_date(period['from'])} – {_fmt_date(period['to'])}"
    c.drawRightString(W - M, H - 79, period_str)

    y = H - 110

    # ── Certificate section ───────────────────────────────────────────────────
    y = _section_header(c, y, "Certificate")
    y -= 6

    fw = (W - 2 * M - 10) / 2
    fh = 44

    _field(c, M, y - fh, fw, fh, "Organization", cert["organization_name"], bold=True)
    _field(c, M + fw + 10, y - fh, fw, fh, "System", cert["system_name"], bold=True)
    y -= fh + 8

    _field(c, M, y - fh, fw, fh, "System Version", cert.get("system_version") or "—")
    _field(c, M + fw + 10, y - fh, fw, fh, "Certificate State",
           cert.get("state", "—").upper(),
           bold=True,
           vcol=GREEN if cert.get("valid_at_generation") else RED)
    y -= fh + 8

    fw3 = (W - 2 * M - 20) / 3
    _field(c, M, y - fh, fw3, fh, "Certificate Number", cert["certificate_number"], mono=True)
    _field(c, M + fw3 + 10, y - fh, fw3, fh, "Issued",
           _fmt_date(cert.get("issued_at", "")))
    _field(c, M + 2 * (fw3 + 10), y - fh, fw3, fh, "Expires",
           _fmt_date(cert.get("expires_at", "")),
           vcol=RED if not cert.get("valid_at_generation") else None)
    y -= fh + 14

    # ── Reporting period ──────────────────────────────────────────────────────
    y = _section_header(c, y, "Reporting Period")
    y -= 6

    _field(c, M, y - fh, fw, fh, "From", _fmt_date(period["from"]))
    _field(c, M + fw + 10, y - fh, fw, fh, "To", _fmt_date(period["to"]))
    y -= fh + 14

    # ── Enforcement summary ───────────────────────────────────────────────────
    y = _section_header(c, y, "Boundary Enforcement Summary")
    y -= 6

    stat_w = (W - 2 * M - 30) / 4
    stat_h = 52

    def _stat(cx, cy, label, value, color=None):
        c.setFillColor(FILL)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(cx, cy - stat_h, stat_w, stat_h, 3, fill=1, stroke=1)
        c.setFont("Helvetica", 7)
        c.setFillColor(DIM)
        c.drawCentredString(cx + stat_w / 2, cy - 16, label.upper())
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(color if color else INK)
        c.drawCentredString(cx + stat_w / 2, cy - stat_h + 14, str(value))

    _stat(M, y, "Total Checks", f"{summary['total_checks']:,}")
    _stat(M + stat_w + 10, y, "Passed", f"{summary['passed']:,}", GREEN)
    _stat(M + 2 * (stat_w + 10), y, "Blocked", f"{summary['blocked']:,}",
          RED if summary["blocked"] > 0 else GREEN)
    _stat(M + 3 * (stat_w + 10), y, "Block Rate",
          f"{summary['block_rate_pct']:.2f}%",
          RED if summary["block_rate_pct"] > 1.0 else GREEN)
    y -= stat_h + 10

    # Sessions + boundaries row
    _field(c, M, y - fh, fw3, fh, "Total Sessions", str(summary["total_sessions"]))
    _field(c, M + fw3 + 10, y - fh, fw3, fh, "Interlock Activations",
           str(summary["interlock_activations"]),
           vcol=RED if summary["interlock_activations"] > 0 else GREEN)
    _field(c, M + 2 * (fw3 + 10), y - fh, fw3, fh, "Interlock Status",
           payload.get("interlock_status", "—").upper().replace("_", " "),
           bold=True,
           vcol=GREEN if "active" in payload.get("interlock_status", "") else AMBER)
    y -= fh + 8

    # Boundaries triggered
    boundaries = summary.get("boundaries_triggered", [])
    boundaries_str = ", ".join(boundaries) if boundaries else "None"
    _field(c, M, y - fh, W - 2 * M, fh, "Boundaries Triggering Blocks",
           boundaries_str, small=True)
    y -= fh + 14

    # ── ODD Specification ─────────────────────────────────────────────────────
    if odd_spec and isinstance(odd_spec, dict):
        y = _section_header(c, y, "Declared Operational Design Domain")
        y -= 6
        for key, val in list(odd_spec.items())[:8]:
            label = key.replace("_", " ").title()
            _field(c, M, y - fh, fw, fh, label, str(val), small=True)
            if list(odd_spec.keys()).index(key) % 2 == 0 and key != list(odd_spec.keys())[-1]:
                pass  # will draw next in pair
            y -= fh + 6 if list(odd_spec.keys()).index(key) % 2 == 1 else 0

        y -= 14

    # ── Violation log (first page, up to 8) ──────────────────────────────────
    if violations:
        y = _section_header(c, y, f"Interlock Activation Log ({len(violations)} events)")
        y -= 6

        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(DIM)
        col_ts = M
        col_boundary = M + 130
        col_msg = M + 260
        c.drawString(col_ts, y, "TIMESTAMP")
        c.drawString(col_boundary, y, "BOUNDARY")
        c.drawString(col_msg, y, "DETAILS")
        y -= 4
        _divider(c, y)
        y -= 10

        for i, v in enumerate(violations[:20]):
            if y < 100:
                break
            ts = v.get("timestamp", "")
            try:
                ts_fmt = datetime.fromisoformat(ts).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                ts_fmt = ts[:19] if ts else "—"

            c.setFont("Courier", 7)
            c.setFillColor(INK)
            c.drawString(col_ts, y, ts_fmt)

            c.setFont("Helvetica", 7)
            c.setFillColor(RED)
            boundary = str(v.get("boundary_name", "—"))[:28]
            c.drawString(col_boundary, y, boundary)

            c.setFillColor(DIM)
            msg = str(v.get("message", ""))[:60]
            c.drawString(col_msg, y, msg)

            y -= 13
            if i < len(violations) - 1:
                c.setStrokeColor(Color(0.9, 0.9, 0.95))
                c.setLineWidth(0.3)
                c.line(M, y + 2, W - M, y + 2)

        if len(violations) > 20:
            c.setFont("Helvetica", 7)
            c.setFillColor(DIM)
            c.drawString(M, y, f"... and {len(violations) - 20} additional events in the full record.")
            y -= 14

        y -= 6

    # ── Signature block ───────────────────────────────────────────────────────
    if y < 160:
        c.showPage()
        y = H - 60

    y = _section_header(c, y, "Digital Signature — Sentinel Authority")
    y -= 6

    sig_short = signature[:48] + "..." if len(signature) > 48 else signature
    hash_short = payload_hash[:56] + "..." if len(payload_hash) > 56 else payload_hash

    _field(c, M, y - fh, W - 2 * M, fh,
           "Ed25519 Signature (base64url)",
           sig_short, mono=True, small=True)
    y -= fh + 8

    _field(c, M, y - fh, W - 2 * M, fh,
           "Payload Hash (SHA-256)",
           hash_short, mono=True, small=True)
    y -= fh + 8

    _field(c, M, y - fh, fw, fh, "Key ID", SA_KEY_ID, mono=True)
    _field(c, M + fw + 10, y - fh, fw, fh, "Generated At",
           _fmt_date(payload["generated_at"]))
    y -= fh + 10

    # Verification instructions
    c.setFillColor(FILL)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.roundRect(M, y - 44, W - 2 * M, 44, 3, fill=1, stroke=1)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(DIM)
    c.drawString(M + 10, y - 14, "INDEPENDENT VERIFICATION")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(INK)
    c.drawString(M + 10, y - 26,
                 "To verify this document independently, download the Sentinel Authority public key from:")
    c.setFont("Courier", 7.5)
    c.setFillColor(INDIGO)
    c.drawString(M + 10, y - 38,
                 "https://www.sentinelauthority.org/sa-compliance-pubkey.txt")
    y -= 56

    # ── Footer ────────────────────────────────────────────────────────────────
    c.setFillColor(DK)
    c.rect(0, 0, W, 32, fill=1, stroke=0)
    c.setFont("Helvetica", 7)
    c.setFillColor(Color(1, 1, 1, 0.5))
    c.drawString(M, 12,
                 "Sentinel Authority  ·  sentinelauthority.org  ·  "
                 "This document verifies boundary enforcement conformance only and does not constitute "
                 "a safety certification or deployment approval.")
    c.drawRightString(W - M, 12, f"Generated {payload['generated_at'][:10]}")

    c.save()
    return buf.getvalue()


SA_KEY_ID = "sa-compliance-key-1"
