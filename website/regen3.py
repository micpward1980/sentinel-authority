"""
Sentinel Authority — PDF Regenerator v3
Matches the SA White Paper reference design exactly.
"""
import os, re, json
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, PageBreak, KeepTogether, Frame, BaseDocTemplate,
    PageTemplate)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable

BASE = os.path.dirname(os.path.abspath(__file__))
NAVY  = HexColor('#1d1a3b')
SLATE = HexColor('#4a5568')
GREEN = HexColor('#2e844a')
BORD  = HexColor('#dddbda')
BG    = HexColor('#fafafa')
CALLOUT_BG   = HexColor('#f0f4f8')
CALLOUT_BORD = HexColor('#c5cdd6')
T1    = HexColor('#181818')
T2    = HexColor('#3d3d3d')
T3    = HexColor('#888888')
W, H  = letter

def S(name, **kw):
    d = dict(fontName='Helvetica', fontSize=10, leading=15,
             textColor=T1, spaceAfter=6, spaceBefore=0)
    d.update(kw)
    return ParagraphStyle(name, **d)

ST = {
    'cover_title': S('ct', fontName='Helvetica-Bold', fontSize=26,
                          textColor=T1, leading=32, spaceAfter=8),
    'cover_sub':   S('cs', fontName='Helvetica', fontSize=14,
                          textColor=SLATE, leading=20, spaceAfter=6),
    'cover_date':  S('cd', fontName='Helvetica', fontSize=10,
                          textColor=T3, leading=15, spaceAfter=0),
    'abstract':    S('ab', fontName='Helvetica-Bold', fontSize=10.5,
                          textColor=T1, leading=16, spaceAfter=0),
    'h1':    S('h1', fontName='Helvetica-Bold', fontSize=13,
                     textColor=T1, spaceBefore=22, spaceAfter=8, leading=18),
    'h2':    S('h2', fontName='Helvetica-Bold', fontSize=11,
                     textColor=T1, spaceBefore=14, spaceAfter=5, leading=15),
    'h3':    S('h3', fontName='Helvetica-Bold', fontSize=10,
                     textColor=T1, spaceBefore=10, spaceAfter=3, leading=14),
    'body':  S('body', leading=15, spaceAfter=8, alignment=TA_JUSTIFY),
    'bullet':S('bul', leftIndent=16, spaceAfter=4, leading=15,
                      alignment=TA_JUSTIFY),
    'bq':    S('bq', fontName='Helvetica-Bold', fontSize=10.5,
                     textColor=T1, leading=16, leftIndent=0,
                     spaceBefore=12, spaceAfter=12, alignment=TA_JUSTIFY),
    'ref_h': S('rh', fontName='Helvetica-Bold', fontSize=10,
                     textColor=T1, spaceBefore=18, spaceAfter=6),
    'ref':   S('ref', fontSize=9, leading=14, textColor=T2,
                      leftIndent=18, spaceAfter=3, alignment=TA_JUSTIFY),
    'footer_note': S('fn', fontSize=8, textColor=T3, leading=13,
                          spaceBefore=12, spaceAfter=0, alignment=TA_JUSTIFY),
    'table_cell':  S('tc', fontSize=9, leading=13, textColor=T1, spaceAfter=0),
    'end':   S('end', fontName='Helvetica-Bold', fontSize=10, textColor=T3,
                      alignment=TA_CENTER, spaceBefore=20, spaceAfter=0),
}

def sp(n=8): return Spacer(1, n)
def rule(c=BORD, t=0.5, b=4, a=10):
    return HRFlowable(width='100%', thickness=t, color=c, spaceBefore=b, spaceAfter=a)

