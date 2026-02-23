"""
Certificate PDF Generator - matches website card design
Uses canvas drawing to avoid nested table issues
"""

import io
import qrcode
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import os

_font_path = os.path.join(os.path.dirname(__file__), 'LeagueSpartan-Bold.ttf')
if os.path.exists(_font_path):
    pdfmetrics.registerFont(TTFont('LeagueSpartan', _font_path))
    LS = 'LeagueSpartan'
else:
    LS = 'Helvetica-Bold'

NAVY  = (15/255, 16/255, 33/255)
GREEN = (0/255, 160/255, 80/255)
GRAY  = (0.5, 0.5, 0.5)
LGRAY = (0.93, 0.93, 0.93)

def rgb(t): return colors.Color(*t)

def generate_certificate_pdf(
    certificate_number: str,
    system_name: str,
    organization: str,
    odd_description: str,
    issue_date: datetime,
    expiry_date: datetime = None,
    pass_rate: float = 100.0,
    total_actions: int = 0,
) -> bytes:
    if expiry_date is None:
        expiry_date = issue_date + timedelta(days=365)

    buf = io.BytesIO()
    W, H = letter
    c = canvas.Canvas(buf, pagesize=letter)

    margin = 0.75 * inch
    cw = W - 2 * margin  # content width

    # ── Card border ──
    c.setStrokeColor(rgb(LGRAY))
    c.setLineWidth(1)
    c.roundRect(margin, margin, cw, H - 2*margin, 8, stroke=1, fill=0)

    y = H - margin - 0.35*inch

    # ── ODDC CONFORMANCE CERTIFICATE label ──
    c.setFont(LS, 7)
    c.setFillColor(rgb(GRAY))
    c.drawString(margin + 0.25*inch, y, "ODDC CONFORMANCE CERTIFICATE")

    # ── CONFORMANT badge (top right) ──
    bx = margin + cw - 1.3*inch
    by = y - 0.08*inch
    c.setStrokeColor(rgb(GREEN))
    c.setLineWidth(1.2)
    c.roundRect(bx, by - 0.25*inch, 1.1*inch, 0.45*inch, 4, stroke=1, fill=0)
    c.setFont(LS, 9)
    c.setFillColor(rgb(GREEN))
    c.drawCentredString(bx + 0.55*inch, by + 0.05*inch, "CONFORMANT")
    c.setFont('Helvetica', 6)
    c.drawCentredString(bx + 0.55*inch, by - 0.12*inch, "ODDC v1.0")

    y -= 0.55*inch

    # ── Title ──
    c.setFont('Times-BoldItalic', 22)
    c.setFillColor(rgb(NAVY))
    c.drawCentredString(W/2, y, "Certificate of Conformance")
    y -= 0.35*inch

    # ── Cert number row (gray bg) ──
    c.setFillColor(rgb(LGRAY))
    c.rect(margin, y - 0.15*inch, cw, 0.38*inch, fill=1, stroke=0)
    c.setFont(LS, 7)
    c.setFillColor(rgb(GRAY))
    c.drawString(margin + 0.25*inch, y + 0.12*inch, "CERT")
    c.setFont(LS, 13)
    c.setFillColor(rgb(NAVY))
    c.drawString(margin + 0.7*inch, y + 0.1*inch, certificate_number)
    y -= 0.55*inch

    # ── Left accent bar + org/system ──
    c.setFillColor(rgb(NAVY))
    c.rect(margin, y - 0.25*inch, 3, 0.55*inch, fill=1, stroke=0)
    c.setFont(LS, 12)
    c.setFillColor(rgb(NAVY))
    c.drawString(margin + 0.18*inch, y + 0.08*inch, organization)
    c.setFont('Helvetica', 9)
    c.setFillColor(rgb(GRAY))
    c.drawString(margin + 0.18*inch, y - 0.12*inch, system_name)
    y -= 0.6*inch

    # ── Issued / Expires / Status ──
    col_w = cw / 3
    for i, (label, val, color) in enumerate([
        ("ISSUED",  issue_date.strftime("%d %b %Y"),  NAVY),
        ("EXPIRES", expiry_date.strftime("%d %b %Y"), NAVY),
        ("STATUS",  "PASS",                           GREEN),
    ]):
        x = margin + i * col_w
        c.setFont(LS, 7)
        c.setFillColor(rgb(GRAY))
        c.drawString(x + 0.1*inch, y + 0.05*inch, label)
        c.setFont(LS, 11)
        c.setFillColor(rgb(color))
        c.drawString(x + 0.1*inch, y - 0.15*inch, val)
    y -= 0.55*inch

    # ── ODD description box ──
    c.setFillColor(rgb(LGRAY))
    odd_h = 0.55*inch
    c.rect(margin, y - odd_h + 0.2*inch, cw, odd_h, fill=1, stroke=0)
    c.setFont('Courier', 9)
    c.setFillColor(rgb(GRAY))
    # word wrap
    words = odd_description.split()
    line, lines = [], []
    for w in words:
        test = ' '.join(line + [w])
        if c.stringWidth(test, 'Courier', 9) < cw - 0.5*inch:
            line.append(w)
        else:
            lines.append(' '.join(line))
            line = [w]
    if line: lines.append(' '.join(line))
    for j, l in enumerate(lines[:2]):
        c.drawString(margin + 0.2*inch, y - j*0.15*inch, l)
    y -= odd_h + 0.3*inch

    # ── Footer: SENTINEL AUTHORITY | hash ──
    cert_hash = certificate_number.replace('ODDC-','').replace('-','') + '...a4f9'
    c.setFont(LS, 8)
    c.setFillColor(rgb(GRAY))
    c.drawString(margin + 0.25*inch, y, "SENTINEL AUTHORITY")
    c.drawRightString(margin + cw - 0.25*inch, y, cert_hash)
    y -= 0.45*inch

    # ── QR code ──
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(f"https://sentinelauthority.org/verify?cert={certificate_number}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#0f1021", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format='PNG')
    qr_buf.seek(0)
    qr_size = 0.9*inch
    c.drawImage(ImageReader(qr_buf), margin + 0.25*inch, y - qr_size, width=qr_size, height=qr_size)
    c.setFont('Helvetica', 8)
    c.setFillColor(rgb(NAVY))
    c.drawString(margin + 0.25*inch + qr_size + 0.15*inch, y - 0.2*inch,
                 "Verify at sentinelauthority.org/verify")
    c.setFont('Helvetica', 7)
    c.setFillColor(rgb(GRAY))
    c.drawString(margin + 0.25*inch + qr_size + 0.15*inch, y - 0.38*inch,
                 "Valid while ENVELO enforcement and telemetry remain active.")

    c.save()
    return buf.getvalue()
