"""
Certificate PDF Generator
Creates professional ODDC certificates with QR codes
"""

import io
import qrcode
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

_font_path = os.path.join(os.path.dirname(__file__), 'LeagueSpartan-Bold.ttf')
if os.path.exists(_font_path):
    pdfmetrics.registerFont(TTFont('LeagueSpartan', _font_path))
    _LS = 'LeagueSpartan'
else:
    _LS = 'Helvetica-Bold'

NAVY = colors.Color(15/255, 16/255, 33/255)
PURPLE = colors.Color(91/255, 75/255, 138/255)
PURPLE_LIGHT = colors.Color(157/255, 140/255, 207/255)

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
    """Generate a professional ODDC certificate PDF"""
    
    if expiry_date is None:
        expiry_date = issue_date + timedelta(days=365)
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        fontSize=28,
        textColor=NAVY,
        alignment=TA_CENTER,
        fontName=_LS,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.gray,
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    cert_number_style = ParagraphStyle(
        'CertNumber',
        parent=styles['Normal'],
        fontSize=14,
        textColor=PURPLE,
        alignment=TA_CENTER,
        fontName=_LS,
        spaceAfter=20
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_CENTER,
        spaceAfter=12
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.gray,
        alignment=TA_LEFT
    )
    
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_LEFT,
        fontName=_LS
    )
    
    story = []
    
    # Header
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("SENTINEL AUTHORITY", title_style))
    story.append(Paragraph("ODDC CONFORMANCE CERTIFICATE", ParagraphStyle('SubLabel', fontSize=9, textColor=colors.Color(0.5,0.5,0.5), alignment=TA_CENTER, fontName=_LS, letterSpacing=3, spaceAfter=16)))
    story.append(Paragraph("Operational Design Domain Conformance Certificate", subtitle_style))
    
    # Certificate number
    story.append(Paragraph(f"Certificate No. {certificate_number}", cert_number_style))
    
    # Main certification statement
    story.append(Paragraph(
        "This certifies that the autonomous system identified below has successfully completed "
        "CAT-72 conformance testing and demonstrated sustained operation within its "
        "Operational Design Domain boundaries through ENVELO runtime enforcement.",
        body_style
    ))
    story.append(Spacer(1, 0.3*inch))
    
    # Certificate details table
    details = [
        ["CERTIFIED SYSTEM", system_name],
        ["ORGANIZATION", organization],
        ["ODD DESCRIPTION", odd_description[:100] + "..." if len(odd_description) > 100 else odd_description],
        ["ISSUE DATE", issue_date.strftime("%B %d, %Y")],
        ["EXPIRATION DATE", expiry_date.strftime("%B %d, %Y")],
        ["CAT-72 PASS RATE", f"{pass_rate:.1f}%"],
        ["TOTAL ACTIONS EVALUATED", f"{total_actions:,}"],
    ]
    
    detail_table = Table(details, colWidths=[2*inch, 4*inch])
    detail_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica'),
        (('FONTNAME', (1, 0), (1, -1), _LS)),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(detail_table)
    story.append(Spacer(1, 0.4*inch))
    
    # QR Code for verification
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(f"https://app.sentinelauthority.org/verify?cert={certificate_number}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#5B4B8A", back_color="white")
    
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_buffer.seek(0)
    
    qr_image = Image(qr_buffer, width=1.2*inch, height=1.2*inch)
    
    # Footer with QR and signature
    footer_data = [
        [qr_image, Paragraph(
            "<b>Verification</b><br/>"
            f"Scan QR code or visit:<br/>"
            f"sentinelauthority.org/verify<br/><br/>"
            f"<font size=8 color=gray>This certificate remains valid while the certified system "
            f"maintains active ENVELO enforcement and continuous telemetry reporting.</font>",
            ParagraphStyle('Footer', fontSize=9, leading=12)
        )]
    ]
    
    footer_table = Table(footer_data, colWidths=[1.5*inch, 4.5*inch])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (1, 0), (1, 0), 20),
    ]))
    story.append(footer_table)
    
    story.append(Spacer(1, 0.5*inch))
    
    # Signature line
    sig_style = ParagraphStyle('Sig', fontSize=10, alignment=TA_CENTER)
    story.append(Paragraph("_" * 40, sig_style))
    story.append(Paragraph("Sentinel Authority Certification Board", sig_style))
    
    doc.build(story)
    return buffer.getvalue()
