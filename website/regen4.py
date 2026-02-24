"""
Sentinel Authority — PDF Regenerator v4
Fixed paragraph joining, TOC skipping, spaced-header handling.
"""
import os, re, json
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, HRFlowable, PageBreak, KeepTogether)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable
import fitz

BASE = os.path.dirname(os.path.abspath(__file__))
NAVY  = HexColor('#1d1a3b')
SLATE = HexColor('#4a5568')
BORD  = HexColor('#dddbda')
BG    = HexColor('#fafafa')
CALLOUT_BG   = HexColor('#f0f4f8')
CALLOUT_BORD = HexColor('#c5cdd6')
T1 = HexColor('#181818')
T2 = HexColor('#3d3d3d')
T3 = HexColor('#888888')
W, H = letter

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
                          textColor=T1, leading=16, spaceAfter=0),
    'h1':    S('h1', fontName='Helvetica-Bold', fontSize=13, textColor=T1,
                     spaceBefore=22, spaceAfter=8, leading=18),
    'h2':    S('h2', fontName='Helvetica-Bold', fontSize=11, textColor=T1,
                     spaceBefore=14, spaceAfter=5, leading=15),
    'h3':    S('h3', fontName='Helvetica-Bold', fontSize=10.5, textColor=T1,
                     spaceBefore=10, spaceAfter=3, leading=14),
    'body':  S('body', leading=15, spaceAfter=9, alignment=TA_JUSTIFY),
    'bullet':S('bul', leftIndent=16, spaceAfter=4, leading=15, alignment=TA_JUSTIFY),
    'end':   S('end', fontName='Helvetica-Bold', fontSize=10, textColor=T3,
                      alignment=TA_CENTER, spaceBefore=24, spaceAfter=0),
    'ref':   S('ref', fontSize=9, leading=14, textColor=T2,
                      leftIndent=18, spaceAfter=4, alignment=TA_JUSTIFY),
    'footer_note': S('fn', fontSize=8, textColor=T3, leading=13,
                          spaceBefore=10, spaceAfter=0, alignment=TA_JUSTIFY),
    'tbl':   S('tbl', fontSize=9, leading=13, textColor=T1, spaceAfter=0),
    'tbl_h': S('tblh', fontName='Helvetica-Bold', fontSize=8.5,
                       textColor=white, leading=13, spaceAfter=0),
}

def sp(n=8): return Spacer(1, n)
def rule(c=BORD, t=0.5, b=4, a=10):
    return HRFlowable(width='100%', thickness=t, color=c, spaceBefore=b, spaceAfter=a)

BW = W - 1.2*inch

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
        c.restoreStore() if False else c.restoreState()

def page_cb(doc_title, label):
    def cb(c, doc):
        c.saveState()
        r = 0.155*inch
        cx, cy = 0.5*inch, H - 0.54*inch
        c.setFillColor(white); c.setStrokeColor(NAVY); c.setLineWidth(r*0.12)
        c.circle(cx, cy, r, fill=1, stroke=1)
        c.setStrokeColor(NAVY); c.setLineWidth(0.28)
        c.circle(cx, cy, r*0.82, fill=0, stroke=1)
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', r*25)
        c.drawCentredString(cx, cy - r*0.25, 'SA')
        c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 8.5)
        c.drawString(0.74*inch, H - 0.50*inch, 'SENTINEL AUTHORITY')
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

def build(story, path, title, label):
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
        topMargin=0.95*inch, bottomMargin=0.72*inch,
        title=title, author='Sentinel Authority')
    cb = page_cb(title, label)
    doc.build(story, onFirstPage=cb, onLaterPages=cb)
    buf.seek(0)
    with open(path, 'wb') as f: f.write(buf.read())

# ── Text extraction & paragraph assembly ──────────────────────────────────────

NOISE = re.compile(
    r'^(SA\s*$|SENTINEL AUTHORITY\s*$'
    r'|SENTINEL AUTHORITY\s+[•·—–].*'
    r'|\d{1,3}\s*$'
    r'|.*sentinelauthority\.org\s*$'
    r'|.*ODD Conformance Determination\s*$'
    r'|.*\bCONFIDENTIAL\b.*'
    r'|.*PUBLIC DOCUMENT.*'
    r'|W H I T E\s+P A P E R.*'
    r'|C O N T E N T S.*'
    r'|Sentinel Authority\s*$)$'
)

def is_h1(ln): return bool(re.match(r'^\d+\.\s+[A-Z\u201c"]', ln) and len(ln) < 100)
def is_h2(ln): return bool(re.match(r'^\d+\.\d+\s+[A-Z\u201c"]', ln) and len(ln) < 100)
def is_h3(ln): return bool(re.match(r'^\d+\.\d+\.\d+\s+\S', ln) and len(ln) < 100)
def is_bullet(ln): return ln.startswith('·') or ln.startswith('•') or ln.startswith('—  ')
def is_end(ln): return bool(re.match(r'^[—–-]\s*End of Document', ln, re.I))
def is_ref_start(ln): return bool(re.match(r'^References\s*$', ln))
def is_ref_item(ln): return bool(re.match(r'^\d+\.\s+[A-Z"]', ln))
def is_toc_item(ln): return bool(re.match(r'^\d+\.\d*\s+\S', ln) and len(ln) < 60)

def ends_sentence(ln):
    return ln.rstrip().endswith(('.', '?', '!', ':', '"', '\u201d'))

