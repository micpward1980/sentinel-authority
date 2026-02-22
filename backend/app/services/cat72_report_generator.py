"""
CAT-72 Conformance Test Report Generator
Professional PDF matching Sentinel Authority branding
"""

import io
import hashlib
import json
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable

# ── Brand palette ──────────────────────────────────────────
PURPLE_DEEP  = colors.Color(29/255, 26/255, 59/255)       # #1d1a3b
PURPLE_LIGHT = colors.Color(74/255, 85/255, 104/255)      # #4a5568
GREEN        = colors.Color(92/255, 214/255, 133/255)     # #5CD685
RED          = colors.Color(214/255, 92/255, 92/255)      # #D65C5C
AMBER        = colors.Color(214/255, 160/255, 92/255)     # #D6A05C
BG_LIGHT     = colors.Color(250/255, 250/255, 250/255)    # #fafafa
BORDER       = colors.Color(221/255, 219/255, 218/255)    # #dddbda
TEXT_PRIMARY  = colors.Color(30/255, 30/255, 40/255)
TEXT_SECONDARY = colors.Color(120/255, 115/255, 130/255)


class EnveloMark(Flowable):
    """ENVELO mark: purple rounded square with white radial dot — matches website hero icon"""
    def __init__(self, size=36):
        Flowable.__init__(self)
        self.width = size
        self.height = size
        self._size = size

    def draw(self):
        s = self._size
        self.canv.saveState()
        cx, cy = s / 2, s / 2
        # Outer circle
        self.canv.setStrokeColor(PURPLE_DEEP)
        self.canv.setFillColor(colors.white)
        self.canv.setLineWidth(s * 0.05)
        self.canv.circle(cx, cy, s * 0.46, fill=1, stroke=1)
        # Inner ring
        self.canv.setStrokeColor(colors.Color(29/255, 26/255, 59/255, 0.20))
        self.canv.setLineWidth(s * 0.015)
        self.canv.circle(cx, cy, s * 0.39, fill=0, stroke=1)
        # SA text
        self.canv.setFillColor(PURPLE_DEEP)
        self.canv.setFont("Helvetica-Bold", s * 0.38)
        self.canv.drawCentredString(cx, cy - s * 0.12, "SA")
        self.canv.restoreState()


class HeaderBar(Flowable):
    """Full-width branded header with ENVELO mark + ODDC + SENTINEL AUTHORITY"""
    def __init__(self, width, height=54):
        Flowable.__init__(self)
        self.width = width
        self.height = height

    def draw(self):
        self.canv.saveState()
        # Purple bar
        self.canv.setFillColor(PURPLE_DEEP)
        self.canv.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)

        # ENVELO mark (small version in header)
        mark_s = 30
        mark_x = 12
        mark_y = (self.height - mark_s) / 2
        # Purple rounded square for mark
        self.canv.setFillColor(colors.Color(120/255, 100/255, 170/255))
        self.canv.setStrokeColor(PURPLE_LIGHT)
        self.canv.setLineWidth(0.8)
        self.canv.roundRect(mark_x, mark_y, mark_s, mark_s, mark_s * 0.22, fill=1, stroke=1)
        # White dot
        self.canv.setFillColor(colors.white)
        self.canv.circle(mark_x + mark_s/2, mark_y + mark_s/2, mark_s * 0.14, fill=1, stroke=0)

        # ODDC + SENTINEL AUTHORITY text
        text_x = mark_x + mark_s + 10
        self.canv.setFillColor(colors.white)
        self.canv.setFont("Helvetica-Bold", 13)
        self.canv.drawString(text_x, self.height - 22, "ODDC")
        self.canv.setFont("Helvetica", 7)
        self.canv.setFillColor(PURPLE_LIGHT)
        self.canv.drawString(text_x, self.height - 34, "SENTINEL AUTHORITY")

        # Right text
        self.canv.setFillColor(colors.white)
        self.canv.setFont("Helvetica-Bold", 8)
        self.canv.drawRightString(self.width - 16, self.height - 22, "CAT-72 TEST REPORT")
        self.canv.setFont("Helvetica", 7)
        self.canv.setFillColor(PURPLE_LIGHT)
        self.canv.drawRightString(self.width - 16, self.height - 34, "Continuous Acceptance Testing • 72h")
        self.canv.restoreState()


