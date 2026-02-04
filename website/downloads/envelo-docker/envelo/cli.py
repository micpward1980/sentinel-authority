#!/usr/bin/env python3
"""
ENVELO CLI — unified command-line interface.
    envelo setup       Deploy (interactive wizard)
    envelo status      Health check
    envelo diagnose    Support bundle
    envelo rollback    Remove ENVELO
    envelo version     Version info
"""
from __future__ import annotations
import argparse, signal, sys, textwrap
from pathlib import Path

def main():
    signal.signal(signal.SIGINT, lambda s, f: (print("\n\n  Cancelled.\n"), sys.exit(130)))
    parser = argparse.ArgumentParser(
        prog="envelo",
        description="ENVELO Agent — boundary enforcement for autonomous systems.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Quick start:
              envelo setup       Deploy the agent
              envelo status      Check health
              envelo diagnose    Support bundle
            Support: conformance@sentinelauthority.org
        """),
    )
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("setup", help="Deploy ENVELO (interactive wizard)")
    p.add_argument("--config", "-c", type=Path, default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", "-v", action="store_true")
    p.add_argument("--method", choices=["docker","binary","marketplace"], default=None)
    p.add_argument("--skip-service", action="store_true")
    p.add_argument("--non-interactive", "-y", action="store_true")

    p = sub.add_parser("status", help="Check deployment health")
    p.add_argument("--config", "-c", type=Path, default=None)
    p.add_argument("--verbose", "-v", action="store_true")

    p = sub.add_parser("diagnose", help="Generate support bundle")
    p.add_argument("--config", "-c", type=Path, default=None)
    p.add_argument("--verbose", "-v", action="store_true")

    p = sub.add_parser("rollback", help="Remove ENVELO")
    p.add_argument("--config", "-c", type=Path, default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", "-v", action="store_true")
    p.add_argument("--non-interactive", "-y", action="store_true")

    sub.add_parser("version", help="Show version")

    args = parser.parse_args()

    if not args.command:
        args.command = "setup"
        args.config = None; args.dry_run = False; args.verbose = False
        args.method = None; args.skip_service = False; args.non_interactive = False

    if args.command == "version":
        try: from envelo import __version__ as av
        except ImportError: av = "?"
        from envelo.genie import VERSION
        print(f"ENVELO Agent v{av}  |  Genie v{VERSION}"); sys.exit(0)

    from envelo.genie import EnveloGenie
    kw = {"config_path": getattr(args, "config", None),
          "verbose": getattr(args, "verbose", False)}

    if args.command == "setup":
        kw.update(dry_run=args.dry_run, deploy_method=args.method,
                  skip_service=args.skip_service, non_interactive=args.non_interactive)
        sys.exit(EnveloGenie(**kw).deploy())
    elif args.command == "status":
        sys.exit(EnveloGenie(**kw).status())
    elif args.command == "diagnose":
        sys.exit(EnveloGenie(**kw).diagnose())
    elif args.command == "rollback":
        kw.update(dry_run=getattr(args, "dry_run", False),
                  non_interactive=getattr(args, "non_interactive", False))
        sys.exit(EnveloGenie(**kw).rollback())

if __name__ == "__main__":
    main()
