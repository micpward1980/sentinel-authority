#!/usr/bin/env python3
import os, re

SEO_BLOCK = '''
  <!-- Enhanced SEO -->
  <meta name="title" content="Sentinel Authority — ODDC Conformance for Autonomous Systems">
  <meta name="description" content="Sentinel Authority provides independent ODDC certification for autonomous vehicles, robotics, and AI systems. CAT-72 testing, ENVELO enforcement, and trusted third-party attestation for AV safety compliance.">
  <meta name="keywords" content="ODDC, autonomous vehicles, AV certification, self-driving car safety, robotics certification, AI safety, ODD conformance, CAT-72, ENVELO, autonomous systems, AV compliance, robotaxi certification, autonomous vehicle testing, safety attestation, ADS certification">
  <meta name="author" content="Sentinel Authority">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="https://www.sentinelauthority.org/">
  <meta name="language" content="English">
  <link rel="alternate" hreflang="en" href="https://www.sentinelauthority.org/">
  <link rel="alternate" hreflang="x-default" href="https://www.sentinelauthority.org/">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="Sentinel Authority">
  <meta name="geo.region" content="US">
  <meta name="distribution" content="Global">
  
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Organization","name":"Sentinel Authority","url":"https://www.sentinelauthority.org","logo":"https://www.sentinelauthority.org/og.png","description":"Independent conformance determination body for autonomous systems","areaServed":"Worldwide","contactPoint":{"@type":"ContactPoint","email":"info@sentinelauthority.org","contactType":"customer service"}}
  </script>
  
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Service","serviceType":"Autonomous Vehicle Certification","provider":{"@type":"Organization","name":"Sentinel Authority"},"name":"ODDC Conformance Certification","description":"72-hour continuous conformance testing with real-time ENVELO enforcement for autonomous vehicles and robotics.","areaServed":"Worldwide"}
  </script>
  
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is ODDC?","acceptedAnswer":{"@type":"Answer","text":"ODDC (Operational Design Domain Conformance) certifies autonomous systems operate within defined boundaries."}},{"@type":"Question","name":"What is CAT-72?","acceptedAnswer":{"@type":"Answer","text":"CAT-72 is a 72-hour continuous test monitoring autonomous system adherence to its Operational Design Domain."}},{"@type":"Question","name":"What is ENVELO?","acceptedAnswer":{"@type":"Answer","text":"ENVELO enforces ODD boundaries in real-time, preventing autonomous systems from operating outside certified domains."}}]}
  </script>
'''

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    if 'application/ld+json' in content:
        print(f"⚠ {filepath} already patched")
        return
    content = content.replace('<meta name="viewport" content="width=device-width,initial-scale=1.0" />', '<meta name="viewport" content="width=device-width,initial-scale=1.0" />' + SEO_BLOCK)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"✓ Patched {filepath}")

for f in ['index.html', 'scenarios.html', 'privacy.html', 'terms.html', 'conformance-agreement.html']:
    path = os.path.join(os.path.dirname(__file__), f)
    if os.path.exists(path):
        patch_file(path)
print("Done! Deploy with: git add . && git commit -m 'Maximize SEO' && git push")