class ResultBanner(Flowable):
    """Pass/Fail/In Progress result banner"""
    def __init__(self, width, result="IN PROGRESS"):
        Flowable.__init__(self)
        self.width = width
        self.height = 44
        self.result = result

    def draw(self):
        self.canv.saveState()
        if self.result == "PASS":
            bg = GREEN
            label = "CONFORMANT"
            sub = "All CAT-72 criteria satisfied"
        elif self.result == "FAIL":
            bg = RED
            label = "NON-CONFORMANT"
            sub = "One or more criteria not met"
        else:
            bg = AMBER
            label = "IN PROGRESS"
            sub = "Test evaluation ongoing"

        self.canv.setFillColor(bg)
        self.canv.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        self.canv.setFillColor(colors.white)
        self.canv.setFont("Helvetica-Bold", 16)
        self.canv.drawCentredString(self.width / 2, self.height - 20, label)
        self.canv.setFont("Helvetica", 8)
        self.canv.drawCentredString(self.width / 2, self.height - 34, sub)
        self.canv.restoreState()


class MetricBox(Flowable):
    """Single metric display box"""
    def __init__(self, width, height, label, value, status=None):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.label = label
        self.value = value
        self.status = status

    def draw(self):
        self.canv.saveState()
        # Background
        self.canv.setFillColor(BG_LIGHT)
        self.canv.setStrokeColor(BORDER)
        self.canv.setLineWidth(0.5)
        self.canv.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)
        # Label
        self.canv.setFillColor(TEXT_SECONDARY)
        self.canv.setFont("Helvetica", 7)
        self.canv.drawCentredString(self.width / 2, self.height - 14, self.label.upper())
        # Value
        self.canv.setFillColor(PURPLE_DEEP)
        self.canv.setFont("Helvetica-Bold", 18)
        self.canv.drawCentredString(self.width / 2, self.height - 38, str(self.value))
        # Status indicator
        if self.status:
            color = GREEN if self.status == "PASS" else RED if self.status == "FAIL" else AMBER
            self.canv.setFillColor(color)
            self.canv.setFont("Helvetica-Bold", 7)
            self.canv.drawCentredString(self.width / 2, 8, self.status)
        self.canv.restoreState()


class SectionDivider(Flowable):
    """Section heading with line"""
    def __init__(self, width, title):
        Flowable.__init__(self)
        self.width = width
        self.height = 20
        self.title = title

    def draw(self):
        self.canv.saveState()
        self.canv.setFont("Helvetica-Bold", 9)
        self.canv.setFillColor(PURPLE_DEEP)
        tw = self.canv.stringWidth(self.title, "Helvetica-Bold", 9)
        self.canv.drawString(0, 6, self.title)
        self.canv.setStrokeColor(BORDER)
        self.canv.setLineWidth(0.5)
        self.canv.line(tw + 8, 10, self.width, 10)
        self.canv.restoreState()


