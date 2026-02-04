#!/bin/bash
set -e
echo ""
echo "  ◉  ENVELO Agent Installer — Sentinel Authority"
echo ""
if ! command -v python3 &> /dev/null; then
    echo "  ✗ Python 3.9+ required"; exit 1
fi
echo "  ✓ Python $(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
INSTALL_DIR="$HOME/.envelo"
mkdir -p "$INSTALL_DIR" && cd "$INSTALL_DIR"
echo "  ↓ Downloading..."
curl -sSL https://www.sentinelauthority.org/downloads/envelo-agent-v2.0.0.zip -o agent.zip
unzip -q -o agent.zip && rm agent.zip
cd envelo-agent
pip3 install -e . --break-system-packages --quiet 2>/dev/null || pip3 install -e . --quiet
echo ""
echo "  ═══════════════════════════════════════════════"
echo "  ✓ ENVELO Agent installed!"
echo ""
echo "    Deploy:  envelo setup"
echo "    Health:  envelo status"
echo "    Help:    envelo --help"
echo "  ═══════════════════════════════════════════════"