class CalloutBox(Flowable):
    def __init__(self, text, w):
        Flowable.__init__(self)
        self.text = text
        self._w = w
        self.height = 0
    def wrap(self, aw, ah):
        from reportlab.platypus import Paragraph
        p = Paragraph(self.text, ST['abstract'])
        _, h = p.wrap(self._w - 0.48*inch, ah)
        self.height = h + 0.36*inch
        self.width = self._w
        return self._w, self.height
    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(CALLOUT_BG)
        c.setStrokeColor(CALLOUT_BORD)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self._w, self.height, 4, fill=1, stroke=1)
        from reportlab.platypus import Paragraph
        p = Paragraph(self.text, ST['abstract'])
        pw = self._w - 0.48*inch
        _, ph = p.wrap(pw, 9999)
        p.drawOn(c, 0.24*inch, (self.height - ph) / 2)
        c.restoreState()

def page_cb(doc_title, version, label):
    def cb(c, doc):
        c.saveState()
        r = 0.155*inch
        cx, cy = 0.5*inch, H - 0.54*inch
        # Seal
        c.setFillColor(white); c.setStrokeColor(NAVY); c.setLineWidth(r*0.12)
        c.circle(cx, cy, r, fill=1, stroke=1)
        c.setStrokeColor(HexColor('#1d1a3b')); c.setLineWidth(0.28)
        c.circle(cx, cy, r*0.82, fill=0, stroke=1)
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', r*25)
        c.drawCentredString(cx, cy - r*0.25, 'SA')
        # Name
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 8.5)
        c.drawString(0.74*inch, H - 0.50*inch, 'SENTINEL AUTHORITY')
        # Right: doc title
        c.setFillColor(T3); c.setFont('Helvetica', 8)
        c.drawRightString(W - 0.5*inch, H - 0.50*inch, doc_title)
        # Rule
        c.setStrokeColor(NAVY); c.setLineWidth(0.5)
        c.line(0.5*inch, H - 0.70*inch, W - 0.5*inch, H - 0.70*inch)
        # Footer
        c.setStrokeColor(BORD); c.setLineWidth(0.4)
        c.line(0.5*inch, 0.5*inch, W - 0.5*inch, 0.5*inch)
        c.setFillColor(T3); c.setFont('Helvetica', 6.5)
        c.drawString(0.5*inch, 0.34*inch, 'SENTINEL AUTHORITY  ·  ODD Conformance Determination')
        c.drawCentredString(W/2, 0.34*inch, label)
        c.drawRightString(W - 0.5*inch, 0.34*inch, f'Page {doc.page}')
        c.restoreState()
    return cb

def build(story, path, title, version, label):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=0.95*inch, bottomMargin=0.72*inch,
        title=title, author='Sentinel Authority')
    cb = page_cb(title, version, label)
    doc.build(story, onFirstPage=cb, onLaterPages=cb)
    buf.seek(0)
    with open(path, 'wb') as f: f.write(buf.read())

# ── Parser ─────────────────────────────────────────────────────────────────────
NOISE = re.compile(
    r'^(SA\s*$|SENTINEL AUTHORITY\s*$'
    r'|SENTINEL AUTHORITY\s+[—–-].*'
    r'|Page \d+\s*$'
    r'|.*ODD Conformance Determination\s*$'
    r'|.*\bCONFIDENTIAL\b.*'
    r'|.*\bPUBLIC\b\s*$'
    r'|.*\bPUBLIC DOCUMENT\b.*'
    r'|ODDC Certification Guide · v.*'
    r'|ODDC Overview · v.*'
    r'|ENVELO Requirements · v.*'
    r'|CAT-72 Procedure · v.*'
    r'|ODDC Scenarios · v.*'
    r'|ODDC Critical QA · v.*'
    r'|When Self-Certification Fails · v.*'
    r'|The Accountability Chain · v.*'
    r'|The Insurance Imperative · v.*'
    r'|Ten Domains.*· v.*'
    r'|Process vs.*· v.*)$'
)

def clean(text):
    lines = []
    for ln in text.split('\n'):
        ln = ln.strip()
        if not ln or NOISE.match(ln): continue
        ln = (ln.replace('\u2019',"'").replace('\u2014','—')
               .replace('\u2022','·').replace('\u00b7','·')
               .replace('\\222',"'").replace('\\227','—')
               .replace('\\177','·').replace('\\226','–'))
        lines.append(ln)
    return lines

