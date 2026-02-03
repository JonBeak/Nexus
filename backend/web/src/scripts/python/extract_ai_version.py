#!/usr/bin/env python3
"""
AI Version Extraction Script
Extracts Adobe Illustrator version from .ai files by parsing the header.

Usage:
  python3 extract_ai_version.py <ai_file_path>

Output:
  JSON object with version info to stdout:
  {
    "success": true,
    "numeric_version": 24.0,
    "display_name": "CC2020",
    "raw_version": "24.0"
  }

AI files are PostScript-based and contain a %%Creator comment near the start.
"""

import json
import sys
import re
from pathlib import Path

# Adobe Illustrator version to CC year mapping
VERSION_MAP = {
    # CC 2025+ versions
    '29': 'CC2025',
    # CC versions
    '28': 'CC2024',
    '27': 'CC2023',
    '26': 'CC2022',
    '25': 'CC2021',
    '24': 'CC2020',
    '23': 'CC2019',
    '22': 'CC2018',
    '21': 'CC2017',
    '20': 'CC2015.3',
    '19': 'CC2015',
    '18': 'CC2014',
    '17': 'CC',
    # CS versions
    '16': 'CS6',
    '15': 'CS5.5',
    '14': 'CS5',
    '13': 'CS4',
    '12': 'CS3',
    '11': 'CS2',
    '10': 'CS',
    # Legacy versions
    '9': '9',
    '8': '8',
    '7': '7',
}


def _build_version_result(raw_version: str) -> dict:
    """Build a version result dict from a raw version string."""
    # Parse numeric version (e.g., "24.0" -> 24.0)
    try:
        numeric_version = float(raw_version)
    except ValueError:
        numeric_version = None

    # Get major version for display name mapping
    major_version = raw_version.split('.')[0]
    display_name = VERSION_MAP.get(major_version, f'AI {raw_version}')

    return {
        'success': True,
        'numeric_version': numeric_version,
        'display_name': display_name,
        'raw_version': raw_version
    }


def extract_ai_version(file_path: str) -> dict:
    """
    Extract Adobe Illustrator version from file header.

    AI files contain PostScript comments including:
      %%Creator: Adobe Illustrator(R) XX.X

    We read first 4KB which should contain the header.
    """
    try:
        path = Path(file_path)

        if not path.exists():
            return {
                'success': False,
                'error': f'File not found: {file_path}'
            }

        if not path.suffix.lower() == '.ai':
            return {
                'success': False,
                'error': f'Not an AI file: {file_path}'
            }

        # Read first 16KB of file (XMP metadata can be further in)
        with open(file_path, 'rb') as f:
            header = f.read(16384)

        # Try to decode as UTF-8, fallback to latin-1
        try:
            header_text = header.decode('utf-8', errors='replace')
        except:
            header_text = header.decode('latin-1', errors='replace')

        # Pattern 1: XMP metadata format (modern AI files)
        # <xmp:CreatorTool>Adobe Illustrator 29.8 (Windows)</xmp:CreatorTool>
        xmp_pattern = r'<xmp:CreatorTool>Adobe Illustrator[^\d]*(\d+(?:\.\d+)?)'
        xmp_match = re.search(xmp_pattern, header_text, re.IGNORECASE)

        if xmp_match:
            raw_version = xmp_match.group(1)
            return _build_version_result(raw_version)

        # Pattern 2: PostScript %%Creator format (older AI files)
        # %%Creator: Adobe Illustrator(R) 24.0
        # %%Creator: Adobe Illustrator(TM) 24.0
        # %%Creator: Adobe Illustrator 24.0
        creator_pattern = r'%%Creator:\s*Adobe Illustrator[^0-9]*(\d+(?:\.\d+)?)'
        creator_match = re.search(creator_pattern, header_text, re.IGNORECASE)

        if creator_match:
            raw_version = creator_match.group(1)
            return _build_version_result(raw_version)

        # Pattern 3: softwareAgent in XMP (sometimes version differs)
        # <stEvt:softwareAgent>Adobe Illustrator 29.1 (Windows)</stEvt:softwareAgent>
        agent_pattern = r'<stEvt:softwareAgent>Adobe Illustrator[^\d]*(\d+(?:\.\d+)?)'
        agent_match = re.search(agent_pattern, header_text, re.IGNORECASE)

        if agent_match:
            raw_version = agent_match.group(1)
            return _build_version_result(raw_version)

        # Pattern 4: Generic Creator in PDF metadata
        pdf_pattern = r'%%Creator:\s*([^\n\r]+)'
        pdf_match = re.search(pdf_pattern, header_text)

        if pdf_match:
            creator = pdf_match.group(1).strip()
            # Try to extract version from generic creator string
            version_in_creator = re.search(r'(\d+(?:\.\d+)?)', creator)
            if version_in_creator and 'illustrator' in creator.lower():
                raw_version = version_in_creator.group(1)
                return _build_version_result(raw_version)
            return {
                'success': True,
                'numeric_version': None,
                'display_name': 'Unknown',
                'raw_version': None,
                'creator': creator
            }

        return {
            'success': True,
            'numeric_version': None,
            'display_name': 'Unknown',
            'raw_version': None,
            'note': 'Could not detect AI version from file header'
        }

    except PermissionError:
        return {
            'success': False,
            'error': f'Permission denied: {file_path}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: extract_ai_version.py <ai_file_path>'
        }))
        sys.exit(1)

    file_path = sys.argv[1]
    result = extract_ai_version(file_path)
    print(json.dumps(result))

    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
