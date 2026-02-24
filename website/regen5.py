"""
Sentinel Authority — PDF Regenerator v5
Uses fitz.find_tables() for accurate table extraction.
Fixes paragraph joining and cover noise.
"""
import os, re
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, PageBreak, KeepTogether)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
import fitz

BASE = os.path.dirname(os.path.abspath(__file__))
NAVY  = HexColor('#1d1a3b')
SLATE = HexColor('#4a5568')
BORD  = HexColor('#dddbda')
CALLOUT_BG   = HexColor('#f0f4f8')
CALLOUT_BORD = HexColor('#c5cdd6')
T1 = HexColor('#181818')
T2 = HexColor('#3d3d3d')
T3 = HexColor('#888888')
W, H = letter
BW = W - 1.2*inch

def S(name, **kw):
    d = dict(fontName='Helvetica', fontSize=10, leading=15, textColor=T1,
             spaceAfter=6, spaceBefore=0)
    d.update(kw)
    return ParagraphStyle(name, **d)

ST = {
    'cover_title': S('ct', fontName='Helvetica-Bold', fontSize=26,
                          textColor=T1, leading=32, spaceAfter=8),
    'cover_sub':   S('cs', fontName='Helvetica', fontSize=13,
                          textColor=SLATE, leading=19, spaceAfter=6),
    'cover_date':  S('cd', fontName='Helvetica', fontSize=9.5,
                          textColor=T3, leading=14, spaceAfter=0),
    'abstract':    S('ab', fontName='Helvetica-Bold', fontSize=10.5,
                          textColor=T1, leading=16.5, spaceAfter=0),
    'h1':    S('h1', fontName='Helvetica-Bold', fontSize=13, textColor=T1,
                     spaceBefore=22, spaceAfter=8, leading=18),
    'h2':    S('h2', fontName='Helvetica-Bold', fontSize=11, textColor=T1,
                     spaceBefore=14, spaceAfter=5, leading=15),
    'h3':    S('h3', fontName='Helvetica-Bold', fontSize=10.5, textColor=T1,
                     spaceBefore=10, spaceAfter=3, leading=14),
    'body':  S('body', leading=15, spaceAfter=9, alignment=TA_JUSTIFY),
    'bullet':S('bul', leftIndent=16, spaceAfter=4, leading=15, alignment=TA_JUSTIFY),
    'end':   S('end', fontName='Helvetica-Bold', fontSize=10, textColor=T3,
                      alignment=TA_JUSTIFY.__class__.__mro__[0].__subclasses__()[0] if False else 1,
                      spaceBefore=24, spaceAfter=0),
    'ref':   S('ref', fontSize=9, leading=14, textColor=T2,
                      leftIndent=18, spaceAfter=4, alignment=TA_JUSTIFY),
    'footer_note': S('fn', fontSize=8, textColor=T3, leading=13,
                          spaceBefore=10, spaceAfter=0, alignment=TA_JUSTIFY),
    'tbl':   S('tbl', fontSize=9, leading=13, textColor=T1, spaceAfter=0),
    'tbl_h': S('tblh', fontName='Helvetica-Bold', fontSize=8.5,
                       textColor=white, leading=13, spaceAfter=0),
}
# Fix end style alignment
ST['end'] = S('end', fontName='Helvetica-Bold', fontSize=10, textColor=T3,
              alignment=1, spaceBefore=24, spaceAfter=0)

def sp(n=8): return Spacer(1, n)
def rule(c=BORD, t=0.5, b=4, a=10):
    return HRFlowable(width='100%', thickness=t, color=c, spaceBefore=b, spaceAfter=a)

class CalloutBox(Flowable):
    def __init__(self, text, width=None):
        Flowable.__init__(self)
        self._text = text
        self._w = width or BW
    def wrap(self, aw, ah):
        p = Paragraph(self._text, ST['abstract'])
        _, h = p.wrap(self._w - 0.5*inch, ah)
        self.height = h + 0.4*inch
        self.width = self._w
        return self._w, self.height
    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(CALLOUT_BG)
        c.setStrokeColor(CALLOUT_BORD)
        c.setLineWidth(0.5)
        c.roundRect(0, 0, self._w, self.height, 4, fill=1, stroke=1)
        p = Paragraph(self._text, ST['abstract'])
        pw = self._w - 0.5*inch
        _, ph = p.wrap(pw, 9999)
        p.drawOn(c, 0.25*inch, (self.height - ph)/2)
        c.restoreState()