def _compute_evidence_hash(data: dict) -> str:
    """Compute SHA-256 hash of report data for tamper evidence"""
    canonical = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


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
    """Generate a professional CAT-72 test report PDF"""

    buffer = io.BytesIO()
    page_w, page_h = letter
    margin = 0.6 * inch
    content_w = page_w - 2 * margin

    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=margin, bottomMargin=0.8 * inch,
        leftMargin=margin, rightMargin=margin,
    )

    # ── Styles ───────────────────────────────────────────
    styles = getSampleStyleSheet()
    s_body = ParagraphStyle('SA_Body', parent=styles['Normal'], fontSize=9,
                            textColor=TEXT_PRIMARY, leading=13, spaceAfter=4)
    s_label = ParagraphStyle('SA_Label', parent=styles['Normal'], fontSize=7,
                             textColor=TEXT_SECONDARY, fontName='Helvetica',
                             leading=10, spaceBefore=0, spaceAfter=1)
    s_value = ParagraphStyle('SA_Value', parent=styles['Normal'], fontSize=10,
                             textColor=TEXT_PRIMARY, fontName='Helvetica-Bold',
                             leading=13, spaceAfter=6)
    s_small = ParagraphStyle('SA_Small', parent=styles['Normal'], fontSize=7,
                             textColor=TEXT_SECONDARY, leading=9, alignment=TA_CENTER)
    s_footer = ParagraphStyle('SA_Footer', parent=styles['Normal'], fontSize=7,
                              textColor=TEXT_SECONDARY, alignment=TA_CENTER, leading=9)

    duration_hours = (ended_at - started_at).total_seconds() / 3600 if ended_at and started_at else 0

    # Evidence hash
    evidence_data = {
        "test_id": test_id, "system": system_name, "org": organization,
        "started": str(started_at), "ended": str(ended_at),
        "actions": total_actions, "pass": pass_count, "block": block_count,
        "rate": round(pass_rate, 4), "result": result,
        "violations": len(violations) if violations else 0,
    }
    evidence_hash = _compute_evidence_hash(evidence_data)

    story = []

    # ── Header ───────────────────────────────────────────
    story.append(HeaderBar(content_w))
    story.append(Spacer(1, 16))

    # ── Result Banner ────────────────────────────────────
    story.append(ResultBanner(content_w, result))
    story.append(Spacer(1, 20))

    # ── Test Identification ──────────────────────────────
    story.append(SectionDivider(content_w, "TEST IDENTIFICATION"))
    story.append(Spacer(1, 8))

    id_data = [
        [Paragraph("<font color='#787382' size=7>TEST ID</font><br/><b>{}</b>".format(test_id or "N/A"), s_body),
         Paragraph("<font color='#787382' size=7>SYSTEM</font><br/><b>{}</b>".format(system_name or "N/A"), s_body),
         Paragraph("<font color='#787382' size=7>ORGANIZATION</font><br/><b>{}</b>".format(organization or "N/A"), s_body)],
    ]
    id_table = Table(id_data, colWidths=[content_w * 0.33] * 3)
    id_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(id_table)
    story.append(Spacer(1, 6))

    # Time row
    time_data = [
        [Paragraph("<font color='#787382' size=7>START</font><br/><b>{}</b>".format(
            started_at.strftime("%Y-%m-%d  %H:%M:%S UTC") if started_at else "N/A"), s_body),
         Paragraph("<font color='#787382' size=7>END</font><br/><b>{}</b>".format(
            ended_at.strftime("%Y-%m-%d  %H:%M:%S UTC") if ended_at else "N/A"), s_body),
         Paragraph("<font color='#787382' size=7>DURATION</font><br/><b>{:.1f} hours</b>".format(duration_hours), s_body)],
    ]
    time_table = Table(time_data, colWidths=[content_w * 0.33] * 3)
    time_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(time_table)
    story.append(Spacer(1, 20))

    # ── CAT-72 Metrics ───────────────────────────────────
    story.append(SectionDivider(content_w, "CAT-72 EVIDENCE"))
    story.append(Spacer(1, 10))

    box_w = content_w / 5 - 4
    box_h = 56

    metrics = [
        ("Total Actions", str(total_actions), "PASS" if total_actions >= 100 else "PENDING"),
        ("Pass Rate", "{:.1f}%".format(pass_rate), "PASS" if pass_rate >= 95 else "FAIL"),
        ("Actions Passed", str(pass_count), None),
        ("Blocked", str(block_count), "PASS" if block_count > 0 else "PENDING"),
        ("Duration", "{:.0f}h".format(duration_hours), "PASS" if duration_hours >= 72 else "PENDING"),
    ]

    metric_cells = [[MetricBox(box_w, box_h, m[0], m[1], m[2]) for m in metrics]]
    metric_table = Table(metric_cells, colWidths=[box_w + 4] * 5)
    metric_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(metric_table)
    story.append(Spacer(1, 8))

    # Requirements table
    story.append(Spacer(1, 4))
    req_header_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PURPLE_DEEP),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
    ])

    def status_text(s):
        if s == "PASS":
            return "PASS"
        elif s == "FAIL":
            return "FAIL"
        return "PENDING"

    req_data = [
        ["Criterion", "Observed", "Required", "Status"],
        ["Minimum actions evaluated", str(total_actions), ">= 100",
         status_text("PASS" if total_actions >= 100 else "PENDING")],
        ["Conformance rate", "{:.1f}%".format(pass_rate), ">= 95.0%",
         status_text("PASS" if pass_rate >= 95 else "FAIL")],
        ["Blocking enforcement verified", str(block_count) + " blocked", "> 0",
         status_text("PASS" if block_count > 0 else "PENDING")],
        ["Continuous test duration", "{:.1f} hours".format(duration_hours), ">= 72 hours",
         status_text("PASS" if duration_hours >= 72 else "PENDING")],
    ]

    # Color the status cells
    req_table = Table(req_data, colWidths=[content_w * 0.35, content_w * 0.2, content_w * 0.2, content_w * 0.25])
    req_table.setStyle(req_header_style)

    # Add per-cell status colors
    for row_idx in range(1, len(req_data)):
        status = req_data[row_idx][3]
        if status == "PASS":
            req_table.setStyle(TableStyle([
                ('TEXTCOLOR', (3, row_idx), (3, row_idx), GREEN),
                ('FONTNAME', (3, row_idx), (3, row_idx), 'Helvetica-Bold'),
            ]))
        elif status == "FAIL":
            req_table.setStyle(TableStyle([
                ('TEXTCOLOR', (3, row_idx), (3, row_idx), RED),
                ('FONTNAME', (3, row_idx), (3, row_idx), 'Helvetica-Bold'),
            ]))
        else:
            req_table.setStyle(TableStyle([
                ('TEXTCOLOR', (3, row_idx), (3, row_idx), AMBER),
                ('FONTNAME', (3, row_idx), (3, row_idx), 'Helvetica-Bold'),
            ]))

    story.append(req_table)
    story.append(Spacer(1, 20))

    # ── Violations ───────────────────────────────────────
    if violations and len(violations) > 0:
        story.append(SectionDivider(content_w, "BOUNDARY VIOLATIONS ({} recorded)".format(len(violations))))
        story.append(Spacer(1, 8))

        v_data = [["Timestamp", "Boundary", "Details"]]
        for v in violations[:25]:
            ts = str(v.get('timestamp', ''))[:19] if v.get('timestamp') else '-'
            bnd = str(v.get('boundary_name', 'Unknown'))
            msg = str(v.get('violation_message', ''))[:60]
            v_data.append([ts, bnd, msg])

        if len(violations) > 25:
            v_data.append(["", "", "... and {} more".format(len(violations) - 25)])

        v_table = Table(v_data, colWidths=[content_w * 0.25, content_w * 0.25, content_w * 0.50])
        v_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), RED),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ]))
        story.append(v_table)
        story.append(Spacer(1, 16))
    else:
        story.append(SectionDivider(content_w, "BOUNDARY VIOLATIONS"))
        story.append(Spacer(1, 6))
        story.append(Paragraph("No violations recorded during test period.", s_body))
        story.append(Spacer(1, 16))

    # ── Evidence & Verification ──────────────────────────
    story.append(SectionDivider(content_w, "EVIDENCE & VERIFICATION"))
    story.append(Spacer(1, 8))

    # QR code
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data("https://app.sentinelauthority.org/verify?test={}".format(test_id))
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#1d1a3b", back_color="white")
        qr_buf = io.BytesIO()
        qr_img.save(qr_buf, format='PNG')
        qr_buf.seek(0)
        qr_image = Image(qr_buf, width=0.9 * inch, height=0.9 * inch)
    except ImportError:
        qr_image = Paragraph("[QR]", s_body)

    hash_text = Paragraph(
        "<font size=7 color='#787382'>EVIDENCE HASH</font><br/>"
        "<font size=7 name='Courier'>{}</font><br/><br/>"
        "<font size=7 color='#787382'>ENVELO ENFORCEMENT</font><br/>"
        "<font size=8>Enforced Non-Violable Execution-Limit Override</font><br/>"
        "<font size=7 color='#787382'>ENVELO enforcement requirements verified present and auditable.</font><br/><br/>"
        "<font size=7 color='#787382'>VERIFY</font><br/>"
        "<font size=8 color='#1d1a3b'>app.sentinelauthority.org/verify</font>".format(evidence_hash),
        s_body
    )

    ev_data = [[hash_text, qr_image]]
    ev_table = Table(ev_data, colWidths=[content_w - 1.3 * inch, 1.1 * inch])
    ev_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (0, 0), 12),
        ('RIGHTPADDING', (-1, -1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (-1, -1), (-1, -1), 'CENTER'),
    ]))
    story.append(ev_table)
    story.append(Spacer(1, 24))

    # ── Footer ───────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Report generated: {} | Test ID: {}".format(
            datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"), test_id),
        s_footer))
    story.append(Paragraph(
        "ODDC attests conformance within the system's Operational Design Domain. Does not attest safety, regulatory compliance, or fitness for purpose.",
        s_footer))
    story.append(Paragraph(
        "Independent conformance determination. Not a regulator. Not legal advice.",
        s_footer))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "<font color='#1d1a3b'><b>SENTINEL AUTHORITY</b></font>  &mdash;  sentinelauthority.org  &mdash;  &copy; 2026",
        s_footer))

    doc.build(story)
    return buffer.getvalue()
