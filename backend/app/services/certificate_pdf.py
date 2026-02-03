"""ODDC Certificate PDF Generator - Matching sentinelauthority.org branding"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from io import BytesIO
from datetime import datetime
import qrcode

# Colors matching sentinelauthority.org exactly
PURPLE_PRIMARY = HexColor('#5B4B8A')
PURPLE_BRIGHT = HexColor('#9d8ccf')
BG_DEEP = HexColor('#2a2f3d')
ACCENT_GREEN = HexColor('#5CD685')
TEXT_PRIMARY = HexColor('#f0f0f0')
TEXT_SECONDARY = HexColor('#bfbfbf')
TEXT_TERTIARY = HexColor('#808080')
BORDER_GLASS = HexColor('#333844')

def generate_qr_code(url):
    """Generate QR code image for verification URL"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    # Create QR with purple color to match branding
    img = qr.make_image(fill_color="#9d8ccf", back_color="#2a2f3d")
    
    # Convert to bytes for reportlab
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    return img_buffer

def generate_certificate_pdf(certificate_id, organization_name, system_name, odd_specification, issued_date, expiry_date, test_id, convergence_score, stability_index, drift_rate, evidence_hash):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Dark background matching website
    c.setFillColor(BG_DEEP)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Outer border - subtle
    c.setStrokeColor(BORDER_GLASS)
    c.setLineWidth(1)
    c.rect(0.5*inch, 0.5*inch, width - inch, height - inch)
    
    # Inner border with purple accent
    c.setStrokeColor(PURPLE_BRIGHT)
    c.setLineWidth(0.5)
    c.rect(0.6*inch, 0.6*inch, width - 1.2*inch, height - 1.2*inch)
    
    # ODDC Mark box at top (matching website badge style)
    mark_width = 2.5*inch
    mark_height = 1.2*inch
    mark_x = (width - mark_width) / 2
    mark_y = height - 2*inch
    
    # Badge background
    c.setFillColor(PURPLE_PRIMARY)
    c.setStrokeColor(PURPLE_BRIGHT)
    c.setLineWidth(2)
    c.roundRect(mark_x, mark_y, mark_width, mark_height, 10, fill=True, stroke=True)
    
    # ODDC text
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width/2, mark_y + 0.65*inch, "ODDC")
    
    # SENTINEL AUTHORITY text
    c.setFillColor(PURPLE_BRIGHT)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, mark_y + 0.25*inch, "SENTINEL AUTHORITY")
    
    # Certificate ID below mark
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Courier", 9)
    c.drawCentredString(width/2, mark_y - 0.35*inch, certificate_id)
    
    # Title
    y = height - 3.1*inch
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width/2, y, "CONFORMANCE DETERMINATION")
    
    # Purple line
    c.setStrokeColor(PURPLE_BRIGHT)
    c.setLineWidth(1)
    c.line(2*inch, y - 0.2*inch, width - 2*inch, y - 0.2*inch)
    
    # Main content
    y -= 0.7*inch
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 11)
    c.drawCentredString(width/2, y, "This record attests that")
    
    # Organization name (prominent)
    y -= 0.4*inch
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y, organization_name)
    
    # System name
    y -= 0.3*inch
    c.setFillColor(PURPLE_BRIGHT)
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, y, f"System: {system_name}")
    
    # ODD description
    y -= 0.35*inch
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, y, "has demonstrated conformance within the declared Operational Design Domain:")
    
    # ODD box
    y -= 0.3*inch
    odd_text = odd_specification[:200] + "..." if len(str(odd_specification)) > 200 else str(odd_specification)
    
    box_width = 5*inch
    box_height = 0.7*inch
    box_x = (width - box_width) / 2
    
    c.setFillColor(HexColor('#1a1f2e'))
    c.setStrokeColor(BORDER_GLASS)
    c.setLineWidth(0.5)
    c.roundRect(box_x, y - box_height, box_width, box_height, 5, fill=True, stroke=True)
    
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica-Oblique", 8)
    
    # Word wrap ODD text
    words = odd_text.split()
    lines = []
    current_line = []
    for word in words:
        current_line.append(word)
        if c.stringWidth(' '.join(current_line), "Helvetica-Oblique", 8) > box_width - 0.4*inch:
            current_line.pop()
            lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))
    
    text_y = y - 0.2*inch
    for line in lines[:4]:
        c.drawCentredString(width/2, text_y, line)
        text_y -= 0.15*inch
    
    # CAT-72 Evidence box
    y -= 1.1*inch
    box_height = 1.0*inch
    c.setFillColor(HexColor('#1a1f2e'))
    c.setStrokeColor(PURPLE_PRIMARY)
    c.roundRect(box_x, y - box_height, box_width, box_height, 5, fill=True, stroke=True)
    
    c.setFillColor(PURPLE_BRIGHT)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width/2, y - 0.22*inch, f"CAT-72 EVIDENCE — {test_id}")
    
    # Metrics grid
    c.setFont("Helvetica", 9)
    col1_x = box_x + 0.4*inch
    col2_x = box_x + 2.6*inch
    
    row1_y = y - 0.5*inch
    row2_y = y - 0.78*inch
    
    c.setFillColor(TEXT_TERTIARY)
    c.drawString(col1_x, row1_y, "Convergence Score")
    c.drawString(col2_x, row1_y, "Stability Index")
    c.drawString(col1_x, row2_y, "Drift Rate")
    c.drawString(col2_x, row2_y, "Determination")
    
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(col1_x + 1.3*inch, row1_y, f"{convergence_score:.1%}")
    c.drawString(col2_x + 1.1*inch, row1_y, f"{stability_index:.1%}")
    c.drawString(col1_x + 1.3*inch, row2_y, f"{drift_rate:.4f}")
    
    c.setFillColor(ACCENT_GREEN)
    c.drawString(col2_x + 1.1*inch, row2_y, "CONFORMANT")
    
    # Validity period
    y -= 1.4*inch
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width/2, y, "VALIDITY PERIOD")
    
    y -= 0.22*inch
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, y, f"{issued_date.strftime('%Y-%m-%d')}  →  {expiry_date.strftime('%Y-%m-%d')}")
    
    # ── BOTTOM SECTION ──
    # Thin purple divider line
    y -= 0.35*inch
    c.setStrokeColor(PURPLE_PRIMARY)
    c.setLineWidth(0.5)
    c.line(0.8*inch, y, width - 0.8*inch, y)
    
    # ENVELO statement (centered, below divider)
    y -= 0.25*inch
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 8)
    c.drawCentredString(width/2, y, "ENVELO enforcement requirements verified present and auditable.")
    
    y -= 0.16*inch
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(TEXT_TERTIARY)
    c.drawCentredString(width/2, y, "Enforcer for Non-Violable Execution & Limit Oversight")
    
    # Evidence hash + QR section
    # Left side: hash + verify link
    y -= 0.35*inch
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 7)
    c.drawString(0.8*inch, y, "EVIDENCE HASH")
    
    y -= 0.16*inch
    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Courier", 5.5)
    c.drawString(0.8*inch, y, evidence_hash)
    
    y -= 0.22*inch
    c.setFillColor(PURPLE_BRIGHT)
    c.setFont("Helvetica", 8)
    c.drawString(0.8*inch, y, "Verify: app.sentinelauthority.org/verify")
    
    # Right side: QR code (aligned with evidence hash area)
    qr_size = 0.8*inch
    qr_x = width - 1.5*inch
    qr_y = y + 0.05*inch  # Align bottom of QR with verify URL
    
    verify_url = f"https://app.sentinelauthority.org/verify?cert={certificate_id}"
    try:
        qr_img = generate_qr_code(verify_url)
        qr_reader = ImageReader(qr_img)
        c.drawImage(qr_reader, qr_x, qr_y, width=qr_size, height=qr_size)
        
        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 6)
        c.drawCentredString(qr_x + qr_size/2, qr_y - 0.12*inch, "SCAN TO VERIFY")
    except Exception:
        pass
    
    # Footer disclaimer
    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica-Oblique", 6)
    c.drawCentredString(width/2, 0.92*inch, "ODDC attests conformance within declared ODD. Does not attest safety, regulatory compliance, or fitness for purpose.")
    c.drawCentredString(width/2, 0.80*inch, "Independent conformance determination. Not a regulator. Not legal advice.")
    
    c.setFont("Helvetica", 6)
    c.drawCentredString(width/2, 0.68*inch, "© 2026 Sentinel Authority")
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
