"""ODDC Certificate PDF — Dark branded design matching sentinelauthority.org"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, Color
from reportlab.pdfgen import canvas

try:
    import qrcode
    HAS_QR = True
except ImportError:
    HAS_QR = False

BG_DARK     = HexColor('#1a1d27')
BG_PANEL    = HexColor('#222632')
PURPLE      = HexColor('#7C6BB5')
PURPLE_LT   = HexColor('#a896d6')
PURPLE_DK   = HexColor('#5B4B8A')
GREEN       = HexColor('#5CD685')
GRAY_LT     = HexColor('#8892a0')
WHITE_90    = Color(1, 1, 1, 0.92)
WHITE_60    = Color(1, 1, 1, 0.60)
WHITE_30    = Color(1, 1, 1, 0.30)
BORDER      = HexColor('#2e3344')


def _draw_bracket_corners(c, x, y, w, h, size=12, color=PURPLE):
    c.setStrokeColor(color)
    c.setLineWidth(1)
    c.line(x, y + h, x + size, y + h)
    c.line(x, y + h, x, y + h - size)
    c.line(x + w, y + h, x + w - size, y + h)
    c.line(x + w, y + h, x + w, y + h - size)
    c.line(x, y, x + size, y)
    c.line(x, y, x, y + size)
    c.line(x + w, y, x + w - size, y)
    c.line(x + w, y, x + w, y + size)


def generate_certificate_pdf(cert_data: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    margin = 0.6 * inch

    c.setFillColor(BG_DARK)
    c.rect(0, 0, w, h, fill=True, stroke=False)

    panel_x, panel_y = margin, margin
    panel_w, panel_h = w - 2 * margin, h - 2 * margin
    c.setFillColor(BG_PANEL)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(panel_x, panel_y, panel_w, panel_h, fill=True, stroke=True)
    _draw_bracket_corners(c, panel_x, panel_y, panel_w, panel_h, size=16, color=PURPLE)

    cert_num = cert_data.get('certificate_number', 'ODDC-0000-00000')
    org = cert_data.get('organization_name', 'Unknown Organization')
    system = cert_data.get('system_name', 'Unknown System')
    version = cert_data.get('system_version', '')
    issued = cert_data.get('issued_at')
    expires = cert_data.get('expires_at')
    convergence = cert_data.get('convergence_score')
    evidence_hash = cert_data.get('evidence_hash', 'N/A')
    audit_ref = cert_data.get('audit_log_ref', 'N/A')
    verify_url = cert_data.get('verification_url', f'https://app.sentinelauthority.org/verify?cert={cert_num}')

    issued_str = issued.strftime('%B %d, %Y') if isinstance(issued, datetime) else str(issued or 'N/A')
    expires_str = expires.strftime('%B %d, %Y') if isinstance(expires, datetime) else str(expires or 'N/A')
    conv_str = f"{convergence:.4f}" if convergence is not None else "N/A"
    conv_pct = f"{convergence * 100:.2f}%" if convergence is not None else "N/A"
    sys_str = f"{system} v{version}" if version else system

    cx = w / 2
    y = h - margin - 50

    mark_w, mark_h = 100, 45
    mark_x = cx - mark_w / 2
    mark_y = y - 10
    c.setStrokeColor(PURPLE)
    c.setLineWidth(2)
    c.roundRect(mark_x, mark_y, mark_w, mark_h, 6, fill=False, stroke=True)
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(cx, mark_y + 16, 'ODDC')
    c.setFont('Helvetica', 6)
    c.setFillColor(PURPLE_LT)
    c.drawCentredString(cx, mark_y + 6, 'CONFORMANCE MARK')
    y = mark_y - 30

    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 22)
    c.drawCentredString(cx, y, 'SENTINEL AUTHORITY')
    y -= 18
    c.setFillColor(GRAY_LT)
    c.setFont('Helvetica', 10)
    c.drawCentredString(cx, y, 'Operational Design Domain Conformance Certificate')
    y -= 8

    c.setStrokeColor(PURPLE)
    c.setLineWidth(1.5)
    c.line(cx - 100, y, cx + 100, y)
    y -= 28

    c.setFillColor(PURPLE_LT)
    c.setFont('Courier-Bold', 13)
    c.drawCentredString(cx, y, f'Certificate No. {cert_num}')
    y -= 35

    statement = (
        "This certifies that the autonomous system identified below has successfully completed "
        "CAT-72 continuous conformance evaluation and demonstrated sustained compliance with its "
        "declared Operational Design Domain through ENVELO runtime enforcement."
    )
    text_obj = c.beginText(margin + 40, y)
    text_obj.setFont('Helvetica', 10)
    text_obj.setFillColor(WHITE_60)
    text_obj.setLeading(15)
    words = statement.split()
    line = ''
    max_width = panel_w - 80
    for word in words:
        test = line + ' ' + word if line else word
        if c.stringWidth(test, 'Helvetica', 10) < max_width:
            line = test
        else:
            text_obj.textLine(line)
            line = word
    if line:
        text_obj.textLine(line)
    c.drawText(text_obj)
    y -= 55

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(margin + 40, y, w - margin - 40, y)
    y -= 25

    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 18)
    c.drawCentredString(cx, y, org)
    y -= 22
    c.setFillColor(PURPLE_LT)
    c.setFont('Helvetica', 13)
    c.drawCentredString(cx, y, sys_str)
    y -= 30

    if convergence is not None:
        box_w, box_h = 180, 55
        box_x = cx - box_w / 2
        box_y = y - box_h + 10
        c.setFillColor(Color(92/255, 214/255, 133/255, 0.06))
        c.setStrokeColor(Color(92/255, 214/255, 133/255, 0.25))
        c.setLineWidth(1)
        c.rect(box_x, box_y, box_w, box_h, fill=True, stroke=True)
        _draw_bracket_corners(c, box_x, box_y, box_w, box_h, size=8, color=GREEN)
        c.setFillColor(GREEN)
        c.setFont('Helvetica-Bold', 24)
        c.drawCentredString(cx, box_y + 28, conv_pct)
        c.setFillColor(WHITE_30)
        c.setFont('Helvetica', 7)
        c.drawCentredString(cx, box_y + 12, 'CONVERGENCE SCORE')
        y = box_y - 20

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(margin + 40, y, w - margin - 40, y)
    y -= 5

    details = [
        ('ISSUED', issued_str),
        ('EXPIRES', expires_str),
        ('CONVERGENCE', conv_str),
        ('AUDIT REFERENCE', str(audit_ref)),
    ]

    label_x = margin + 50
    value_x = margin + 200

    for label, value in details:
        y -= 18
        c.setFillColor(WHITE_30)
        c.setFont('Helvetica', 7.5)
        c.drawString(label_x, y, label)
        c.setFillColor(WHITE_90)
        c.setFont('Courier', 10)
        c.drawString(value_x, y, str(value))

    y -= 10
    c.setStrokeColor(BORDER)
    c.line(margin + 40, y, w - margin - 40, y)
    y -= 5

    if evidence_hash and evidence_hash != 'N/A':
        y -= 16
        c.setFillColor(WHITE_30)
        c.setFont('Helvetica', 7.5)
        c.drawString(label_x, y, 'EVIDENCE HASH (SHA-256)')
        y -= 14
        c.setFillColor(PURPLE_LT)
        c.setFont('Courier', 7.5)
        if len(evidence_hash) > 64:
            c.drawString(label_x, y, evidence_hash[:64])
            y -= 11
            c.drawString(label_x, y, evidence_hash[64:])
        else:
            c.drawString(label_x, y, evidence_hash)
        y -= 12

    qr_size = 1.1 * inch
    qr_x = w - margin - qr_size - 30
    qr_y = margin + 30

    if HAS_QR:
        try:
            qr = qrcode.QRCode(version=1, box_size=10, border=2)
            qr.add_data(verify_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="#5B4B8A", back_color="white")
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format='PNG')
            qr_buf.seek(0)
            from reportlab.lib.utils import ImageReader
            c.drawImage(ImageReader(qr_buf), qr_x, qr_y, qr_size, qr_size)
            c.setFillColor(WHITE_30)
            c.setFont('Helvetica', 6.5)
            c.drawCentredString(qr_x + qr_size / 2, qr_y - 10, 'SCAN TO VERIFY')
        except Exception:
            pass

    foot_y = margin + 55
    c.setFillColor(PURPLE_LT)
    c.setFont('Helvetica', 8)
    c.drawString(margin + 30, foot_y, f'Verify: {verify_url}')

    foot_y -= 18
    c.setFillColor(WHITE_30)
    c.setFont('Helvetica', 6.5)
    c.drawString(margin + 30, foot_y, 'SENTINEL AUTHORITY \u2014 ODDC Conformance Certification')
    foot_y -= 10
    c.drawString(margin + 30, foot_y, 'This certificate is digitally signed and tamper-evident via the audit hash chain.')
    foot_y -= 10
    c.drawString(margin + 30, foot_y, 'Unauthorized reproduction or alteration is prohibited.')

    # Compliance notice — bold
    notice_y = margin + 140
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 7.5)
    notice_text = 'This certification requires continuous ENVELO Interlock monitoring. Systems falling below 95% conformance'
    notice_text2 = 'are subject to a 30-day correction period followed by suspension and mandatory re-certification.'
    c.drawString(margin + 30, notice_y, notice_text)
    c.drawString(margin + 30, notice_y - 11, notice_text2)

    sig_y = margin + 105
    sig_x = margin + 30
    c.setStrokeColor(WHITE_30)
    c.setLineWidth(0.5)
    c.line(sig_x, sig_y, sig_x + 180, sig_y)
    c.setFillColor(WHITE_30)
    c.setFont('Helvetica', 7)
    c.drawString(sig_x, sig_y - 10, 'Sentinel Authority Certification Board')

    c.showPage()
    c.save()
    return buf.getvalue()