def is_h1(ln): return bool(re.match(r'^\d+\.\s+[A-Z]', ln))
def is_h2(ln): return bool(re.match(r'^\d+\.\d+\s+\S', ln))
def is_h3(ln): return bool(re.match(r'^\d+\.\d+\.\d+\s+\S', ln))
def is_bullet(ln): return ln.startswith('·') or ln.startswith('•')
def is_end(ln): return bool(re.match(r'^[—–-]\s*End of Document\s*[—–-]', ln, re.I))
def is_ref_item(ln): return bool(re.match(r'^\d+\.\s+', ln))

TABLE_SEPARATORS = re.compile(r'\s{3,}|\t')

def looks_like_table_row(ln, next_ln=''):
    parts = TABLE_SEPARATORS.split(ln)
    return len(parts) >= 2 and max(len(p) for p in parts) < 120

def parse_table_block(lines, start):
    """Collect consecutive table-like lines."""
    rows = []
    i = start
    while i < len(lines):
        ln = lines[i]
        if looks_like_table_row(ln):
            parts = [p.strip() for p in TABLE_SEPARATORS.split(ln) if p.strip()]
            rows.append(parts)
            i += 1
        elif ln == '' or (not looks_like_table_row(ln) and len(rows) > 1):
            break
        else:
            break
    return rows, i

def detect_abstract(lines):
    """First paragraph of 2+ sentences that reads like a summary."""
    for i, ln in enumerate(lines[:8]):
        if len(ln) > 100 and ln[0].isdigit() == False and not is_h1(ln):
            return ln, i
    return None, -1

BW = W - 1.2*inch  # body width

