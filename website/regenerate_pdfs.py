"""
Sentinel Authority — PDF Regenerator
Rebuilds all docs with correct SA branding from scratch.
"""
import os, re, json, glob
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, PageBreak, KeepTogether)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus.flowables import Flowable
import pikepdf

BASE = os.path.dirname(os.path.abspath(__file__))
NAVY   = HexColor('#1d1a3b')
SLATE  = HexColor('#4a5568')
GREEN  = HexColor('#2e844a')
AMBER  = HexColor('#dd7a01')
RED    = HexColor('#ea001b')
BORDER = HexColor('#dddbda')
BG     = HexColor('#fafafa')
TEXT1  = HexColor('#181818')
TEXT2  = HexColor('#444444')
TEXT3  = HexColor('#666666')

# ── SA Seal Flowable ──────────────────────────────────────────────────────────
class SASeal(Flowable):
    def __init__(self, size=28):
        Flowable.__init__(self)
        self.width = size
        self.height = size
        self._size = size
    def draw(self):
        s = self._size
        cx, cy = s/2, s/2
        c = self.canv
        c.saveState()
        c.setFillColor(white)
        c.setStrokeColor(NAVY)
        c.setLineWidth(s*0.06)
        c.circle(cx, cy, s*0.46, fill=1, stroke=1)
        c.setStrokeColor(HexColor('#1d1a3b'))
        c.setLineWidth(s*0.018)
        c.circle(cx, cy, s*0.38, fill=0, stroke=1)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', s*0.36)
        c.drawCentredString(cx, cy - s*0.12, 'SA')
        c.restoreState()

# ── Page template ─────────────────────────────────────────────────────────────
def make_doc(output_path, doc_title, doc_subtitle, version, is_confidential=True, is_public=False):
    buf = BytesIO()
    label = 'CONFIDENTIAL' if is_confidential else 'PUBLIC DOCUMENT'

    def on_page(c, doc):
        c.saveState()
        w, h = letter
        # Header seal
        cx, cy, r = 0.55*inch, h - 0.62*inch, 0.18*inch
        c.setFillColor(white); c.setStrokeColor(NAVY); c.setLineWidth(r*0.12)
        c.circle(cx, cy, r, fill=1, stroke=1)
        c.setStrokeColor(NAVY); c.setLineWidth(r*0.025)
        c.circle(cx, cy, r*0.82, fill=0, stroke=1)
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', r*0.78)
        c.drawCentredString(cx, cy - r*0.26, 'SA')
        # Header text
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 9.5)
        c.drawString(0.82*inch, h - 0.58*inch, 'SENTINEL AUTHORITY')
        c.setFillColor(TEXT3); c.setFont('Helvetica', 8)
        c.drawRightString(w - 0.5*inch, h - 0.58*inch, f'{doc_title}  ·  {version}')
        # Header rule
        c.setStrokeColor(NAVY); c.setLineWidth(0.75)
        c.line(0.5*inch, h - 0.78*inch, w - 0.5*inch, h - 0.78*inch)
        # Footer rule
        c.setStrokeColor(BORDER); c.setLineWidth(0.5)
        c.line(0.5*inch, 0.55*inch, w - 0.5*inch, 0.55*inch)
        c.setFillColor(TEXT3); c.setFont('Helvetica', 6.5)
        c.drawString(0.5*inch, 0.38*inch, f'SENTINEL AUTHORITY  ·  ODD Conformance Determination')
        c.drawCentredString(w/2, 0.38*inch, label)
        c.drawRightString(w - 0.5*inch, 0.38*inch, f'Page {doc.page}')
        c.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=1.1*inch, bottomMargin=0.8*inch,
        title=doc_title, author='Sentinel Authority',
    )
    return doc, buf, on_page

# ── Style definitions ─────────────────────────────────────────────────────────
def get_styles():
    s = getSampleStyleSheet()
    base = dict(fontName='Helvetica', fontSize=10, leading=15, textColor=TEXT1,
                spaceAfter=6)
    return {
        'title':    ParagraphStyle('title',    fontName='Helvetica-Bold', fontSize=22,
                                   textColor=NAVY, spaceAfter=6, leading=26),
        'subtitle': ParagraphStyle('subtitle', fontName='Helvetica', fontSize=12,
                                   textColor=NAVY, spaceAfter=4, leading=16),
        'version':  ParagraphStyle('version',  fontName='Helvetica', fontSize=9,
                                   textColor=TEXT3, spaceAfter=16, leading=13),
        'h1':       ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=13,
                                   textColor=NAVY, spaceBefore=18, spaceAfter=6, leading=18),
        'h2':       ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=11,
                                   textColor=NAVY, spaceBefore=12, spaceAfter=4, leading=15),
        'body':     ParagraphStyle('body', **base),
        'bullet':   ParagraphStyle('bullet', **{**base, 'leftIndent':16, 'bulletIndent':6}),
        'mono':     ParagraphStyle('mono', fontName='Courier', fontSize=8.5,
                                   textColor=TEXT2, leading=13, spaceAfter=4),
        'label':    ParagraphStyle('label', fontName='Helvetica-Bold', fontSize=8,
                                   textColor=TEXT3, leading=12,
                                   letterSpacing=1.2, spaceAfter=2),
        'caption':  ParagraphStyle('caption', fontName='Helvetica-Oblique', fontSize=8,
                                   textColor=TEXT3, leading=12, spaceAfter=8),
    }