WORDMARK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    '../backend/app/services/sa-wordmark.png')

def page_cb(doc_title, label):
    def cb(c, doc):
        c.saveState()
        from reportlab.lib.utils import ImageReader
        wm_w = 1.8*inch
        wm_h = wm_w * (240/920)
        c.drawImage(ImageReader(WORDMARK_PATH), 0.5*inch, H - 0.62*inch,
                    width=wm_w, height=wm_h, mask='auto')
        c.setFillColor(T3); c.setFont('Helvetica', 8)
        c.drawRightString(W - 0.5*inch, H - 0.50*inch, doc_title)
        c.setStrokeColor(NAVY); c.setLineWidth(0.5)
        c.line(0.5*inch, H - 0.70*inch, W - 0.5*inch, H - 0.70*inch)
        c.setStrokeColor(BORD); c.setLineWidth(0.4)
        c.line(0.5*inch, 0.5*inch, W - 0.5*inch, 0.5*inch)
        c.setFillColor(T3); c.setFont('Helvetica', 6.5)
        c.drawString(0.5*inch, 0.34*inch, 'SENTINEL AUTHORITY  ·  ODD Conformance Determination')
        c.drawCentredString(W/2, 0.34*inch, label)
        c.drawRightString(W - 0.5*inch, 0.34*inch, f'Page {doc.page}')
        c.restoreState()
    return cb

def build_pdf(story, path, title, label):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=0.95*inch, bottomMargin=0.72*inch,
        title=title, author='Sentinel Authority')
    cb = page_cb(title, label)
    def cb_later(c, doc, _dt=title, _lb=label):
        c.saveState()
        c.setFillColor(T3); c.setFont('Helvetica', 8)
        c.drawRightString(W - 0.5*inch, H - 0.50*inch, _dt)
        c.setStrokeColor(NAVY); c.setLineWidth(0.5)
        c.line(0.5*inch, H - 0.70*inch, W - 0.5*inch, H - 0.70*inch)
        c.setStrokeColor(BORD); c.setLineWidth(0.4)
        c.line(0.5*inch, 0.5*inch, W - 0.5*inch, 0.5*inch)
        c.setFillColor(T3); c.setFont('Helvetica', 6.5)
        c.drawString(0.5*inch, 0.34*inch, 'SENTINEL AUTHORITY  ·  ODD Conformance Determination')
        c.drawCentredString(W/2, 0.34*inch, _lb)
        c.drawRightString(W - 0.5*inch, 0.34*inch, f'Page {doc.page}')
        c.restoreState()
    doc.build(story, onFirstPage=cb, onLaterPages=cb_later)
    buf.seek(0)
    with open(path, 'wb') as f: f.write(buf.read())

def make_table(rows):
    """Convert extracted table rows to ReportLab table."""
    if not rows: return None
    ncols = max(len(r) for r in rows)
    
    def clean_cell(c):
        if c is None: return ''
        c = str(c).strip()
        c = c.replace('\x13', '✓').replace('\u2013', '–').replace('\u2014', '—')
        c = c.replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
        return c

    norm = []
    for i, row in enumerate(rows):
        style = ST['tbl_h'] if i == 0 else ST['tbl']
        cells = []
        for j in range(ncols):
            val = clean_cell(row[j] if j < len(row) else '')
            cells.append(Paragraph(val, style))
        norm.append(cells)

    # Column widths
    if ncols == 1:
        col_widths = [BW]
    elif ncols == 2:
        col_widths = [BW*0.28, BW*0.72]
    elif ncols == 3:
        col_widths = [BW*0.32, BW*0.33, BW*0.35]
    elif ncols == 4:
        col_widths = [BW*0.18, BW*0.20, BW*0.25, BW*0.37]
    elif ncols == 5:
        col_widths = [BW*0.20, BW*0.16, BW*0.16, BW*0.16, BW*0.32]
    else:
        col_widths = [BW/ncols]*ncols

    t = Table(norm, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('FONTNAME',      (0,0),(-1,-1), 'Helvetica'),
        ('FONTSIZE',      (0,0),(-1,-1), 9),
        ('TEXTCOLOR',     (0,0),(-1,-1), T1),
        ('VALIGN',        (0,0),(-1,-1), 'TOP'),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
        ('GRID',          (0,0),(-1,-1), 0.4, BORD),
        ('ROWBACKGROUNDS',(0,1),(-1,-1), [white, HexColor('#f9f9f9')]),
        ('BACKGROUND',    (0,0),(-1,0), NAVY),
        ('TEXTCOLOR',     (0,0),(-1,0), white),
        ('FONTNAME',      (0,0),(-1,0), 'Helvetica-Bold'),
    ]))
    return t