def extract_paragraphs(pdf_path):
    """
    Extract text from PDF, join wrapped lines into full paragraphs,
    and return a list of (type, text) tuples.
    type: 'h1','h2','h3','body','bullet','abstract','toc','end','ref','footer'
    """
    doc = fitz.open(pdf_path)
    raw_pages = [page.get_text() for page in doc]
    doc.close()

    # Step 1: collect all raw lines, strip noise
    raw_lines = []
    for page_text in raw_pages:
        for ln in page_text.split('\n'):
            ln = ln.strip()
            ln = (ln.replace('\u2019',"'").replace('\u2014','—')
                   .replace('\u2022','·').replace('\u00b7','·')
                   .replace('\u201c','"').replace('\u201d','"')
                   .replace('\u2013','–').replace('\u2026','...'))
            if not ln or NOISE.match(ln):
                continue
            raw_lines.append(ln)

    # Step 2: identify TOC block and skip it
    # TOC: a run of lines that all look like section refs (short, numbered)
    in_toc = False
    filtered = []
    i = 0
    while i < len(raw_lines):
        ln = raw_lines[i]
        # Detect TOC start
        if ln in ('Contents', 'CONTENTS', 'Table of Contents'):
            # Skip until we hit a non-TOC line followed by body content
            i += 1
            while i < len(raw_lines):
                if is_toc_item(raw_lines[i]) or raw_lines[i] in ('Contents','CONTENTS'):
                    i += 1
                else:
                    break
            continue
        # Skip standalone repeated title lines (appear as running header in old PDFs)
        if i > 0 and ln == raw_lines[0].strip():
            i += 1
            continue
        filtered.append(ln)
        i += 1

    # Step 3: join wrapped lines into paragraphs
    # A line is a continuation if:
    # - previous line does NOT end a sentence
    # - this line does NOT start a new heading/bullet
    # - this line starts with lowercase or mid-word
    paragraphs = []  # list of (type, text)
    i = 0
    while i < len(filtered):
        ln = filtered[i]

        if is_end(ln):
            paragraphs.append(('end', '— End of Document —'))
            i += 1
            continue

        if is_ref_start(ln):
            paragraphs.append(('h1', 'References'))
            i += 1
            # Collect refs
            while i < len(filtered):
                rln = filtered[i]
                if is_ref_item(rln):
                    ref_text = rln
                    i += 1
                    # join continuation
                    while i < len(filtered) and not is_ref_item(filtered[i]) and not is_h1(filtered[i]):
                        ref_text += ' ' + filtered[i]
                        i += 1
                    paragraphs.append(('ref', ref_text))
                elif len(rln) > 40:
                    paragraphs.append(('footer', rln))
                    i += 1
                else:
                    i += 1
            continue

        if is_h3(ln):
            paragraphs.append(('h3', ln)); i += 1; continue
        if is_h2(ln):
            paragraphs.append(('h2', ln)); i += 1; continue
        if is_h1(ln):
            paragraphs.append(('h1', ln)); i += 1; continue

        if is_bullet(ln):
            text = re.sub(r'^[·•—]\s*', '', ln).strip()
            i += 1
            while i < len(filtered):
                nxt = filtered[i]
                if (is_h1(nxt) or is_h2(nxt) or is_h3(nxt) or is_bullet(nxt)
                        or ends_sentence(text)):
                    break
                text += ' ' + nxt
                i += 1
            paragraphs.append(('bullet', text))
            continue

        # Body paragraph — join until sentence ends or structural break
        text = ln
        i += 1
        while i < len(filtered):
            nxt = filtered[i]
            if (is_h1(nxt) or is_h2(nxt) or is_h3(nxt) or is_bullet(nxt)
                    or is_end(nxt) or is_ref_start(nxt)):
                break
            # Stop joining if text ends a sentence AND next line starts a new one
            if ends_sentence(text) and nxt and nxt[0].isupper():
                # Could be new paragraph — check if previous was long enough
                if len(text) > 80:
                    break
            text += ' ' + nxt
            i += 1
        paragraphs.append(('body', text))

    return paragraphs

def make_story(paras, title, subtitle, version, public):
    label = 'PUBLIC DOCUMENT' if public else 'CONFIDENTIAL'
    date_str = datetime.now().strftime('%B %Y')
    pub_label = 'Public Document' if public else 'Confidential'
    story = []

    # Cover
    story += [
        sp(20),
        Paragraph(title, ST['cover_title']),
        Paragraph(subtitle, ST['cover_sub']),
        Paragraph(f'{date_str} — {pub_label}', ST['cover_date']),
        rule(NAVY, t=0.8, b=10, a=14),
    ]

    # Find and extract abstract (first body paragraph > 150 chars before first h1)
    abstract_done = False
    body_items = []

    for ptype, ptext in paras:
        if not abstract_done and ptype == 'body' and len(ptext) > 150:
            # Check it's before first h1
            story.append(CalloutBox(ptext))
            story.append(sp(14))
            abstract_done = True
            continue
        if ptype == 'h1':
            abstract_done = True  # stop looking for abstract

        body_items.append((ptype, ptext))

    # Build body
    in_refs = False
    for ptype, ptext in body_items:
        if ptype == 'h1':
            if ptext == 'References':
                in_refs = True
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
        else:  # body
            # Check if it looks like a callout (starts with quote or bold assertion)
            if ptext.startswith('"') and len(ptext) > 60:
                story += [sp(6), CalloutBox(ptext), sp(6)]
            else:
                story.append(Paragraph(ptext, ST['body']))

    return story

# ── Document list ──────────────────────────────────────────────────────────────
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
        paras = extract_paragraphs(src)
        story = make_story(paras, title, subtitle, version, public)
        build(story, path, title, label)
        print(f'  ✓ {rel}  ({len(paras)} paragraphs)')
    except Exception as e:
        import traceback
        print(f'  ✗ {rel}: {e}')
        traceback.print_exc()
        errors.append((rel, str(e)))

print(f'\nDone. {len(errors)} errors.')