ST = get_styles()

def rule(): return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=12, spaceBefore=4)
def sp(h=8): return Spacer(1, h)

def table(data, col_widths=None, header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (-1,-1), TEXT1),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, HexColor('#f9f9f9')]),
        ('GRID', (0,0), (-1,-1), 0.4, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]
    if header:
        cmds += [
            ('BACKGROUND', (0,0), (-1,0), NAVY),
            ('TEXTCOLOR', (0,0), (-1,0), white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 8.5),
        ]
    t.setStyle(TableStyle(cmds))
    return t

def cover_block(title, subtitle, version, doc_type, is_confidential=True):
    label = 'CONFIDENTIAL' if is_confidential else 'PUBLIC DOCUMENT'
    return [
        sp(20),
        Paragraph(doc_type.upper(), ST['label']),
        sp(4),
        Paragraph(title, ST['title']),
        Paragraph(subtitle, ST['subtitle']),
        sp(4),
        rule(),
        Paragraph(f'Version {version}  ·  {datetime.now().strftime("%B %Y")}  ·  {label}', ST['version']),
        sp(16),
    ]

# ── Extract text from existing PDF ───────────────────────────────────────────
def extract_text(path):
    pdf = pikepdf.open(path)
    pages = []
    for page in pdf.pages:
        contents = page.get('/Contents')
        if not contents: continue
        streams = list(contents) if isinstance(contents, pikepdf.Array) else [contents]
        texts = []
        for ref in streams:
            try:
                obj = ref if isinstance(ref, pikepdf.Stream) else pdf.get_object(ref.objgen)
                raw = obj.read_bytes()
                found = re.findall(rb'\(([^)]+)\)', raw)
                for t in found:
                    try:
                        s = t.decode('latin-1').strip()
                        s = s.replace('\\227', '—').replace('\\222', "'").replace('\\177', '·')
                        s = s.replace('\\(', '(').replace('\\)', ')')
                        if s and len(s) > 2 and s not in ('SA', 'SENTINEL AUTHORITY', 'CONFIDENTIAL', 'PUBLIC DOCUMENT'):
                            texts.append(s)
                    except: pass
            except: pass
        if texts:
            pages.append(texts)
    pdf.close()
    return pages

# ── Generic doc builder ────────────────────────────────────────────────────────
def build_generic_doc(src_path, out_path, title, subtitle, version, doc_type, confidential=True):
    pages_text = extract_text(src_path)
    doc, buf, on_page = make_doc(out_path, title, subtitle, version, confidential)

    story = cover_block(title, subtitle, version, doc_type, confidential)

    for page_texts in pages_text:
        # Skip header/footer fragments, dedupe
        seen = set()
        for text in page_texts:
            if text in seen: continue
            seen.add(text)
            # Detect section headings (short, title-like)
            if len(text) < 80 and re.match(r'^\d+\.', text):
                story.append(Paragraph(text, ST['h1']))
            elif len(text) < 60 and re.match(r'^\d+\.\d+', text):
                story.append(Paragraph(text, ST['h2']))
            elif text.isupper() and len(text) < 60:
                story.append(Paragraph(text, ST['label']))
                story.append(sp(2))
            else:
                story.append(Paragraph(text, ST['body']))

        story.append(sp(8))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    buf.seek(0)
    with open(out_path, 'wb') as f:
        f.write(buf.read())
    print(f'  ✓ {os.path.basename(out_path)}')