# ── Text + table extraction ────────────────────────────────────────────────────

NOISE = re.compile(
    r'^(SA\s*$'
    r'|SENTINEL AUTHORITY\s*$'
    r'|SENTINEL AUTHORITY\s+[•·—–].*'
    r'|\d{1,3}\s*$'
    r'|.*sentinelauthority\.org\s*$'
    r'|.*ODD Conformance Determination\s*$'
    r'|.*\bCONFIDENTIAL\b.*'
    r'|.*[Pp]ublic [Dd]ocument.*'
    r'|Version\s+[\d\.]+\s+[—–].*'
    r'|Version\s+[\d\.]+\s+—.*'
    r'|W\s*H\s*I\s*T\s*E\s+P\s*A\s*P\s*E\s*R.*'
    r'|C\s*O\s*N\s*T\s*E\s*N\s*T\s*S.*'
    r'|Sentinel Authority\s*$)$',
    re.IGNORECASE
)

def is_h1(ln): return bool(re.match(r'^\d+\.\s+[A-Z\u201c"]', ln) and len(ln) < 100)
def is_h2(ln): return bool(re.match(r'^\d+\.\d+\s+[A-Z\u201c"]', ln) and len(ln) < 100)
def is_h3(ln): return bool(re.match(r'^\d+\.\d+\.\d+\s+\S', ln) and len(ln) < 100)
def is_bullet(ln): return ln.startswith('·') or ln.startswith('•') or re.match(r'^[—–]\s{2}', ln)
def is_end(ln): return bool(re.match(r'^[—–-]\s*End of Document', ln, re.I))
def is_ref_start(ln): return bool(re.match(r'^References\s*$', ln))
def is_ref_item(ln): return bool(re.match(r'^\d+\.\s+[A-Z"]', ln))
def is_toc_item(ln): return bool(re.match(r'^\d+\.[\d\.]*\s+\S', ln) and len(ln) < 70)
def ends_sentence(ln): return ln.rstrip().endswith(('.', '?', '!', ':', '"', '\u201d', ')'))

def clean_ln(ln):
    return (ln.replace('\u2019',"'").replace('\u2014','—').replace('\u2022','·')
              .replace('\u00b7','·').replace('\u201c','"').replace('\u201d','"')
              .replace('\u2013','–').replace('\u2026','...').replace('\x13','✓'))

def extract(pdf_path):
    """
    Returns list of page items. Each item is either:
      ('text', text_string)  or  ('table', [[row], [row], ...])
    Items are in reading order per page.
    """
    doc = fitz.open(pdf_path)
    all_items = []  # (sort_key, type, content)

    for page_num, page in enumerate(doc):
        page_rect = page.rect

        # Get table bounding boxes so we can exclude those regions from text
        tables = page.find_tables()
        table_rects = []
        table_items = []
        if tables and tables.tables:
            for tbl in tables.tables:
                r = tbl.bbox
                table_rects.append(r)
                rows = tbl.extract()
                if rows and len(rows) >= 1:
                    table_items.append((r[1], 'table', rows))  # sort by y0

        # Get text blocks, excluding table regions
        blocks = page.get_text('blocks')  # (x0,y0,x1,y1,text,block_no,block_type)
        for b in blocks:
            x0,y0,x1,y1,text,bno,btype = b
            if btype != 0: continue  # skip image blocks
            # Skip header zone (top 58pt) and footer zone (bottom 50pt) on all pages
            page_h = page_rect.height
            if y1 < 58 or y0 > page_h - 50:
                continue
            # Check if this block overlaps with a table rect
            overlaps = False
            for tr in table_rects:
                if not (x1 < tr[0] or x0 > tr[2] or y1 < tr[1] or y0 > tr[3]):
                    overlaps = True
                    break
            if overlaps: continue
            if text.strip():
                all_items.append((page_num * 10000 + y0, 'text_block', text))

        for item in table_items:
            all_items.append((page_num * 10000 + item[0], 'table', item[2]))

    all_items.sort(key=lambda x: x[0])

    # Now parse text blocks into lines and join into paragraphs
    result = []  # list of ('para'|'table', content)

    raw_lines = []
    for _, itype, content in all_items:
        if itype == 'table':
            # Flush accumulated text lines first
            if raw_lines:
                result.append(('lines', raw_lines[:]))
                raw_lines = []
            result.append(('table', content))
        else:
            for ln in content.split('\n'):
                ln = clean_ln(ln.strip())
                if not ln or NOISE.match(ln): continue
                raw_lines.append(ln)

    if raw_lines:
        result.append(('lines', raw_lines))

    doc.close()
    return result

