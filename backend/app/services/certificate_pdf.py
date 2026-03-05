"""ODDC Certificate PDF Generator — Sentinel Authority v10 design"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader, simpleSplit
from io import BytesIO
from datetime import datetime
import qrcode

INK     = Color(0.059, 0.063, 0.129)
INDIGO  = Color(0.165, 0.145, 0.376)
DK      = Color(0.114, 0.102, 0.231)
FILL    = Color(0.949, 0.945, 0.965)
BORDER  = Color(0.831, 0.824, 0.871)
GREEN   = Color(0.086, 0.529, 0.243)
DIM     = Color(0.541, 0.565, 0.612)
WHITE   = Color(1, 1, 1)
WHITE55 = Color(1, 1, 1, 0.55)
WHITE20 = Color(1, 1, 1, 0.20)

W, H, M = 612, 792, 40

def _make_qr(url):
    qr = qrcode.QRCode(box_size=3, border=1,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(url); qr.make(fit=True)
    img = qr.make_image(fill_color='#0f1021', back_color='white')
    buf = BytesIO(); img.save(buf, 'PNG'); buf.seek(0)
    return buf

def _field(c, x, y, w, h, label, value, bold=False, vcol=None, mono=False):
    c.setFillColor(FILL); c.setStrokeColor(BORDER); c.setLineWidth(0.5)
    c.roundRect(x, y, w, h, 3, fill=1, stroke=1)
    c.setFont('Helvetica', 7); c.setFillColor(DIM)
    c.drawString(x+10, y+h-13, label.upper())
    fn = ('Courier-Bold' if mono else 'Helvetica-Bold') if bold else \
         ('Courier' if mono else 'Helvetica')
    c.setFont(fn, 10.5)
    c.setFillColor(vcol if vcol else INK)
    c.drawString(x+10, y+12, value)

def generate_certificate_pdf(
    certificate_id,
    organization_name,
    system_name,
    odd_specification,
    issued_date,
    expiry_date,
    test_id=None,
    convergence_score=None,
    stability_index=None,
    drift_rate=None,
    evidence_hash=None
):
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    # ── HEADER ──
    HH = 110
    c.setFillColor(WHITE)
    c.rect(0, H-HH, W, HH, fill=1, stroke=0)
    c.setStrokeColor(BORDER); c.setLineWidth(1)
    c.line(0, H-HH, W, H-HH)

    # SA Seal
    sx, sy = M+40, H-HH/2
    c.setStrokeColor(WHITE); c.setLineWidth(3.4)
    c.circle(sx, sy, 32, fill=0, stroke=1)
    c.setStrokeColor(WHITE20); c.setLineWidth(1.1)
    c.circle(sx, sy, 27, fill=0, stroke=1)
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 18)
    c.drawCentredString(sx, sy-7, 'SA')

    # Cert number — top right
    c.setFillColor(WHITE55); c.setFont('Helvetica', 6.5)
    c.drawRightString(W-M, H-16, 'CERTIFICATE NUMBER')
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 9)
    c.drawRightString(W-M, H-30, certificate_id)

    # CONFORMANT badge — bottom right of header
    BW, BH = 120, 36
    BX = W-M-BW; BY = H-HH+12
    c.setFillColor(Color(1,1,1,0.08))
    c.setStrokeColor(GREEN); c.setLineWidth(1.5)
    c.roundRect(BX, BY, BW, BH, 3, fill=1, stroke=1)
    c.setFillColor(GREEN); c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(BX+BW/2, BY+BH-14, 'CONFORMANT')
    c.setFillColor(WHITE55); c.setFont('Helvetica', 7)
    c.drawCentredString(BX+BW/2, BY+7, 'ODDC v1.0')

    # ── LAYOUT ENGINE ──
    FOOT_Y = 52
    TOP_Y  = H - HH - 18
    AVAIL  = TOP_Y - FOOT_Y

    issued_str = issued_date.strftime('%Y-%m-%d') if hasattr(issued_date, 'strftime') else str(issued_date)
    expiry_str = expiry_date.strftime('%Y-%m-%d') if hasattr(expiry_date, 'strftime') else str(expiry_date)

    TITLE_H = 36
    BAND_H  = 72
    ATT_H   = 76
    ORG_H   = 72
    DAT_H   = 72
    ODD_H   = 90
    QR_H    = 90
    BLOCKS  = [TITLE_H, BAND_H, ATT_H, ORG_H, DAT_H, ODD_H, QR_H]
    GAP     = (AVAIL - sum(BLOCKS)) / (len(BLOCKS) + 1)

    positions = []
    y = TOP_Y - GAP
    for bh in BLOCKS:
        y -= bh
        positions.append(y)
        y -= GAP

    G = 7

    # Title
    ty = positions[0]
    c.setFillColor(INK); c.setFont('Helvetica-Bold', 13)
    c.drawString(M, ty+TITLE_H-13, 'OPERATIONAL DESIGN DOMAIN CONFORMANCE CERTIFICATE')
    c.setStrokeColor(BORDER); c.setLineWidth(0.75)
    c.line(M, ty+2, W-M, ty+2)

    # Metadata
    y0 = positions[1]; CW4 = (W-2*M-G*3)/4
    _field(c, M,            y0, CW4, BAND_H, 'Certificate No.', certificate_id,       bold=True, mono=True)
    _field(c, M+CW4+G,      y0, CW4, BAND_H, 'System ID',       test_id or 'N/A',     bold=True, mono=True)
    _field(c, M+CW4*2+G*2,  y0, CW4, BAND_H, 'Issued By',       'Sentinel Authority')
    _field(c, M+CW4*3+G*3,  y0, CW4, BAND_H, 'Standard',        'ODDC v1.0')

    # Attestation
    y1 = positions[2]
    attest = (f'Sentinel Authority, acting as an independent ODDC Conformance Assessment Body, hereby attests '
              f'that the autonomous system identified herein has satisfied all requirements of the ODDC standard, '
              f'including successful completion of the CAT-72 Conformance Assessment Test and ENVELO Interlock verification.')
    c.setFont('Helvetica', 9.5)
    att_lines = simpleSplit(attest, 'Helvetica', 9.5, W-2*M)
    lh = 15
    start_y = y1 + ATT_H - (ATT_H - len(att_lines)*lh)/2 - lh
    for i, ln in enumerate(att_lines):
        c.setFillColor(DIM); c.drawString(M, start_y-i*lh, ln)

    # Org + System
    y2 = positions[3]; CW2 = (W-2*M-G)/2
    _field(c, M,       y2, CW2, ORG_H, 'Organization', organization_name, bold=True)
    _field(c, M+CW2+G, y2, CW2, ORG_H, 'System Name',  system_name,       bold=True)

    # Dates + Status
    y3 = positions[4]; CW3 = (W-2*M-G*2)/3
    _field(c, M,            y3, CW3, DAT_H, 'Date Issued', issued_str)
    _field(c, M+CW3+G,      y3, CW3, DAT_H, 'Expiry Date', expiry_str)
    _field(c, M+CW3*2+G*2,  y3, CW3, DAT_H, 'Status',      'CONFORMANT', bold=True, vcol=GREEN)

    # ODD
    y4 = positions[5]
    odd_txt = str(odd_specification)[:300]
    c.setFillColor(FILL); c.setStrokeColor(BORDER); c.setLineWidth(0.5)
    c.roundRect(M, y4, W-2*M, ODD_H, 3, fill=1, stroke=1)
    c.setFillColor(INDIGO); c.rect(M, y4, 4, ODD_H, fill=1, stroke=0)
    c.setFont('Helvetica', 7); c.setFillColor(DIM)
    c.drawString(M+13, y4+ODD_H-13, 'OPERATIONAL DESIGN DOMAIN')
    c.setFont('Helvetica', 9.5)
    for i, ln in enumerate(simpleSplit(odd_txt, 'Helvetica', 9.5, W-2*M-26)):
        c.setFillColor(INK); c.drawString(M+13, y4+ODD_H-30-i*15, ln)

    # QR + Verify
    y5 = positions[6]
    verify_url = f'https://www.sentinelauthority.org/verify?cert={certificate_id}'
    qr_buf = _make_qr(verify_url)
    QS = 72
    c.drawImage(ImageReader(qr_buf), M, y5+(QR_H-QS)//2, QS, QS)
    tx = M+QS+16
    c.setFillColor(INK); c.setFont('Helvetica-Bold', 9)
    c.drawString(tx, y5+QR_H-18, 'VERIFY CERTIFICATE')
    c.setFillColor(INDIGO); c.setFont('Helvetica', 8.5)
    c.drawString(tx, y5+QR_H-34, verify_url)
    c.setFillColor(DIM); c.setFont('Helvetica', 8.5)
    c.drawString(tx, y5+QR_H-50, 'Scan or visit URL to verify current conformance status in the public registry.')

    # ── FOOTER ──
    c.setStrokeColor(BORDER); c.setLineWidth(0.5)
    c.line(M, 44, W-M, 44)
    c.setFillColor(DIM); c.setFont('Helvetica', 7)
    c.drawString(M, 30, 'Valid while ENVELO Interlock and telemetry remain active. Certificate subject to continuous conformance surveillance. Issued by Sentinel Authority.')
    c.drawRightString(W-M, 30, f'Generated {datetime.now().strftime("%Y-%m-%d")}')

    c.save()
    buf.seek(0)
    return buf.getvalue()
