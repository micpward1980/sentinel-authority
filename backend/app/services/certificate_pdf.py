"""ODDC Certificate PDF Generator"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from io import BytesIO
from datetime import datetime

NAVY = HexColor('#1a365d')
GOLD = HexColor('#d69e2e')
GRAY = HexColor('#4a5568')
LIGHT_GRAY = HexColor('#e2e8f0')

def generate_certificate_pdf(certificate_id, organization_name, system_name, odd_specification, issued_date, expiry_date, test_id, convergence_score, stability_index, drift_rate, evidence_hash):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    c.setStrokeColor(NAVY)
    c.setLineWidth(3)
    c.rect(0.5*inch, 0.5*inch, width - inch, height - inch)
    c.setLineWidth(1)
    c.rect(0.6*inch, 0.6*inch, width - 1.2*inch, height - 1.2*inch)
    
    c.setFillColor(NAVY)
    c.rect(0.6*inch, height - 2*inch, width - 1.2*inch, 1.3*inch, fill=True)
    
    c.setFillColor(HexColor('#ffffff'))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width/2, height - 1.3*inch, "SENTINEL AUTHORITY")
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 1.6*inch, "Independent Conformance Determination")
    
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width/2, height - 2.6*inch, "ODDC CONFORMANCE DETERMINATION")
    
    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    c.line(1.5*inch, height - 2.8*inch, width - 1.5*inch, height - 2.8*inch)
    
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, height - 3.1*inch, f"Certificate ID: {certificate_id}")
    
    y = height - 3.6*inch
    c.setFillColor(NAVY)
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, y, "This is to certify that")
    y -= 0.4*inch
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width/2, y, organization_name)
    y -= 0.35*inch
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, y, "has demonstrated conformance for")
    y -= 0.4*inch
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y, f'"{system_name}"')
    y -= 0.35*inch
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, y, f"ODD: {odd_specification}")
    
    y -= 0.6*inch
    box_h, box_w = 1.2*inch, 5*inch
    box_x = (width - box_w) / 2
    c.setFillColor(LIGHT_GRAY)
    c.roundRect(box_x, y - box_h, box_w, box_h, 5, fill=True, stroke=True)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width/2, y - 0.25*inch, f"CAT-72 RESULTS — {test_id}")
    c.setFont("Helvetica", 10)
    c.drawString(box_x + 0.3*inch, y - 0.55*inch, f"Convergence: {convergence_score:.1%}")
    c.drawString(box_x + 2.6*inch, y - 0.55*inch, f"Stability: {stability_index:.1%}")
    c.drawString(box_x + 0.3*inch, y - 0.85*inch, f"Drift: {drift_rate:.4f}")
    c.setFillColor(HexColor('#38a169'))
    c.drawString(box_x + 2.6*inch, y - 0.85*inch, "Status: PASS")
    
    y -= 1.6*inch
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 10)
    c.drawCentredString(width/2, y, f"Valid: {issued_date.strftime('%B %d, %Y')} — {expiry_date.strftime('%B %d, %Y')}")
    
    c.setFont("Courier", 7)
    c.drawCentredString(width/2, 1.2*inch, f"Evidence: {evidence_hash}")
    c.setFont("Helvetica", 8)
    c.drawCentredString(width/2, 0.95*inch, "Verify: https://sentinel-authority.vercel.app/verify")
    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(width/2, 0.7*inch, "© 2026 Sentinel Authority. All rights reserved.")
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()
