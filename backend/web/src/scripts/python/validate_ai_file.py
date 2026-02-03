#!/usr/bin/env python3
"""
AI File Validation Script for Sign Manufacturing

Converts AI files to SVG and validates for manufacturing errors.

Dependencies:
  - inkscape (system): sudo apt install inkscape
  - svgpathtools: pip3 install svgpathtools
  - shapely: pip3 install shapely

Usage:
  python3 validate_ai_file.py <ai_file_path> [--rules-json <rules_json>]

Output:
  JSON object with validation results to stdout

Available Rules:
  - no_duplicate_overlapping: Check for duplicate paths on same layer
  - stroke_requirements: Validate stroke color/width/fill
  - structural_mounting_holes: Check hole count based on path size
  - path_closure: Check that paths are properly closed
  - front_lit_structure: Front Lit channel letter validation (wire holes, mounting holes, trim)
"""

import argparse
import json
import sys

# Check dependencies before importing validation module
try:
    from svgpathtools import svg2paths2
    from shapely.geometry import Polygon
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Missing dependency: {e}. Install with: pip3 install svgpathtools shapely",
        "issues": []
    }))
    sys.exit(1)

from validation import validate_file


def main():
    parser = argparse.ArgumentParser(
        description='Validate AI files for manufacturing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('ai_file', help='Path to the AI file to validate')
    parser.add_argument('--rules-json', help='JSON string of validation rules')

    args = parser.parse_args()

    # Parse rules
    rules = {}
    if args.rules_json:
        try:
            rules = json.loads(args.rules_json)
        except json.JSONDecodeError as e:
            print(json.dumps({
                "success": False,
                "error": f"Invalid rules JSON: {e}",
                "issues": []
            }))
            sys.exit(1)
    else:
        # Default rules for standalone execution
        rules = {
            'no_duplicate_overlapping': {
                'tolerance': 0.01
            },
            'stroke_requirements': {
                'required_color': '#000000',
                'required_width': 1.0,
                'allow_fill': False,
                'tolerance': 0.1
            },
            'structural_mounting_holes': {
                'min_holes': 2,
                'holes_per_sq_inch': 0.01,
                'min_perimeter_for_holes': 48
            }
        }

    # Run validation
    result = validate_file(args.ai_file, rules)

    # Output JSON
    print(json.dumps(result.to_dict(), indent=2))

    # Exit with appropriate code
    if result.status == 'error':
        sys.exit(2)
    elif result.status == 'failed':
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