def parse_lines(raw_lines):
    """Convert raw lines into structured paragraphs."""
    # Remove TOC: detect 4+ consecutive toc-like items
    toc_indices = set()
    i = 0
    while i < len(raw_lines):
        if is_toc_item(raw_lines[i]):
            start = i
            while i < len(raw_lines) and is_toc_item(raw_lines[i]):
                i += 1
            if i - start >= 4:
                toc_indices.update(range(start, i))
        else:
            i += 1

    lines = [ln for i, ln in enumerate(raw_lines) if i not in toc_indices]

    # Remove duplicate title lines (running headers in old PDFs)
    title_line = lines[0] if lines else ''
    lines = [ln for i, ln in enumerate(lines) if i == 0 or ln != title_line]

    paragraphs = []
    i = 0
    in_refs = False

    while i < len(lines):
        ln = lines[i]

        if is_end(ln):
            paragraphs.append(('end', '— End of Document —'))
            i += 1
            continue

        if is_ref_start(ln):
            paragraphs.append(('h1', 'References'))
            in_refs = True
            i += 1
            continue

        if in_refs:
            if is_ref_item(ln):
                text = ln
                i += 1
                while i < len(lines) and not is_ref_item(lines[i]) and not is_h1(lines[i]):
                    text += ' ' + lines[i]
                    i += 1
                paragraphs.append(('ref', text))
            elif len(ln) > 40:
                paragraphs.append(('footer', ln))
                i += 1
            else:
                i += 1
            continue

        if is_h3(ln): paragraphs.append(('h3', ln)); i += 1; continue
        if is_h2(ln): paragraphs.append(('h2', ln)); i += 1; continue
        if is_h1(ln): paragraphs.append(('h1', ln)); i += 1; continue

        if is_bullet(ln):
            text = re.sub(r'^[·•—–]\s*', '', ln).strip()
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if is_h1(nxt) or is_h2(nxt) or is_h3(nxt) or is_bullet(nxt) or ends_sentence(text):
                    break
                text += ' ' + nxt
                i += 1
            paragraphs.append(('bullet', text))
            continue

        # Body paragraph
        text = ln
        i += 1
        while i < len(lines):
            nxt = lines[i]
            if (is_h1(nxt) or is_h2(nxt) or is_h3(nxt) or is_bullet(nxt)
                    or is_end(nxt) or is_ref_start(nxt)):
                break
            if ends_sentence(text) and nxt and nxt[0].isupper() and len(text) > 80:
                break
            text += ' ' + nxt
            i += 1
        paragraphs.append(('body', text))

    return paragraphs

def make_story(items, title, subtitle, version, public):
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    date_str = datetime.now().strftime('%B %Y')
    pub_label = 'Public Document' if public else 'Confidential'

    story = [
        sp(20),
        Paragraph(title, ST['cover_title']),
        Paragraph(subtitle, ST['cover_sub']),
        Paragraph(f'{date_str} — {pub_label}', ST['cover_date']),
        rule(NAVY, t=0.8, b=10, a=14),
    ]

    # Parse all text blocks into paragraphs, interleave with tables
    all_content = []  # list of ('para', ptype, text) or ('table', rows)
    for itype, content in items:
        if itype == 'table':
            all_content.append(('table', content))
        else:
            for ptype, ptext in parse_lines(content):
                all_content.append(('para', ptype, ptext))

    # Extract abstract: first long body paragraph before first h1
    abstract_done = False
    body_content = []
    for item in all_content:
        if item[0] == 'para' and item[1] == 'h1':
            abstract_done = True
        if not abstract_done and item[0] == 'para' and item[1] == 'body' and len(item[2]) > 150:
            story.append(CalloutBox(item[2]))
            story.append(sp(14))
            abstract_done = True
            continue
        body_content.append(item)

    # Build body
    for item in body_content:
        if item[0] == 'table':
            rows = item[1]
            t = make_table(rows)
            if t:
                story += [sp(6), t, sp(10)]
        else:
            _, ptype, ptext = item
            if ptype == 'h1':
                story.append(Paragraph(ptext, ST['h1']))
            elif ptype == 'h2':
                story.append(Paragraph(ptext, ST['h2']))
            elif ptype == 'h3':
                story.append(Paragraph(ptext, ST['h3']))
            elif ptype == 'bullet':
                story.append(Paragraph(f'&nbsp;&nbsp;&nbsp;• {ptext}', ST['bullet']))
            elif ptype == 'end':
                story += [sp(20), Paragraph('— End of Document —', ST['end'])]
            elif ptype == 'ref':
                story.append(Paragraph(ptext, ST['ref']))
            elif ptype == 'footer':
                story.append(Paragraph(ptext, ST['footer_note']))
            else:
                if ptext.startswith('"') and len(ptext) > 60:
                    story += [sp(6), CalloutBox(ptext), sp(6)]
                else:
                    story.append(Paragraph(ptext, ST['body']))

    return story

