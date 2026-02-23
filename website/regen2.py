"""
Sentinel Authority — Clean PDF Regenerator v2
Reads extracted text, strips noise, rebuilds with proper structure.
"""
import os, re, json, glob
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, PageBreak, KeepTogether, ListFlowable, ListItem)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus.flowables import Flowable

BASE = os.path.dirname(os.path.abspath(__file__))
NAVY  = HexColor('#1d1a3b')
SLATE = HexColor('#4a5568')
GREEN = HexColor('#2e844a')
BORD  = HexColor('#dddbda')
BG    = HexColor('#fafafa')
T1    = HexColor('#181818')
T2    = HexColor('#444444')
T3    = HexColor('#888888')

# ── Styles ────────────────────────────────────────────────────────────────────
def S(name, **kw):
    defaults = dict(fontName='Helvetica', fontSize=10, leading=15,
                    textColor=T1, spaceAfter=6, spaceBefore=0)
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)

ST = {
    'h1':      S('h1',  fontName='Helvetica-Bold', fontSize=13, textColor=NAVY,
                        spaceBefore=20, spaceAfter=6, leading=17),
    'h2':      S('h2',  fontName='Helvetica-Bold', fontSize=11, textColor=NAVY,
                        spaceBefore=14, spaceAfter=4, leading=15),
    'h3':      S('h3',  fontName='Helvetica-Bold', fontSize=10, textColor=T1,
                        spaceBefore=10, spaceAfter=3, leading=14),
    'body':    S('body'),
    'bullet':  S('bullet', leftIndent=18, spaceAfter=3),
    'label':   S('label', fontName='Helvetica-Bold', fontSize=8, textColor=T3,
                          leading=12, spaceAfter=2, spaceBefore=4),
    'caption': S('caption', fontName='Helvetica-Oblique', fontSize=8,
                            textColor=T3, leading=12, spaceAfter=8),
    'cover_type':  S('ct', fontName='Helvetica-Bold', fontSize=8, textColor=T3,
                            leading=12, letterSpacing=1.5),
    'cover_title': S('ctitle', fontName='Helvetica-Bold', fontSize=24,
                              textColor=NAVY, leading=30, spaceAfter=6),
    'cover_sub':   S('csub', fontName='Helvetica', fontSize=13, textColor=NAVY,
                             leading=18, spaceAfter=8),
    'cover_ver':   S('cver', fontName='Helvetica', fontSize=9, textColor=T3,
                             leading=14, spaceAfter=20),
}

def rule(color=BORD, t=0.5, before=4, after=12):
    return HRFlowable(width='100%', thickness=t, color=color,
                      spaceBefore=before, spaceAfter=after)

def sp(n=8): return Spacer(1, n)