# ── Run all ────────────────────────────────────────────────────────────────────
DOCS = [
    # (src_rel, out_rel, title, subtitle, version, doc_type, confidential)
    ('docs/ODDC_Overview_v3.0.pdf', 'docs/ODDC_Overview_v3.0.pdf',
     'ODDC Overview', 'ODD Conformance Determination Framework', 'v3.0', 'Framework Document', False),
    ('docs/ODDC_Overview_v2.0.pdf', 'docs/ODDC_Overview_v2.0.pdf',
     'ODDC Overview', 'ODD Conformance Determination Framework', 'v2.0', 'Framework Document', False),
    ('docs/ENVELO_Requirements_v3.0.pdf', 'docs/ENVELO_Requirements_v3.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v3.0', 'Technical Specification', True),
    ('docs/ENVELO_Requirements_v2.0.pdf', 'docs/ENVELO_Requirements_v2.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v2.0', 'Technical Specification', True),
    ('docs/ENVELO_Requirements_v1.0.pdf', 'docs/ENVELO_Requirements_v1.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v1.0', 'Technical Specification', True),
    ('docs/CAT-72_Procedure_v4.0.pdf', 'docs/CAT-72_Procedure_v4.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v4.0', 'Testing Procedure', True),
    ('docs/CAT-72_Procedure_v3.0.pdf', 'docs/CAT-72_Procedure_v3.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v3.0', 'Testing Procedure', True),
    ('docs/CAT-72_Procedure_v2.0.pdf', 'docs/CAT-72_Procedure_v2.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v2.0', 'Testing Procedure', True),
    ('docs/CAT-72_Procedure_v1.0.pdf', 'docs/CAT-72_Procedure_v1.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v1.0', 'Testing Procedure', True),
    ('docs/ODDC_Critical_QA_v3.0.pdf', 'docs/ODDC_Critical_QA_v3.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v3.0', 'QA Document', True),
    ('docs/ODDC_Critical_QA_v2.0.pdf', 'docs/ODDC_Critical_QA_v2.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v2.0', 'QA Document', True),
    ('docs/ODDC_Critical_QA_v1.0.pdf', 'docs/ODDC_Critical_QA_v1.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v1.0', 'QA Document', True),
    ('docs/ODDC_Scenarios_v3.0.pdf', 'docs/ODDC_Scenarios_v3.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v3.0', 'Reference Document', False),
    ('docs/ODDC_Scenarios_v2.0.pdf', 'docs/ODDC_Scenarios_v2.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v2.0', 'Reference Document', False),
    ('docs/ODDC_Scenarios_v1.0.pdf', 'docs/ODDC_Scenarios_v1.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v1.0', 'Reference Document', False),
    ('docs/ODDC_Certification_Guide_v5.0.pdf', 'docs/ODDC_Certification_Guide_v5.0.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v5.0', 'Process Guide', False),
    ('docs/ODDC_Certification_Guide_v4.0.pdf', 'docs/ODDC_Certification_Guide_v4.0.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v4.0', 'Process Guide', False),
    ('downloads/ODDC_Certification_Guide_v3.pdf', 'downloads/ODDC_Certification_Guide_v3.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v3.0', 'Process Guide', False),
    ('publications/The_Accountability_Chain.pdf', 'publications/The_Accountability_Chain.pdf',
     'The Accountability Chain', 'Why Autonomous System Liability Requires Independent Conformance Evidence', 'v1.0', 'White Paper', False),
    ('publications/The_Insurance_Imperative.pdf', 'publications/The_Insurance_Imperative.pdf',
     'The Insurance Imperative', 'How Conformance Evidence Enables Autonomous System Coverage', 'v1.0', 'White Paper', False),
    ('publications/Ten_Domains_Zero_Standards.pdf', 'publications/Ten_Domains_Zero_Standards.pdf',
     'Ten Domains, Zero Standards', 'The Autonomous System Certification Gap', 'v1.0', 'White Paper', False),
    ('publications/Process_vs_Behavioral_Attestation.pdf', 'publications/Process_vs_Behavioral_Attestation.pdf',
     'Process vs. Behavioral Attestation', 'Why Development Process Certification Is Insufficient for Autonomous Systems', 'v1.0', 'White Paper', False),
    ('Sentinel_Authority_When_Self-Certification_Fails.pdf', 'Sentinel_Authority_When_Self-Certification_Fails.pdf',
     'When Self-Certification Fails', 'The Case for Independent Conformance Determination', 'v1.0', 'White Paper', False),
]

print(f'Regenerating {len(DOCS)} PDFs...\n')
errors = []
for args in DOCS:
    src_rel, out_rel = args[0], args[1]
    rest = args[2:]
    src = os.path.join(BASE, src_rel)
    out = os.path.join(BASE, out_rel)
    if not os.path.exists(src):
        print(f'  SKIP (not found): {src_rel}')
        continue
    try:
        build_generic_doc(src, out, *rest)
    except Exception as e:
        print(f'  ERROR {src_rel}: {e}')
        errors.append((src_rel, str(e)))

print(f'\nDone. {len(errors)} errors.')
for e in errors:
    print(' ', e)
