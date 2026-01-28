#!/usr/bin/env python3
"""
ENVELO Command Line Interface
"""

import sys
import argparse
import json
from . import EnveloAgent, __version__


def main():
    parser = argparse.ArgumentParser(
        description="ENVELO - Enforcer for Non-Violable Execution & Limit Oversight",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  envelo status                    Check agent configuration
  envelo test --speed 50           Test if parameters pass boundaries
  envelo run                       Start agent in monitoring mode
  envelo boundaries                List configured boundaries
        """
    )
    
    parser.add_argument("--version", action="version", version=f"ENVELO {__version__}")
    parser.add_argument("--api-key", help="API key (or set ENVELO_API_KEY)")
    parser.add_argument("--certificate", help="Certificate number (or set ENVELO_CERTIFICATE)")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Check configuration status")
    
    # Test command
    test_parser = subparsers.add_parser("test", help="Test parameter against boundaries")
    test_parser.add_argument("--param", "-p", action="append", nargs=2, metavar=("NAME", "VALUE"),
                            help="Parameter to test (can repeat)")
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Start agent in monitoring mode")
    run_parser.add_argument("--duration", "-d", type=int, default=0, 
                           help="Run duration in seconds (0=forever)")
    
    # Boundaries command
    boundaries_parser = subparsers.add_parser("boundaries", help="List configured boundaries")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize agent
    kwargs = {}
    if args.api_key:
        kwargs["api_key"] = args.api_key
    if args.certificate:
        kwargs["certificate_number"] = args.certificate
    
    try:
        agent = EnveloAgent(**kwargs)
    except Exception as e:
        print(f"[ENVELO] Error initializing agent: {e}")
        sys.exit(1)
    
    if args.command == "status":
        print(f"[ENVELO] Version: {__version__}")
        print(f"[ENVELO] API Endpoint: {agent.config.api_endpoint}")
        print(f"[ENVELO] Certificate: {agent.config.certificate_number or 'Not set'}")
        print(f"[ENVELO] API Key: {agent.config.api_key[:15]}..." if agent.config.api_key else "[ENVELO] API Key: Not set")
        print(f"[ENVELO] Enforcement Mode: {agent.config.enforcement_mode}")
        print(f"[ENVELO] Fail-Closed: {agent.config.fail_closed}")
    
    elif args.command == "test":
        if not agent.start():
            print("[ENVELO] Failed to start agent")
            sys.exit(1)
        
        if not args.param:
            print("[ENVELO] No parameters to test. Use --param NAME VALUE")
            sys.exit(1)
        
        params = {}
        for name, value in args.param:
            try:
                params[name] = float(value)
            except ValueError:
                params[name] = value
        
        print(f"[ENVELO] Testing: {params}")
        result = agent.check(**params)
        
        if result:
            print("[ENVELO] ✓ PASS - All parameters within boundaries")
        else:
            print("[ENVELO] ⛔ BLOCKED - Boundary violation detected")
        
        agent.stop()
        sys.exit(0 if result else 1)
    
    elif args.command == "run":
        import time
        
        if not agent.start():
            print("[ENVELO] Failed to start agent")
            sys.exit(1)
        
        print("[ENVELO] Agent running. Press Ctrl+C to stop.")
        
        try:
            if args.duration > 0:
                time.sleep(args.duration)
            else:
                while agent.is_running:
                    time.sleep(1)
        except KeyboardInterrupt:
            pass
        
        agent.stop()
    
    elif args.command == "boundaries":
        if not agent.start():
            print("[ENVELO] Failed to start agent")
            sys.exit(1)
        
        print(f"[ENVELO] Loaded {len(agent._boundaries)} boundaries:\n")
        
        for name, boundary in agent._boundaries.items():
            b = boundary.to_dict()
            print(f"  {name}")
            print(f"    Type: {b.get('type', 'unknown')}")
            print(f"    Parameter: {b.get('parameter', name)}")
            if b.get("min_value") is not None:
                print(f"    Min: {b['min_value']}{b.get('unit', '')}")
            if b.get("max_value") is not None:
                print(f"    Max: {b['max_value']}{b.get('unit', '')}")
            print()
        
        agent.stop()


if __name__ == "__main__":
    main()