DOCS = [
    ('docs/ODDC_Overview_v3.0.pdf',
     'ODDC Overview', 'ODD Conformance Determination Framework', 'v3.0', True),
    ('docs/ODDC_Overview_v2.0.pdf',
     'ODDC Overview', 'ODD Conformance Determination Framework', 'v2.0', True),
    ('docs/ENVELO_Requirements_v3.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v3.0', False),
    ('docs/ENVELO_Requirements_v2.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v2.0', False),
    ('docs/ENVELO_Requirements_v1.0.pdf',
     'ENVELO Requirements', 'Enforced Non-Violable Execution-Limit Override', 'v1.0', False),
    ('docs/CAT-72_Procedure_v4.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v4.0', False),
    ('docs/CAT-72_Procedure_v3.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v3.0', False),
    ('docs/CAT-72_Procedure_v2.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v2.0', False),
    ('docs/CAT-72_Procedure_v1.0.pdf',
     'CAT-72 Procedure', 'Conformance Assessment Test', 'v1.0', False),
    ('docs/ODDC_Critical_QA_v3.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v3.0', False),
    ('docs/ODDC_Critical_QA_v2.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v2.0', False),
    ('docs/ODDC_Critical_QA_v1.0.pdf',
     'ODDC Critical QA', 'Quality Assurance Checklist', 'v1.0', False),
    ('docs/ODDC_Scenarios_v3.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v3.0', True),
    ('docs/ODDC_Scenarios_v2.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v2.0', True),
    ('docs/ODDC_Scenarios_v1.0.pdf',
     'ODDC Scenarios', 'Conformance Scenario Library', 'v1.0', True),
    ('docs/ODDC_Certification_Guide_v5.0.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v5.0', True),
    ('docs/ODDC_Certification_Guide_v4.0.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v4.0', True),
    ('downloads/ODDC_Certification_Guide_v3.pdf',
     'ODDC Certification Guide', 'Complete Process Guide', 'v3.0', True),
    ('publications/The_Accountability_Chain.pdf',
     'The Accountability Chain',
     'Why Autonomous System Liability Requires Independent Conformance Evidence', 'v1.0', True),
    ('publications/The_Insurance_Imperative.pdf',
     'The Insurance Imperative',
     'How Conformance Evidence Enables Autonomous System Coverage', 'v1.0', True),
    ('publications/Ten_Domains_Zero_Standards.pdf',
     'Ten Domains, Zero Standards', 'The Autonomous System Certification Gap', 'v1.0', True),
    ('publications/Process_vs_Behavioral_Attestation.pdf',
     'Process vs. Behavioral Attestation',
     'Why Development Process Certification Is Insufficient for Autonomous Systems', 'v1.0', True),
    ('Sentinel_Authority_When_Self-Certification_Fails.pdf',
     'When Self-Certification Fails',
     'The Case for Independent Conformance Determination', 'v1.0', True),
]

errors = []
for (rel, title, subtitle, version, public) in DOCS:
    path = os.path.join(BASE, rel)
    bak  = path + '.colorbak'
    src  = bak if os.path.exists(bak) else path
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    try:
        items = extract(src)
        story = make_story(items, title, subtitle, version, public)
        build_pdf(story, path, title, label)
        n_tables = sum(1 for i in items if i[0] == 'table')
        print(f'  ✓ {rel}  ({n_tables} tables)')
    except Exception as e:
        import traceback
        print(f'  ✗ {rel}: {e}')
        traceback.print_exc()
        errors.append((rel, str(e)))

print(f'\nDone. {len(errors)} errors.')
