#!/bin/bash
# ══════════════════════════════════════════════════════════
#  ENVELO — One-Command Installer Bootstrap
#  Sentinel Authority © 2026
#
#  Usage:
#    curl -sSL https://get.sentinelauthority.org | bash
#
#  Or with credentials pre-set:
#    ENVELO_CERTIFICATE_ID=ODDC-2026-00042 \
#    ENVELO_API_KEY=sa_live_xxxxx \
#    curl -sSL https://get.sentinelauthority.org | bash
# ══════════════════════════════════════════════════════════

set -e

PURPLE='\033[35m'
GREEN='\033[92m'
YELLOW='\033[93m'
RED='\033[91m'
CYAN='\033[96m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

INSTALLER_URL="https://get.sentinelauthority.org/envelo_install.py"
CLI_URL="https://get.sentinelauthority.org/envelo_cli.py"

# Check for Python 3
find_python() {
    for cmd in python3 python; do
        if command -v "$cmd" &>/dev/null; then
            version=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
            major=$("$cmd" -c "import sys; print(sys.version_info.major)" 2>/dev/null)
            minor=$("$cmd" -c "import sys; print(sys.version_info.minor)" 2>/dev/null)
            if [ "$major" -ge 3 ] && [ "$minor" -ge 7 ] 2>/dev/null; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    return 1
}

PYTHON=$(find_python)

if [ -z "$PYTHON" ]; then
    echo ""
    echo -e "  ${RED}${BOLD}Python 3.7+ is required but not found.${RESET}"
    echo ""
    echo -e "  Install Python and try again:"
    echo -e "    ${CYAN}Ubuntu/Debian:${RESET}  sudo apt install python3"
    echo -e "    ${CYAN}macOS:${RESET}          brew install python3"
    echo -e "    ${CYAN}Fedora/RHEL:${RESET}    sudo dnf install python3"
    echo -e "    ${CYAN}Windows:${RESET}        python.org/downloads"
    echo ""
    exit 1
fi

# Download and run installer
TMPFILE=$(mktemp /tmp/envelo_install.XXXXXX.py)
trap "rm -f $TMPFILE" EXIT

if command -v curl &>/dev/null; then
    curl -sSL "$INSTALLER_URL" -o "$TMPFILE" 2>/dev/null
elif command -v wget &>/dev/null; then
    wget -q "$INSTALLER_URL" -O "$TMPFILE" 2>/dev/null
else
    # Fallback: use Python to download
    "$PYTHON" -c "
import urllib.request, sys
try:
    urllib.request.urlretrieve('$INSTALLER_URL', '$TMPFILE')
except Exception as e:
    print(f'  Cannot download installer: {e}')
    sys.exit(1)
"
fi

if [ ! -s "$TMPFILE" ]; then
    echo -e "  ${RED}Failed to download installer.${RESET}"
    echo -e "  Check your internet connection and try again."
    exit 1
fi

# Run it
"$PYTHON" "$TMPFILE"
