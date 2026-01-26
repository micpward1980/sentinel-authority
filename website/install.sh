#!/bin/bash
# ENVELO Agent Installer
# Sentinel Authority - https://sentinelauthority.org

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           ENVELO Agent Installer v1.0                     ║"
echo "║           Sentinel Authority                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "   Install Python 3.9+ and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✓ Python $PYTHON_VERSION detected"

# Get configuration
echo ""
read -p "Enter your ODDC Certificate ID (e.g., ODDC-2026-00001): " CERT_ID
read -p "Enter your API Key: " API_KEY

if [ -z "$CERT_ID" ] || [ -z "$API_KEY" ]; then
    echo "❌ Certificate ID and API Key are required."
    exit 1
fi

# Create install directory
INSTALL_DIR="$HOME/.envelo"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo ""
echo "📦 Downloading ENVELO Agent..."
curl -sSL https://www.sentinelauthority.org/downloads/envelo-agent-v1.0.0.zip -o envelo-agent.zip
unzip -q -o envelo-agent.zip
rm envelo-agent.zip

echo "📦 Installing dependencies..."
pip3 install httpx --quiet 2>/dev/null || pip3 install httpx --quiet --break-system-packages

# Create config file
cat > config.env << CONF
ENVELO_CERTIFICATE_ID=$CERT_ID
ENVELO_API_KEY=$API_KEY
ENVELO_API_ENDPOINT=https://api.sentinelauthority.org
CONF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ ENVELO Agent installed successfully!"
echo ""
echo "📁 Installed to: $INSTALL_DIR"
echo "🔑 Config saved: $INSTALL_DIR/config.env"
echo ""
echo "To use in your Python code:"
echo ""
echo "  import sys"
echo "  sys.path.insert(0, '$INSTALL_DIR/envelo-agent')"
echo "  from envelo import EnveloAgent, EnveloConfig, NumericBoundary"
echo ""
echo "  config = EnveloConfig("
echo "      certificate_id='$CERT_ID',"
echo "      api_key='$API_KEY'"
echo "  )"
echo "  agent = EnveloAgent(config)"
echo "  agent.add_boundary(NumericBoundary('speed', max=100))"
echo ""
echo "  @agent.enforce"
echo "  def my_action(speed):"
echo "      # Your code here"
echo "      pass"
echo ""
echo "📚 Documentation: https://sentinelauthority.org/agent.html"
echo "📧 Support: conformance@sentinelauthority.org"
echo "═══════════════════════════════════════════════════════════"
