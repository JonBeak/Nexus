#!/usr/bin/env python3
"""
Test script for AI file conversion with multiple converters.

Usage:
    python3 test_ai_converters.py <ai_file_path>
    python3 test_ai_converters.py --test-all <directory_with_ai_files>

This script tests the multi-converter fallback system by:
1. Detecting AI version
2. Attempting conversion with each available converter
3. Validating SVG output
4. Reporting which converters work and which fail
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

# Add validation module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from validation.ai_converters import (
    detect_ai_version,
    try_inkscape,
    try_uniconvertor,
    try_ghostscript_pdf2svg,
    check_converter_available,
    validate_svg_output
)


def test_single_file(ai_path: str, verbose: bool = False) -> dict:
    """
    Test conversion of a single AI file with all available converters.

    Returns:
        Dict with test results
    """
    if not os.path.exists(ai_path):
        return {
            'success': False,
            'error': f'File not found: {ai_path}'
        }

    # Detect AI version
    version_info = detect_ai_version(ai_path)

    print(f"\n{'='*70}")
    print(f"Testing: {os.path.basename(ai_path)}")
    print(f"AI Version: {version_info['display_name']}")
    print(f"{'='*70}\n")

    results = {
        'file': ai_path,
        'version': version_info,
        'converters': {},
        'recommended': None
    }

    # Test each converter
    converters = [
        ('Inkscape', try_inkscape),
        ('UniConvertor', try_uniconvertor),
        ('Ghostscript+pdf2svg', try_ghostscript_pdf2svg)
    ]

    for name, converter_func in converters:
        print(f"Testing {name}...", end=' ')

        # Check if converter is available
        if name == 'Inkscape' and not check_converter_available('inkscape'):
            print("❌ Not installed")
            results['converters'][name] = {'available': False, 'success': False, 'error': 'Not installed'}
            continue
        elif name == 'UniConvertor' and not (check_converter_available('uniconvertor') or check_converter_available('uniconv')):
            print("❌ Not installed")
            results['converters'][name] = {'available': False, 'success': False, 'error': 'Not installed'}
            continue
        elif name == 'Ghostscript+pdf2svg' and not (check_converter_available('gs') and check_converter_available('pdf2svg')):
            print("❌ Not installed (missing gs or pdf2svg)")
            results['converters'][name] = {'available': False, 'success': False, 'error': 'Not installed'}
            continue

        # Try conversion
        temp_fd, temp_svg = tempfile.mkstemp(suffix='.svg')
        os.close(temp_fd)

        try:
            success, error = converter_func(ai_path, temp_svg)

            if success:
                # Get SVG file size for reporting
                svg_size = os.path.getsize(temp_svg)
                print(f"✓ Success ({svg_size:,} bytes)")
                results['converters'][name] = {
                    'available': True,
                    'success': True,
                    'svg_size': svg_size
                }

                # Set as recommended if first successful converter
                if not results['recommended']:
                    results['recommended'] = name

                if verbose:
                    print(f"  → SVG path: {temp_svg}")
            else:
                print(f"❌ Failed")
                if verbose:
                    print(f"  → Error: {error}")
                results['converters'][name] = {
                    'available': True,
                    'success': False,
                    'error': error
                }

        finally:
            # Cleanup temp file
            if os.path.exists(temp_svg):
                try:
                    os.unlink(temp_svg)
                except:
                    pass

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")

    successful_converters = [name for name, info in results['converters'].items() if info.get('success')]
    failed_converters = [name for name, info in results['converters'].items() if not info.get('success')]

    if successful_converters:
        print(f"✓ Working converters: {', '.join(successful_converters)}")
        print(f"✓ Recommended: {results['recommended']}")
    else:
        print("❌ No converters succeeded")

    if failed_converters:
        print(f"❌ Failed converters: {', '.join(failed_converters)}")

    print()

    return results


def test_directory(directory: str, verbose: bool = False) -> dict:
    """
    Test all AI files in a directory.

    Returns:
        Dict with aggregated test results
    """
    ai_files = list(Path(directory).rglob('*.ai'))

    if not ai_files:
        return {
            'success': False,
            'error': f'No AI files found in {directory}'
        }

    print(f"\nFound {len(ai_files)} AI file(s) in {directory}\n")

    results = {
        'directory': directory,
        'files': [],
        'summary': {
            'total_files': len(ai_files),
            'by_converter': {}
        }
    }

    for ai_file in ai_files:
        file_results = test_single_file(str(ai_file), verbose)
        results['files'].append(file_results)

        # Aggregate converter statistics
        for converter_name, converter_info in file_results.get('converters', {}).items():
            if converter_name not in results['summary']['by_converter']:
                results['summary']['by_converter'][converter_name] = {
                    'available': converter_info.get('available', False),
                    'successes': 0,
                    'failures': 0
                }

            if converter_info.get('success'):
                results['summary']['by_converter'][converter_name]['successes'] += 1
            else:
                results['summary']['by_converter'][converter_name]['failures'] += 1

    # Print overall summary
    print(f"\n{'='*70}")
    print("OVERALL SUMMARY")
    print(f"{'='*70}")
    print(f"Total files tested: {results['summary']['total_files']}")
    print()

    for converter_name, stats in results['summary']['by_converter'].items():
        if not stats['available']:
            print(f"{converter_name}: Not available")
        else:
            success_rate = (stats['successes'] / results['summary']['total_files']) * 100
            print(f"{converter_name}: {stats['successes']}/{results['summary']['total_files']} "
                  f"succeeded ({success_rate:.1f}%)")

    print()

    return results


def main():
    parser = argparse.ArgumentParser(
        description='Test AI file conversion with multiple converters',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test a single file
  python3 test_ai_converters.py /path/to/file.ai

  # Test all AI files in a directory
  python3 test_ai_converters.py --test-all /path/to/ai/files/

  # Verbose output with detailed error messages
  python3 test_ai_converters.py --verbose /path/to/file.ai

  # Output results as JSON
  python3 test_ai_converters.py --json /path/to/file.ai > results.json
        """
    )

    parser.add_argument('path', help='AI file or directory to test')
    parser.add_argument('--test-all', action='store_true',
                        help='Test all AI files in directory')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show detailed error messages')
    parser.add_argument('--json', action='store_true',
                        help='Output results as JSON')

    args = parser.parse_args()

    # Run tests
    if args.test_all:
        results = test_directory(args.path, args.verbose)
    else:
        results = test_single_file(args.path, args.verbose)

    # Output JSON if requested
    if args.json:
        print(json.dumps(results, indent=2))

    # Exit code
    if args.test_all:
        # Success if at least one converter worked for all files
        has_working_converter = any(
            stats['successes'] == results['summary']['total_files']
            for stats in results['summary']['by_converter'].values()
            if stats['available']
        )
        sys.exit(0 if has_working_converter else 1)
    else:
        sys.exit(0 if results.get('recommended') else 1)


if __name__ == '__main__':
    main()
