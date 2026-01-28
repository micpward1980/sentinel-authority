"""
ENVELO Agent Generator
Creates pre-configured agents for customers
"""

from datetime import datetime


def generate_provisioned_agent(cert, api_key: str) -> str:
    """Generate a fully configured ENVELO agent launcher for a customer"""
    
    cert_num = cert.certificate_number
    system_name = cert.system_name or "Unknown"
    org_name = cert.organization_name or "Unknown"
    
    return f'''#!/usr/bin/env python3
"""
ENVELO Agent - Sentinel Authority
System: {system_name}
Certificate: {cert_num}
Organization: {org_name}

Just run: python {f"envelo_agent_{cert_num}.py"}
"""

import os, sys, subprocess, signal, time, threading, uuid
from datetime import datetime

API_KEY = "{api_key}"
CERT = "{cert_num}"
ENDPOINT = "https://sentinel-authority-production.up.railway.app"
SYSTEM = "{system_name}"
ORG = "{org_name}"

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

class EnveloAgent:
    def __init__(self):
        self.boundaries = {{}}
        self.session_id = None
        self.stats = {{"pass": 0, "block": 0}}
        self._running = False
    
    def start(self):
        self.session_id = str(uuid.uuid4())
        print(f"[ENVELO] Starting agent for {{SYSTEM}}...")
        
        try:
            res = requests.get(f"{{ENDPOINT}}/api/envelo/boundaries/config",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}}, timeout=10)
            if res.ok:
                for b in res.json().get("numeric_boundaries", []):
                    self.boundaries[b.get("parameter", b["name"])] = {{
                        "min": b.get("min_value"), "max": b.get("max_value"), "name": b["name"]
                    }}
                print(f"[ENVELO] Loaded {{len(self.boundaries)}} boundaries")
        except Exception as e:
            print(f"[ENVELO] Warning: {{e}}")
        
        try:
            requests.post(f"{{ENDPOINT}}/api/envelo/sessions",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{"session_id": self.session_id, "certificate_number": CERT,
                    "started_at": datetime.utcnow().isoformat() + "Z", "agent_version": "2.0.0"}}, timeout=10)
        except: pass
        
        self._running = True
        threading.Thread(target=self._heartbeat, daemon=True).start()
        print(f"[ENVELO] Session started: {{self.session_id[:8]}}...")
        return True
    
    def _heartbeat(self):
        while self._running:
            try:
                requests.post(f"{{ENDPOINT}}/api/envelo/heartbeat",
                    headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                    json={{"session_id": self.session_id}}, timeout=5)
            except: pass
            time.sleep(60)
    
    def check(self, **params):
        for p, v in params.items():
            if p in self.boundaries:
                b = self.boundaries[p]
                if b["min"] is not None and v < b["min"]:
                    self._block(p, v, f"below min {{b['min']}}")
                    return False
                if b["max"] is not None and v > b["max"]:
                    self._block(p, v, f"above max {{b['max']}}")
                    return False
        self.stats["pass"] += 1
        return True
    
    def _block(self, param, value, reason):
        self.stats["block"] += 1
        print(f"[ENVELO] BLOCKED: {{param}}={{value}} {{reason}}")
        try:
            requests.post(f"{{ENDPOINT}}/api/envelo/telemetry",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{"certificate_number": CERT, "session_id": self.session_id,
                    "records": [{{"timestamp": datetime.utcnow().isoformat()+"Z",
                        "action_type": "check", "result": "BLOCK",
                        "parameters": {{param: value}}}}]}}, timeout=5)
        except: pass
    
    def enforce(self, func):
        import functools, inspect
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            sig = inspect.signature(func)
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            if not self.check(**bound.arguments):
                print(f"[ENVELO] BLOCKED: {{func.__name__}}")
                return None
            return func(*args, **kwargs)
        return wrapper
    
    def stop(self):
        self._running = False
        try:
            requests.post(f"{{ENDPOINT}}/api/envelo/sessions/{{self.session_id}}/end",
                headers={{"Authorization": f"Bearer {{API_KEY}}"}},
                json={{"ended_at": datetime.utcnow().isoformat()+"Z",
                    "final_stats": self.stats}}, timeout=10)
        except: pass
        print(f"[ENVELO] Stopped. {{self.stats['pass']}} pass, {{self.stats['block']}} blocked")
    
    @property
    def is_running(self): return self._running

agent = EnveloAgent()

def _shutdown(s, f):
    print()
    agent.stop()
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)
    
    print("=" * 60)
    print(f"  ENVELO Agent - Sentinel Authority")
    print(f"  System: {{SYSTEM}}")
    print(f"  Certificate: {{CERT}}")
    print("=" * 60)
    
    if agent.start():
        print()
        print("Agent running. Press Ctrl+C to stop.")
        print()
        print("Usage in your code:")
        print(f"  from envelo_agent_{cert_num} import agent")
        print()
        print("  @agent.enforce")
        print("  def move(speed, temp):")
        print("      robot.move(speed)")
        print()
        while agent.is_running:
            time.sleep(1)
'''