def lines_to_story(all_lines, title, subtitle, version, public, doc_type):
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    date_str = datetime.now().strftime('%B %Y')
    pub_label = 'Public Document' if public else 'Confidential'

    # Find cover content: title line, subtitle line, date line, abstract
    story = []

    # Cover
    story.append(sp(20))
    story.append(Paragraph(title, ST['cover_title']))
    story.append(Paragraph(subtitle, ST['cover_sub']))
    story.append(Paragraph(f'{date_str} — {pub_label}', ST['cover_date']))
    story.append(rule(NAVY, t=0.8, b=10, a=10))

    # Find abstract: first long non-header line in extracted text
    abstract_text = None
    body_start = 0
    for i, ln in enumerate(all_lines):
        if (len(ln) > 120 and not is_h1(ln) and not is_h2(ln)
                and not ln.startswith('Field') and not ln.startswith('Version')
                and ln[0].isupper()):
            abstract_text = ln
            body_start = i + 1
            break

    if abstract_text:
        story.append(CalloutBox(abstract_text, BW))
        story.append(sp(16))

    # Body
    lines = all_lines[body_start:]
    i = 0
    in_refs = False

    while i < len(lines):
        ln = lines[i]
        if not ln:
            i += 1
            continue

        if is_end(ln):
            story.append(sp(20))
            story.append(Paragraph('— End of Document —', ST['end']))
            i += 1
            continue

        if ln == 'References' or re.match(r'^References\s*$', ln):
            story.append(Paragraph('References', ST['h1']))
            in_refs = True
            i += 1
            continue

        if in_refs:
            if is_ref_item(ln):
                # Collect multi-line ref
                ref_text = ln
                while i+1 < len(lines) and lines[i+1] and not is_ref_item(lines[i+1]):
                    i += 1
                    ref_text += ' ' + lines[i]
                story.append(Paragraph(ref_text, ST['ref']))
            elif len(ln) > 40:
                story.append(Paragraph(ln, ST['footer_note']))
            i += 1
            continue

        if is_h3(ln):
            story.append(Paragraph(ln, ST['h3']))
            i += 1
            continue

        if is_h2(ln):
            story.append(Paragraph(ln, ST['h2']))
            i += 1
            continue

        if is_h1(ln):
            story.append(Paragraph(ln, ST['h1']))
            i += 1
            continue

        if is_bullet(ln):
            text = ln.lstrip('·•– ').strip()
            # Collect continuation lines
            while i+1 < len(lines) and lines[i+1] and not is_bullet(lines[i+1]) and not is_h1(lines[i+1]) and not is_h2(lines[i+1]) and not looks_like_table_row(lines[i+1]):
                parts_next = TABLE_SEPARATORS.split(lines[i+1])
                if len(parts_next) >= 2: break
                i += 1
                text += ' ' + lines[i]
            story.append(Paragraph(f'&nbsp;&nbsp;&nbsp;&nbsp;• {text}', ST['bullet']))
            i += 1
            continue

        # Table detection: current line + next have multi-column pattern
        if (looks_like_table_row(ln) and i+1 < len(lines)
                and (looks_like_table_row(lines[i+1]) or not lines[i+1])):
            # Collect table rows
            rows = []
            j = i
            while j < len(lines) and lines[j] and looks_like_table_row(lines[j]):
                parts = [p.strip() for p in TABLE_SEPARATORS.split(lines[j]) if p.strip()]
                rows.append(parts)
                j += 1

            if len(rows) >= 2:
                # Normalize column count
                ncols = max(len(r) for r in rows)
                norm = []
                for r in rows:
                    while len(r) < ncols: r.append('')
                    norm.append([Paragraph(c, ST['table_cell']) for c in r[:ncols]])

                # Column widths
                cw = BW / ncols
                if ncols == 2:
                    col_widths = [BW*0.28, BW*0.72]
                elif ncols == 3:
                    col_widths = [BW*0.28, BW*0.30, BW*0.42]
                else:
                    col_widths = [BW/ncols]*ncols

                t = Table(norm, colWidths=col_widths, repeatRows=1)
                cmds = [
                    ('FONTNAME',  (0,0),(-1,-1),'Helvetica'),
                    ('FONTSIZE',  (0,0),(-1,-1),9),
                    ('TEXTCOLOR', (0,0),(-1,-1),T1),
                    ('VALIGN',    (0,0),(-1,-1),'TOP'),
                    ('TOPPADDING',(0,0),(-1,-1),5),
                    ('BOTTOMPADDING',(0,0),(-1,-1),5),
                    ('LEFTPADDING',(0,0),(-1,-1),8),
                    ('RIGHTPADDING',(0,0),(-1,-1),8),
                    ('GRID',      (0,0),(-1,-1),0.4,BORD),
                    ('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f9f9f9')]),
                    ('BACKGROUND',(0,0),(-1,0),NAVY),
                    ('TEXTCOLOR', (0,0),(-1,0),white),
                    ('FONTNAME',  (0,0),(-1,0),'Helvetica-Bold'),
                    ('FONTSIZE',  (0,0),(-1,0),8.5),
                ]
                t.setStyle(TableStyle(cmds))
                story.append(sp(6))
                story.append(t)
                story.append(sp(10))
                i = j
                continue

        # Block quote detection: short sentence in quotes or bold-style emphasis
        if (len(ln) > 60 and (ln.startswith('"') or ln.startswith('\u201c')
                or re.match(r'^"', ln))):
            story.append(sp(8))
            story.append(CalloutBox(ln, BW))
            story.append(sp(8))
            i += 1
            continue

        # Regular body — join continuation lines
        body_text = ln
        while (i+1 < len(lines) and lines[i+1]
               and not is_h1(lines[i+1]) and not is_h2(lines[i+1])
               and not is_h3(lines[i+1]) and not is_bullet(lines[i+1])
               and not looks_like_table_row(lines[i+1])
               and not lines[i+1].startswith('"')
               and len(body_text) < 600):
            i += 1
            body_text += ' ' + lines[i]

        story.append(Paragraph(body_text, ST['body']))
        i += 1

    return story

# ── Load text ─────────────────────────────────────────────────────────────────
with open('/tmp/pdf_text.json') as f:
    RAW = json.load(f)

def get_lines(name):
    pages = RAW.get(name, [])
    all_lines = []
    for page_text in pages:
        all_lines.extend(clean(page_text))
    return all_lines

