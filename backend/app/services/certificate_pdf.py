"""ODDC Certificate PDF generation using ReportLab."""
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER

SA_PURPLE = colors.HexColor('#7C6BB5')
SA_PURPLE_DARK = colors.HexColor('#2A1F4E')
SA_GREEN = colors.HexColor('#5CD685')
SA_GRAY = colors.HexColor('#596270')


def generate_certificate_pdf(cert_data: dict) -> bytes:
    """Generate professional ODDC conformance certificate PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch, leftMargin=inch, rightMargin=inch)
    styles = getSampleStyleSheet()

    title_s = ParagraphStyle('CT', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=24, textColor=SA_PURPLE_DARK, alignment=TA_CENTER, spaceAfter=6)
    sub_s = ParagraphStyle('CS', parent=styles['Normal'], fontName='Helvetica', fontSize=11, textColor=SA_GRAY, alignment=TA_CENTER, spaceAfter=24)
    org_s = ParagraphStyle('CO', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=18, textColor=SA_PURPLE_DARK, alignment=TA_CENTER, spaceAfter=4)
    sys_s = ParagraphStyle('CSy', parent=styles['Normal'], fontName='Helvetica', fontSize=14, textColor=SA_GRAY, alignment=TA_CENTER, spaceAfter=20)
    sec_s = ParagraphStyle('CSe', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=SA_PURPLE, spaceAfter=8, spaceBefore=16)
    body_s = ParagraphStyle('CB', parent=styles['Normal'], fontName='Helvetica', fontSize=10, textColor=SA_GRAY, leading=14)
    foot_s = ParagraphStyle('CF', parent=styles['Normal'], fontName='Helvetica', fontSize=8, textColor=SA_GRAY, alignment=TA_CENTER)

    story = []
    story.append(Paragraph("SENTINEL AUTHORITY", title_s))
    story.append(Paragraph("Operational Design Domain Conformance Certificate", sub_s))
    story.append(HRFlowable(width="100%", thickness=2, color=SA_PURPLE, spaceAfter=20))

    cert_num = cert_data.get('certificate_number', 'SA-CERT-0000')
    story.append(Paragraph(f"Certificate No. {cert_num}", ParagraphStyle('CN', parent=styles['Normal'], fontName='Courier-Bold', fontSize=12, textColor=SA_PURPLE, alignment=TA_CENTER, spaceAfter=24)))

    org = cert_data.get('organization_name', 'Unknown')
    system = cert_data.get('system_name', 'Unknown System')
    version = cert_data.get('system_version', '')
    v_str = f" (v{version})" if version else ""

    story.append(Paragraph("This certifies that", ParagraphStyle('CC', parent=styles['Normal'], fontName='Helvetica', fontSize=11, textColor=SA_GRAY, alignment=TA_CENTER, spaceAfter=8)))
    story.append(Paragraph(org, org_s))
    story.append(Paragraph(f"{system}{v_str}", sys_s))
    story.append(Paragraph(
        "has successfully completed the CAT-72 continuous evaluation procedure "
        "and meets all requirements for Operational Design Domain Conformance (ODDC) "
        "as defined by the ENVELO\u2122 framework.",
        ParagraphStyle('CSt', parent=body_s, alignment=TA_CENTER, spaceAfter=24)))
    story.append(HRFlowable(width="60%", thickness=0.5, color=SA_GRAY, spaceAfter=16))

    story.append(Paragraph("CERTIFICATION DETAILS", sec_s))
    conv = cert_data.get('convergence_score')
    conv_str = f"{conv:.4f}" if conv is not None else "N/A"
    issued = cert_data.get('issued_at')
    expires = cert_data.get('expires_at')
    issued_str = issued.strftime('%B %d, %Y') if isinstance(issued, datetime) else str(issued or 'N/A')
    expires_str = expires.strftime('%B %d, %Y') if isinstance(expires, datetime) else str(expires or 'N/A')

    rows = [
        ['CONVERGENCE SCORE', conv_str],
        ['ISSUED', issued_str],
        ['EXPIRES', expires_str],
        ['SIGNATURE', cert_data.get('signature', 'N/A')],
        ['AUDIT REFERENCE', cert_data.get('audit_log_ref', 'N/A')],
    ]
    t = Table(rows, colWidths=[2.5*inch, 3.5*inch])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (0,-1), SA_GRAY),
        ('TEXTCOLOR', (1,0), (1,-1), SA_PURPLE_DARK),
        ('FONTNAME', (1,0), (1,-1), 'Courier'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-2), 0.5, colors.HexColor('#E0E0E0')),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))

    odd = cert_data.get('odd_specification')
    if odd and isinstance(odd, dict):
        story.append(Paragraph("ODD SPECIFICATION", sec_s))
        odd_rows = [[k.replace('_', ' ').title(), str(v)] for k, v in odd.items()]
        if odd_rows:
            ot = Table(odd_rows, colWidths=[2.5*inch, 3.5*inch])
            ot.setStyle(TableStyle([
                ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 9),
                ('TEXTCOLOR', (0,0), (0,-1), SA_GRAY),
                ('TEXTCOLOR', (1,0), (1,-1), SA_PURPLE_DARK),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(ot)
            story.append(Spacer(1, 16))

    story.append(HRFlowable(width="100%", thickness=0.5, color=SA_GRAY, spaceBefore=20, spaceAfter=12))
    verify_url = cert_data.get('verification_url', f'https://app.sentinelauthority.org/verify/{cert_num}')
    story.append(Paragraph(f"Verify this certificate at: {verify_url}", ParagraphStyle('CV', parent=foot_s, fontSize=9, textColor=SA_PURPLE)))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "SENTINEL AUTHORITY \u2014 ODDC Conformance Certification<br/>"
        "This certificate is digitally signed and tamper-evident via the audit hash chain.<br/>"
        "Unauthorized reproduction or alteration is prohibited.", foot_s))

    doc.build(story)
    return buf.getvalue()
