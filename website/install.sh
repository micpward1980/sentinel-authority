#!/bin/bash
# ENVELO Agent Installer
# Sentinel Authority - https://sentinelauthority.org

set -e

clear
echo ""
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║                                                           ║"
echo "  ║             ENVELO Agent Installer v1.0                   ║"
echo "  ║                  Sentinel Authority                       ║"
echo "  ║                                                           ║"
echo "  ║     Runtime enforcement for ODDC-certified systems        ║"
echo "  ║                                                           ║"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check Python
echo "  Checking requirements..."
echo ""

if ! command -v python3 &> /dev/null; then
    echo "  ❌ Python 3 is required but not installed."
    echo ""
    echo "     Please install Python 3.9 or higher and try again."
    echo "     Visit: https://www.python.org/downloads/"
    echo ""
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "  ✓ Python $PYTHON_VERSION detected"
echo ""

# Get configuration
echo "  ─────────────────────────────────────────────────────────────"
echo ""
echo "  Enter your credentials from the Sentinel Authority dashboard."
echo "  (Find these at: https://app.sentinelauthority.org/envelo)"
echo ""

read -p "  Certificate ID: " CERT_ID
echo ""
read -p "  API Key: " API_KEY
echo ""

if [ -z "$CERT_ID" ] || [ -z "$API_KEY" ]; then
    echo "  ❌ Both Certificate ID and API Key are required."
    echo ""
    exit 1
fi

# Validate API key format
if [[ ! "$API_KEY" =~ ^sa_live_ ]]; then
    echo "  ⚠️  Warning: API key should start with 'sa_live_'"
    echo ""
fi

# Create install directory
INSTALL_DIR="$HOME/.envelo"
echo "  ─────────────────────────────────────────────────────────────"
echo ""
echo "  Installing ENVELO Agent..."
echo ""

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "  📦 Downloading agent package..."
curl -sSL https://www.sentinelauthority.org/downloads/envelo-agent-v1.0.0.zip -o envelo-agent.zip 2>/dev/null
unzip -q -o envelo-agent.zip
rm envelo-agent.zip

echo "  📦 Installing dependencies..."
pip3 install httpx --quiet 2>/dev/null || pip3 install httpx --quiet --break-system-packages 2>/dev/null

# Create config file
cat > config.env << CONF
ENVELO_CERTIFICATE_ID=$CERT_ID
ENVELO_API_KEY=$API_KEY
ENVELO_API_ENDPOINT=https://sentinel-authority-production.up.railway.app
CONF

# Create example script
cat > example.py << 'EXAMPLE'
#!/usr/bin/env python3
"""
ENVELO Agent - Example Usage
Run this file to test your ENVELO Agent installation.
"""

import sys
import os

# Add ENVELO to path
sys.path.insert(0, os.path.expanduser('~/.envelo/envelo-agent'))

# Load config
from dotenv import load_dotenv
load_dotenv(os.path.expanduser('~/.envelo/config.env'))

from envelo import EnveloAgent, EnveloConfig, NumericBoundary

# Initialize agent
config = EnveloConfig(
    certificate_id=os.environ.get('ENVELO_CERTIFICATE_ID'),
    api_key=os.environ.get('ENVELO_API_KEY'),
    api_endpoint=os.environ.get('ENVELO_API_ENDPOINT', 'https://sentinel-authority-production.up.railway.app')
)

agent = EnveloAgent(config)

# Define boundaries (your ODD)
agent.add_boundary(NumericBoundary("speed", min=0, max=100, unit="km/h"))
agent.add_boundary(NumericBoundary("temperature", min=-20, max=50, unit="celsius"))

print("ENVELO Agent initialized!")
print(f"Certificate: {config.certificate_id}")
print("")

# Example: Enforce a function
@agent.enforce
def move_vehicle(speed, temperature):
    """This function is protected by ENVELO"""
    print(f"  Moving at {speed} km/h, temp: {temperature}°C")
    return True

# Test within boundaries (should PASS)
print("Test 1: Within boundaries (speed=50, temp=25)")
try:
    move_vehicle(speed=50, temperature=25)
    print("  ✓ Action allowed\n")
except Exception as e:
    print(f"  ✗ Blocked: {e}\n")

# Test outside boundaries (should BLOCK)
print("Test 2: Outside boundaries (speed=150, temp=25)")
try:
    move_vehicle(speed=150, temperature=25)
    print("  ✓ Action allowed\n")
except Exception as e:
    print(f"  ✗ Blocked: {e}\n")

# Shutdown
print("Shutting down agent...")
agent.shutdown()
print("Done! Check your dashboard for telemetry.")
EXAMPLE

chmod +x example.py

echo ""
echo "  ═══════════════════════════════════════════════════════════"
echo ""
echo "  ✅ ENVELO Agent installed successfully!"
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo "  Location:     ~/.envelo"
echo "  Certificate:  $CERT_ID"
echo "  ─────────────────────────────────────────────────────────────"
echo ""
echo "  QUICK TEST:"
echo ""
echo "    pip3 install python-dotenv"
echo "    python3 ~/.envelo/example.py"
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo ""
echo "  INTEGRATE INTO YOUR CODE:"
echo ""
echo "    import sys"
echo "    sys.path.insert(0, '$INSTALL_DIR/envelo-agent')"
echo "    from envelo import EnveloAgent, EnveloConfig, NumericBoundary"
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo ""
echo "  📊 Dashboard:  https://app.sentinelauthority.org/envelo"
echo "  📚 Docs:       https://sentinelauthority.org/agent.html"
echo "  📧 Support:    conformance@sentinelauthority.org"
echo ""
echo "  ═══════════════════════════════════════════════════════════"
echo ""
