"""ODDC Certificate PDF Generator - institutional white background, dict interface"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from io import BytesIO
from datetime import datetime
import qrcode

PURPLE        = HexColor("#1d1a3b")
PURPLE_LIGHT  = HexColor("#4a5568")
ACCENT_GREEN  = HexColor("#16873e")
TEXT_PRIMARY  = HexColor("#1a1a1a")
TEXT_SECONDARY= HexColor("#444444")
TEXT_TERTIARY = HexColor("#888888")
BORDER        = HexColor("#cccccc")
BG_LIGHT      = HexColor("#fafafa")

def _qr(url):
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1d1a3b", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def _fmt(d):
    if d is None: return "N/A"
    if isinstance(d, str):
        try: d = datetime.fromisoformat(d.replace("Z",""))
        except: return d
    return d.strftime("%d %B %Y")

def generate_certificate_pdf(data: dict) -> bytes:
    cert_num   = data.get("certificate_number", "N/A")
    org        = data.get("organization_name", "Unknown Organization")
    system     = data.get("system_name", "Unknown System")
    version    = data.get("system_version", "")
    issued     = _fmt(data.get("issued_at"))
    expires    = _fmt(data.get("expires_at"))
    score      = data.get("convergence_score", 0.95)
    ev_hash    = data.get("evidence_hash", "N/A")
    audit_ref  = data.get("audit_log_ref", "N/A")
    verify_url = data.get("verification_url", "https://app.sentinelauthority.org/verify?cert=" + cert_num)
    odd        = data.get("odd_specification", "")
    if isinstance(odd, dict):
        odd = odd.get("description","") or odd.get("environment_type","") or str(odd)
    odd = str(odd)[:300]

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    w, h = letter

    # White background
    c.setFillColor(white)
    c.rect(0, 0, w, h, fill=True, stroke=False)

    # Left accent bar
    c.setFillColor(PURPLE)
    c.rect(0, 0, 0.18*inch, h, fill=True, stroke=False)

    # Top header band
    c.setFillColor(PURPLE)
    c.rect(0, h - 1.4*inch, w, 1.4*inch, fill=True, stroke=False)

    # Header text
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(0.55*inch, h - 0.62*inch, "SENTINEL AUTHORITY")
    c.setFillColor(HexColor("#8899aa"))
    c.setFont("Helvetica", 8)
    c.drawString(0.55*inch, h - 0.82*inch, "Independent Certification Body for Autonomous Systems")

    c.setFillColor(HexColor("#8899aa"))
    c.setFont("Helvetica", 7)
    c.drawRightString(w - 0.4*inch, h - 0.62*inch, "CERTIFICATE NO.")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(w - 0.4*inch, h - 0.80*inch, cert_num)

    # ODDC badge
    bx, by = w - 1.3*inch, h - 1.30*inch
    c.setFillColor(HexColor("#1d1a3b"))
    c.roundRect(bx, by, 0.9*inch, 0.28*inch, 4, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(bx + 0.45*inch, by + 0.08*inch, "ODDC CERTIFIED")

    # Title
    y = h - 2.0*inch
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(w/2, y, "CONFORMANCE DETERMINATION")
    c.setStrokeColor(PURPLE)
    c.setLineWidth(1.5)
    c.line(0.55*inch, y - 0.15*inch, w - 0.4*inch, y - 0.15*inch)

    y -= 0.5*inch
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 10)
    c.drawCentredString(w/2, y, "This document certifies that the following organization and autonomous system")
    y -= 0.18*inch
    c.drawCentredString(w/2, y, "has demonstrated conformance within the declared Operational Design Domain (ODD).")

    # Org / system box
    y -= 0.5*inch
    c.setFillColor(BG_LIGHT)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.roundRect(0.5*inch, y - 0.65*inch, w - 0.9*inch, 0.85*inch, 6, fill=True, stroke=True)
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 7)
    c.drawString(0.7*inch, y + 0.1*inch, "ORGANIZATION")
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(0.7*inch, y - 0.1*inch, org)
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 7)
    c.drawString(0.7*inch, y - 0.32*inch, "SYSTEM")
    c.setFillColor(PURPLE_LIGHT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(0.7*inch, y - 0.48*inch, system + ("  v" + version if version else ""))

    # Validity + score
    y -= 1.0*inch
    col_w = (w - 0.9*inch) / 3 - 0.1*inch
    for i, (label, val, fg, bg, border_c) in enumerate([
        ("ISSUED",            issued,  TEXT_PRIMARY,  BG_LIGHT,            BORDER),
        ("EXPIRES",           expires, TEXT_PRIMARY,  BG_LIGHT,            BORDER),
        ("CONVERGENCE SCORE", str(round(score*100,1)) + "%" if isinstance(score,float) else str(score),
                                        ACCENT_GREEN, HexColor("#edf7f1"), HexColor("#16873e")),
    ]):
        bx2 = 0.5*inch + i * (col_w + 0.15*inch)
        c.setFillColor(bg)
        c.setStrokeColor(border_c)
        c.roundRect(bx2, y - 0.45*inch, col_w, 0.6*inch, 4, fill=True, stroke=True)
        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 7)
        c.drawString(bx2 + 0.12*inch, y + 0.05*inch, label)
        c.setFillColor(fg)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(bx2 + 0.12*inch, y - 0.20*inch, val)

    # ODD
    y -= 0.75*inch
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(0.55*inch, y, "OPERATIONAL DESIGN DOMAIN (ODD)")
    y -= 0.18*inch
    c.setFillColor(BG_LIGHT)
    c.setStrokeColor(BORDER)
    c.roundRect(0.5*inch, y - 0.65*inch, w - 0.9*inch, 0.75*inch, 4, fill=True, stroke=True)
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica-Oblique", 8)
    words = odd.split()
    lines, cur = [], []
    for word in words:
        cur.append(word)
        if c.stringWidth(" ".join(cur), "Helvetica-Oblique", 8) > w - 1.4*inch:
            cur.pop(); lines.append(" ".join(cur)); cur = [word]
    if cur: lines.append(" ".join(cur))
    ty = y - 0.1*inch
    for line in lines[:4]:
        c.drawString(0.7*inch, ty, line); ty -= 0.14*inch

    # Evidence
    y -= 0.95*inch
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(0.55*inch, y, "CAT-72 AUDIT REFERENCE")
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica", 9)
    c.drawString(0.55*inch, y - 0.18*inch, str(audit_ref))
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(0.55*inch, y - 0.40*inch, "EVIDENCE HASH (SHA-256)")
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 6.5)
    c.drawString(0.55*inch, y - 0.56*inch, str(ev_hash))

    # Conformant stamp
    sx, sy = w - 1.55*inch, y - 0.55*inch
    c.setStrokeColor(ACCENT_GREEN)
    c.setLineWidth(2)
    c.roundRect(sx, sy - 0.1*inch, 1.15*inch, 0.55*inch, 6, fill=False, stroke=True)
    c.setFillColor(ACCENT_GREEN)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(sx + 0.575*inch, sy + 0.10*inch, "CONFORMANT")
    c.setFont("Helvetica", 7)
    c.drawCentredString(sx + 0.575*inch, sy - 0.04*inch, "ODDC v1.0")

    # QR
    try:
        qr_img = _qr(verify_url)
        c.drawImage(ImageReader(qr_img), w - 1.2*inch, 1.0*inch, width=0.75*inch, height=0.75*inch)
        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(w - 1.2*inch + 0.375*inch, 0.88*inch, "SCAN TO VERIFY")
    except Exception:
        pass

    c.setFillColor(PURPLE_LIGHT)
    c.setFont("Helvetica", 7)
    c.drawString(0.55*inch, 1.55*inch, "VERIFY ONLINE:")
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(0.55*inch, 1.40*inch, verify_url)

    # Footer line
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(0.5*inch, 1.1*inch, w - 0.4*inch, 1.1*inch)
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica-Oblique", 6)
    c.drawCentredString(w/2, 0.85*inch, "ODDC attests conformance within declared ODD. Does not attest safety, regulatory compliance, or fitness for purpose beyond stated ODD.")
    c.drawCentredString(w/2, 0.73*inch, "Issued by Sentinel Authority, an independent conformance certification body. Not a government regulator. Not legal advice.")
    c.setFont("Helvetica", 6)
    c.drawString(0.55*inch, 0.58*inch, "© 2026 Sentinel Authority  ·  info@sentinelauthority.org  ·  sentinelauthority.org")
    c.drawRightString(w - 0.4*inch, 0.58*inch, "Generated " + datetime.utcnow().strftime("%Y-%m-%d") + " UTC")

    c.save()
    buffer.seek(0)
    return buffer.getvalue()