def tbl(data, widths=None, header=True):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    cmds = [
        ('FONTNAME',     (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE',     (0,0), (-1,-1), 9),
        ('TEXTCOLOR',    (0,0), (-1,-1), T1),
        ('VALIGN',       (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('GRID',         (0,0), (-1,-1), 0.4, BORD),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [white, HexColor('#f9f9f9')]),
    ]
    if header:
        cmds += [
            ('BACKGROUND',  (0,0), (-1,0), NAVY),
            ('TEXTCOLOR',   (0,0), (-1,0), white),
            ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',    (0,0), (-1,0), 8.5),
        ]
    t.setStyle(TableStyle(cmds))
    return t

# ── Page callback ─────────────────────────────────────────────────────────────
def make_page_cb(doc_title, version, label):
    def cb(c, doc):
        c.saveState()
        w, h = letter
        r = 0.165*inch
        cx, cy = 0.52*inch, h - 0.56*inch
        # Seal
        c.setFillColor(white); c.setStrokeColor(NAVY); c.setLineWidth(r*0.12)
        c.circle(cx, cy, r, fill=1, stroke=1)
        c.setStrokeColor(HexColor('#1d1a3b')); c.setLineWidth(0.3)
        c.circle(cx, cy, r*0.82, fill=0, stroke=1)
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', r*26)
        c.drawCentredString(cx, cy - r*0.26, 'SA')
        # Header text
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 9)
        c.drawString(0.78*inch, h - 0.52*inch, 'SENTINEL AUTHORITY')
        c.setFillColor(T3); c.setFont('Helvetica', 7.5)
        c.drawRightString(w - 0.5*inch, h - 0.52*inch, f'{doc_title}  ·  {version}')
        # Header rule
        c.setStrokeColor(NAVY); c.setLineWidth(0.6)
        c.line(0.5*inch, h - 0.72*inch, w - 0.5*inch, h - 0.72*inch)
        # Footer rule
        c.setStrokeColor(BORD); c.setLineWidth(0.4)
        c.line(0.5*inch, 0.52*inch, w - 0.5*inch, 0.52*inch)
        c.setFillColor(T3); c.setFont('Helvetica', 6.5)
        c.drawString(0.5*inch, 0.36*inch, 'SENTINEL AUTHORITY  ·  ODD Conformance Determination')
        c.drawCentredString(w/2, 0.36*inch, label)
        c.drawRightString(w-0.5*inch, 0.36*inch, f'Page {doc.page}')
        c.restoreState()
    return cb

def build_doc(story, out_path, doc_title, version, label):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=1.0*inch, bottomMargin=0.75*inch,
        title=doc_title, author='Sentinel Authority')
    cb = make_page_cb(doc_title, version, label)
    doc.build(story, onFirstPage=cb, onLaterPages=cb)
    buf.seek(0)
    with open(out_path, 'wb') as f:
        f.write(buf.read())

# ── Text cleaning ─────────────────────────────────────────────────────────────
NOISE = re.compile(
    r'^(SA|SENTINEL AUTHORITY.*|Page \d+|.*ODD Conformance Determination.*'
    r'|.*CONFIDENTIAL.*|.*PUBLIC DOCUMENT.*|.*WHITE PAPER.*'
    r'|ODDC Certification Guide · v.*|ODDC Overview · v.*'
    r'|ENVELO Requirements · v.*|CAT-72 Procedure · v.*'
    r'|ODDC Scenarios · v.*|ODDC Critical QA · v.*'
    r'|ODDC Scenarios · v.*|When Self-Certification Fails · v.*'
    r'|The Accountability Chain · v.*|The Insurance Imperative · v.*'
    r'|Ten Domains.*· v.*|Process vs.*· v.*)$'
)

def clean_lines(text):
    lines = []
    for line in text.split('\n'):
        line = line.strip()
        if not line: continue
        if NOISE.match(line): continue
        # Fix broken escape sequences
        line = line.replace('\\222', "'").replace('\\227', '—')
        line = line.replace('\\177', '·').replace('\\(', '(').replace('\\)', ')')
        lines.append(line)
    return lines

def is_section(line):
    return bool(re.match(r'^\d+\.\s+[A-Z]', line))

def is_subsection(line):
    return bool(re.match(r'^\d+\.\d+\s+', line))

def is_bullet(line):
    return line.startswith('·') or line.startswith('•') or line.startswith('—')

def is_table_header(line, next_line=''):
    # Short lines that look like column headers
    words = line.split()
    return (len(words) <= 4 and len(line) < 40 and
            next_line and len(next_line.split()) <= 4)

def lines_to_story(lines, cover_prefix):
    story = list(cover_prefix)
    i = 0
    while i < len(lines):
        line = lines[i]

        if is_section(line):
            story.append(Paragraph(line, ST['h1']))
        elif is_subsection(line):
            story.append(Paragraph(line, ST['h2']))
        elif is_bullet(line):
            text = line.lstrip('·•— ').strip()
            story.append(Paragraph(f'&nbsp;&nbsp;&nbsp;• {text}', ST['bullet']))
        elif line.isupper() and len(line) < 60 and len(line.split()) <= 5:
            story.append(sp(4))
            story.append(Paragraph(line, ST['label']))
        else:
            story.append(Paragraph(line, ST['body']))
        i += 1
    return story

def cover(doc_type, title, subtitle, version, public=True):
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    return [
        sp(24),
        Paragraph(doc_type, ST['cover_type']),
        sp(6),
        Paragraph(title, ST['cover_title']),
        Paragraph(subtitle, ST['cover_sub']),
        rule(NAVY, t=1.0, before=6, after=6),
        Paragraph(f'Version {version}  ·  {datetime.now().strftime("%B %Y")}  ·  {label}', ST['cover_ver']),
        sp(16),
    ]

# ── Load extracted text ────────────────────────────────────────────────────────
with open('/tmp/pdf_text.json') as f:
    RAW = json.load(f)

def get_lines(name):
    pages = RAW.get(name, [])
    all_lines = []
    for page_text in pages:
        all_lines.extend(clean_lines(page_text))
    return all_lines

# ── Build each document ────────────────────────────────────────────────────────
DOCS = [
    # (src_name, out_rel, doc_type, title, subtitle, version, public)
    ('ODDC_Overview_v3.0.pdf',
     'docs/ODDC_Overview_v3.0.pdf',
     'FRAMEWORK DOCUMENT', 'ODDC Overview',
     'ODD Conformance Determination Framework', 'v3.0', True),
    ('ODDC_Overview_v2.0.pdf',
     'docs/ODDC_Overview_v2.0.pdf',
     'FRAMEWORK DOCUMENT', 'ODDC Overview',
     'ODD Conformance Determination Framework', 'v2.0', True),
    ('ENVELO_Requirements_v3.0.pdf',
     'docs/ENVELO_Requirements_v3.0.pdf',
     'TECHNICAL SPECIFICATION', 'ENVELO Requirements',
     'Enforced Non-Violable Execution-Limit Override', 'v3.0', False),
    ('ENVELO_Requirements_v2.0.pdf',
     'docs/ENVELO_Requirements_v2.0.pdf',
     'TECHNICAL SPECIFICATION', 'ENVELO Requirements',
     'Enforced Non-Violable Execution-Limit Override', 'v2.0', False),
    ('ENVELO_Requirements_v1.0.pdf',
     'docs/ENVELO_Requirements_v1.0.pdf',
     'TECHNICAL SPECIFICATION', 'ENVELO Requirements',
     'Enforced Non-Violable Execution-Limit Override', 'v1.0', False),
    ('CAT-72_Procedure_v4.0.pdf',
     'docs/CAT-72_Procedure_v4.0.pdf',
     'TESTING PROCEDURE', 'CAT-72 Procedure',
     'Conformance Assessment Test', 'v4.0', False),
    ('CAT-72_Procedure_v3.0.pdf',
     'docs/CAT-72_Procedure_v3.0.pdf',
     'TESTING PROCEDURE', 'CAT-72 Procedure',
     'Conformance Assessment Test', 'v3.0', False),
    ('CAT-72_Procedure_v2.0.pdf',
     'docs/CAT-72_Procedure_v2.0.pdf',
     'TESTING PROCEDURE', 'CAT-72 Procedure',
     'Conformance Assessment Test', 'v2.0', False),
    ('CAT-72_Procedure_v1.0.pdf',
     'docs/CAT-72_Procedure_v1.0.pdf',
     'TESTING PROCEDURE', 'CAT-72 Procedure',
     'Conformance Assessment Test', 'v1.0', False),
    ('ODDC_Critical_QA_v3.0.pdf',
     'docs/ODDC_Critical_QA_v3.0.pdf',
     'QA DOCUMENT', 'ODDC Critical QA',
     'Quality Assurance Checklist', 'v3.0', False),
    ('ODDC_Critical_QA_v2.0.pdf',
     'docs/ODDC_Critical_QA_v2.0.pdf',
     'QA DOCUMENT', 'ODDC Critical QA',
     'Quality Assurance Checklist', 'v2.0', False),
    ('ODDC_Critical_QA_v1.0.pdf',
     'docs/ODDC_Critical_QA_v1.0.pdf',
     'QA DOCUMENT', 'ODDC Critical QA',
     'Quality Assurance Checklist', 'v1.0', False),
    ('ODDC_Scenarios_v3.0.pdf',
     'docs/ODDC_Scenarios_v3.0.pdf',
     'REFERENCE DOCUMENT', 'ODDC Scenarios',
     'Conformance Scenario Library', 'v3.0', True),
    ('ODDC_Scenarios_v2.0.pdf',
     'docs/ODDC_Scenarios_v2.0.pdf',
     'REFERENCE DOCUMENT', 'ODDC Scenarios',
     'Conformance Scenario Library', 'v2.0', True),
    ('ODDC_Scenarios_v1.0.pdf',
     'docs/ODDC_Scenarios_v1.0.pdf',
     'REFERENCE DOCUMENT', 'ODDC Scenarios',
     'Conformance Scenario Library', 'v1.0', True),
    ('ODDC_Certification_Guide_v5.0.pdf',
     'docs/ODDC_Certification_Guide_v5.0.pdf',
     'PROCESS GUIDE', 'ODDC Certification Guide',
     'Complete Process Guide', 'v5.0', True),
    ('ODDC_Certification_Guide_v4.0.pdf',
     'docs/ODDC_Certification_Guide_v4.0.pdf',
     'PROCESS GUIDE', 'ODDC Certification Guide',
     'Complete Process Guide', 'v4.0', True),
    ('ODDC_Certification_Guide_v3.pdf',
     'downloads/ODDC_Certification_Guide_v3.pdf',
     'PROCESS GUIDE', 'ODDC Certification Guide',
     'Complete Process Guide', 'v3.0', True),
    ('The_Accountability_Chain.pdf',
     'publications/The_Accountability_Chain.pdf',
     'WHITE PAPER', 'The Accountability Chain',
     'Why Autonomous System Liability Requires Independent Conformance Evidence', 'v1.0', True),
    ('The_Insurance_Imperative.pdf',
     'publications/The_Insurance_Imperative.pdf',
     'WHITE PAPER', 'The Insurance Imperative',
     'How Conformance Evidence Enables Autonomous System Coverage', 'v1.0', True),
    ('Ten_Domains_Zero_Standards.pdf',
     'publications/Ten_Domains_Zero_Standards.pdf',
     'WHITE PAPER', 'Ten Domains, Zero Standards',
     'The Autonomous System Certification Gap', 'v1.0', True),
    ('Process_vs_Behavioral_Attestation.pdf',
     'publications/Process_vs_Behavioral_Attestation.pdf',
     'WHITE PAPER', 'Process vs. Behavioral Attestation',
     'Why Development Process Certification Is Insufficient for Autonomous Systems', 'v1.0', True),
    ('Sentinel_Authority_When_Self-Certification_Fails.pdf',
     'Sentinel_Authority_When_Self-Certification_Fails.pdf',
     'WHITE PAPER', 'When Self-Certification Fails',
     'The Case for Independent Conformance Determination', 'v1.0', True),
]

errors = []
for (src_name, out_rel, doc_type, title, subtitle, version, public) in DOCS:
    out = os.path.join(BASE, out_rel)
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    try:
        lines = get_lines(src_name)
        cov = cover(doc_type, title, subtitle, version, public)
        story = lines_to_story(lines, cov)
        build_doc(story, out, title, version, label)
        print(f'  ✓ {out_rel}')
    except Exception as e:
        print(f'  ✗ {out_rel}: {e}')
        errors.append((out_rel, str(e)))

print(f'\nDone. {len(errors)} errors.')
