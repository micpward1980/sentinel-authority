"""
CAT-72 Test Report Generator
Creates detailed PDF reports for certification tests
"""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

PURPLE = colors.Color(91/255, 75/255, 138/255)


def generate_cat72_report(
    test_id: str,
    system_name: str,
    organization: str,
    started_at: datetime,
    ended_at: datetime,
    total_actions: int,
    pass_count: int,
    block_count: int,
    pass_rate: float,
    result: str,
    telemetry_records: list = None,
    violations: list = None,
) -> bytes:
    """Generate a CAT-72 test report PDF"""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=PURPLE, alignment=TA_CENTER, spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=11, textColor=colors.gray, alignment=TA_CENTER, spaceAfter=20)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=14, textColor=PURPLE, spaceBefore=20, spaceAfter=10)
    
    story = []
    
    # Header
    story.append(Paragraph("SENTINEL AUTHORITY", title_style))
    story.append(Paragraph("CAT-72 Conformance Test Report", subtitle_style))
    
    # Test result banner
    result_color = colors.Color(92/255, 214/255, 133/255) if result == "PASS" else colors.Color(214/255, 92/255, 92/255)
    result_table = Table([[f"TEST RESULT: {result}"]], colWidths=[6*inch])
    result_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), result_color),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(result_table)
    story.append(Spacer(1, 0.3*inch))
    
    # Test Information
    story.append(Paragraph("Test Information", section_style))
    
    duration_hours = (ended_at - started_at).total_seconds() / 3600 if ended_at and started_at else 0
    
    info_data = [
        ["Test ID:", test_id or "N/A"],
        ["System Name:", system_name or "N/A"],
        ["Organization:", organization or "N/A"],
        ["Start Time:", started_at.strftime("%Y-%m-%d %H:%M:%S UTC") if started_at else "N/A"],
        ["End Time:", ended_at.strftime("%Y-%m-%d %H:%M:%S UTC") if ended_at else "N/A"],
        ["Duration:", f"{duration_hours:.1f} hours"],
    ]
    
    info_table = Table(info_data, colWidths=[1.5*inch, 4.5*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(info_table)
    
    # Metrics
    story.append(Paragraph("Test Metrics", section_style))
    
    metrics_data = [
        ["Metric", "Value", "Requirement", "Status"],
        ["Total Actions", str(total_actions), ">= 100", "PASS" if total_actions >= 100 else "FAIL"],
        ["Actions Passed", str(pass_count), "-", "-"],
        ["Actions Blocked", str(block_count), "> 0", "PASS" if block_count > 0 else "PENDING"],
        ["Pass Rate", f"{pass_rate:.1f}%", ">= 95%", "PASS" if pass_rate >= 95 else "FAIL"],
        ["Test Duration", f"{duration_hours:.1f}h", ">= 72h", "PASS" if duration_hours >= 72 else "PENDING"],
    ]
    
    metrics_table = Table(metrics_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PURPLE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(metrics_table)
    
    # Violations
    if violations:
        story.append(Paragraph(f"Boundary Violations ({len(violations)} blocked)", section_style))
        
        violation_data = [["Time", "Boundary", "Details"]]
        for v in violations[:20]:
            violation_data.append([
                str(v.get('timestamp', 'N/A'))[:19] if v.get('timestamp') else 'N/A',
                str(v.get('boundary_name', 'Unknown')),
                str(v.get('violation_message', ''))[:50]
            ])
        
        v_table = Table(violation_data, colWidths=[1.5*inch, 1.5*inch, 3*inch])
        v_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(214/255, 92/255, 92/255)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(v_table)
    
    # Footer
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(
        f"Report generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
        ParagraphStyle('Footer', fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    ))
    story.append(Paragraph(
        "Sentinel Authority - sentinelauthority.org",
        ParagraphStyle('Footer2', fontSize=8, textColor=PURPLE, alignment=TA_CENTER)
    ))
    
    doc.build(story)
    return buffer.getvalue()