DOCS = [
    ('ODDC_Overview_v3.0.pdf',           'docs/ODDC_Overview_v3.0.pdf',
     'ODDC Overview', 'ODD Conformance Determination Framework', 'v3.0', True),
    ('ODDC_Overview_v2.0.pdf',           'docs/ODDC_Overview_v2.0.pdf',
     'ODDC Overview', 'ODD Conformance Determination Framework', 'v2.0', True),
    ('ENVELO_Requirements_v3.0.pdf',     'docs/ENVELO_Requirements_v3.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v3.0', False),
    ('ENVELO_Requirements_v2.0.pdf',     'docs/ENVELO_Requirements_v2.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v2.0', False),
    ('ENVELO_Requirements_v1.0.pdf',     'docs/ENVELO_Requirements_v1.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v1.0', False),
    ('CAT-72_Procedure_v4.0.pdf',        'docs/CAT-72_Procedure_v4.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v4.0', False),
    ('CAT-72_Procedure_v3.0.pdf',        'docs/CAT-72_Procedure_v3.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v3.0', False),
    ('CAT-72_Procedure_v2.0.pdf',        'docs/CAT-72_Procedure_v2.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v2.0', False),
    ('CAT-72_Procedure_v1.0.pdf',        'docs/CAT-72_Procedure_v1.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v1.0', False),
    ('ODDC_Critical_QA_v3.0.pdf',        'docs/ODDC_Critical_QA_v3.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v3.0', False),
    ('ODDC_Critical_QA_v2.0.pdf',        'docs/ODDC_Critical_QA_v2.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v2.0', False),
    ('ODDC_Critical_QA_v1.0.pdf',        'docs/ODDC_Critical_QA_v1.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v1.0', False),
    ('ODDC_Scenarios_v3.0.pdf',          'docs/ODDC_Scenarios_v3.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v3.0', True),
    ('ODDC_Scenarios_v2.0.pdf',          'docs/ODDC_Scenarios_v2.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v2.0', True),
    ('ODDC_Scenarios_v1.0.pdf',          'docs/ODDC_Scenarios_v1.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v1.0', True),
    ('ODDC_Certification_Guide_v5.0.pdf','docs/ODDC_Certification_Guide_v5.0.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v5.0', True),
    ('ODDC_Certification_Guide_v4.0.pdf','docs/ODDC_Certification_Guide_v4.0.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v4.0', True),
    ('ODDC_Certification_Guide_v3.pdf',  'downloads/ODDC_Certification_Guide_v3.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v3.0', True),
    ('The_Accountability_Chain.pdf',     'publications/The_Accountability_Chain.pdf',
     'The Accountability Chain',
     'Why Autonomous System Liability Requires Independent Conformance Evidence', 'v1.0', True),
    ('The_Insurance_Imperative.pdf',     'publications/The_Insurance_Imperative.pdf',
     'The Insurance Imperative',
     'How Conformance Evidence Enables Autonomous System Coverage', 'v1.0', True),
    ('Ten_Domains_Zero_Standards.pdf',   'publications/Ten_Domains_Zero_Standards.pdf',
     'Ten Domains, Zero Standards', 'The Autonomous System Certification Gap', 'v1.0', True),
    ('Process_vs_Behavioral_Attestation.pdf','publications/Process_vs_Behavioral_Attestation.pdf',
     'Process vs. Behavioral Attestation',
     'Why Development Process Certification Is Insufficient for Autonomous Systems','v1.0',True),
    ('Sentinel_Authority_When_Self-Certification_Fails.pdf',
     'Sentinel_Authority_When_Self-Certification_Fails.pdf',
     'When Self-Certification Fails',
     'The Case for Independent Conformance Determination', 'v1.0', True),
]

errors = []
for (src, out_rel, title, subtitle, version, public) in DOCS:
    out = os.path.join(BASE, out_rel)
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    try:
        lines = get_lines(src)
        story = lines_to_story(lines, title, subtitle, version, public, '')
        build(story, out, title, version, label)
        print(f'  ✓ {out_rel}')
    except Exception as e:
        import traceback
        print(f'  ✗ {out_rel}: {e}')
        traceback.print_exc()
        errors.append((out_rel, str(e)))

print(f'\nDone. {len(errors)} errors.')
