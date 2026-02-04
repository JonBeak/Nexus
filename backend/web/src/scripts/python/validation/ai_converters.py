"""
AI to SVG converter module with multiple fallback options.

Provides conversion functions for different AI file versions using:
1. Inkscape (primary, handles most modern AI files)
2. UniConvertor (fallback for legacy formats)
3. Ghostscript + pdf2svg (fallback for very old formats)
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Tuple, Optional, Dict, List


def detect_ai_version(ai_path: str) -> Dict[str, any]:
    """
    Detect Adobe Illustrator version from file header.

    Returns:
        Dict with version info: {
            'numeric_version': float or None,
            'display_name': str,
            'raw_version': str or None
        }
    """
    try:
        with open(ai_path, 'rb') as f:
            header = f.read(16384)  # Read first 16KB

        try:
            header_text = header.decode('utf-8', errors='replace')
        except:
            header_text = header.decode('latin-1', errors='replace')

        # Try XMP metadata format (modern AI files)
        xmp_pattern = r'<xmp:CreatorTool>Adobe Illustrator[^\d]*(\d+(?:\.\d+)?)'
        xmp_match = re.search(xmp_pattern, header_text, re.IGNORECASE)

        if xmp_match:
            raw_version = xmp_match.group(1)
            numeric_version = float(raw_version)
            return {
                'numeric_version': numeric_version,
                'display_name': f'AI {raw_version}',
                'raw_version': raw_version
            }

        # Try PostScript %%Creator format (older AI files)
        creator_pattern = r'%%Creator:\s*Adobe Illustrator[^0-9]*(\d+(?:\.\d+)?)'
        creator_match = re.search(creator_pattern, header_text, re.IGNORECASE)

        if creator_match:
            raw_version = creator_match.group(1)
            numeric_version = float(raw_version)
            return {
                'numeric_version': numeric_version,
                'display_name': f'AI {raw_version}',
                'raw_version': raw_version
            }

        # Try softwareAgent in XMP
        agent_pattern = r'<stEvt:softwareAgent>Adobe Illustrator[^\d]*(\d+(?:\.\d+)?)'
        agent_match = re.search(agent_pattern, header_text, re.IGNORECASE)

        if agent_match:
            raw_version = agent_match.group(1)
            numeric_version = float(raw_version)
            return {
                'numeric_version': numeric_version,
                'display_name': f'AI {raw_version}',
                'raw_version': raw_version
            }

        return {
            'numeric_version': None,
            'display_name': 'Unknown',
            'raw_version': None
        }

    except Exception as e:
        print(f"Warning: Could not detect AI version: {e}", file=sys.stderr)
        return {
            'numeric_version': None,
            'display_name': 'Unknown',
            'raw_version': None
        }


def check_converter_available(converter_name: str) -> bool:
    """Check if a converter command is available in PATH."""
    return shutil.which(converter_name) is not None


def validate_svg_output(svg_path: str) -> bool:
    """
    Validate that SVG output is valid and usable.

    Returns:
        True if SVG is valid, False otherwise
    """
    if not os.path.exists(svg_path):
        return False

    if os.path.getsize(svg_path) == 0:
        return False

    # Check for basic SVG structure
    try:
        with open(svg_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read(1024)  # Read first 1KB
            if '<svg' not in content.lower():
                return False
    except Exception:
        return False

    return True


def try_inkscape(ai_path: str, output_svg: str) -> Tuple[bool, str]:
    """
    Try converting AI to SVG using Inkscape.

    Returns:
        Tuple of (success, error_message)
    """
    if not check_converter_available('inkscape'):
        return False, "Inkscape not installed"

    try:
        result = subprocess.run(
            ['inkscape', ai_path, '--export-filename=' + output_svg],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            return False, f"Inkscape failed (exit {result.returncode}): {result.stderr[:200]}"

        if not validate_svg_output(output_svg):
            return False, "Inkscape produced invalid/empty output"

        return True, ""

    except subprocess.TimeoutExpired:
        return False, "Inkscape conversion timed out (60s)"
    except Exception as e:
        return False, f"Inkscape error: {str(e)}"


def try_uniconvertor(ai_path: str, output_svg: str) -> Tuple[bool, str]:
    """
    Try converting AI to SVG using UniConvertor.

    Returns:
        Tuple of (success, error_message)
    """
    # Try both possible command names
    cmd = None
    if check_converter_available('uniconvertor'):
        cmd = 'uniconvertor'
    elif check_converter_available('uniconv'):
        cmd = 'uniconv'
    else:
        return False, "UniConvertor not installed"

    try:
        result = subprocess.run(
            [cmd, ai_path, output_svg],
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            return False, f"UniConvertor failed (exit {result.returncode}): {result.stderr[:200]}"

        if not validate_svg_output(output_svg):
            return False, "UniConvertor produced invalid/empty output"

        return True, ""

    except subprocess.TimeoutExpired:
        return False, "UniConvertor conversion timed out (60s)"
    except Exception as e:
        return False, f"UniConvertor error: {str(e)}"


def try_ghostscript_pdf2svg(ai_path: str, output_svg: str) -> Tuple[bool, str]:
    """
    Try converting AI to SVG using Ghostscript + pdf2svg (two-stage).

    Returns:
        Tuple of (success, error_message)
    """
    if not check_converter_available('gs'):
        return False, "Ghostscript not installed"

    if not check_converter_available('pdf2svg'):
        return False, "pdf2svg not installed"

    temp_pdf = None
    try:
        # Stage 1: AI → PDF using Ghostscript
        temp_fd, temp_pdf = tempfile.mkstemp(suffix='.pdf')
        os.close(temp_fd)

        gs_result = subprocess.run(
            ['gs', '-dNOPAUSE', '-dBATCH', '-sDEVICE=pdfwrite',
             f'-sOutputFile={temp_pdf}', ai_path],
            capture_output=True,
            text=True,
            timeout=60
        )

        if gs_result.returncode != 0:
            return False, f"Ghostscript failed (exit {gs_result.returncode}): {gs_result.stderr[:200]}"

        if not os.path.exists(temp_pdf) or os.path.getsize(temp_pdf) == 0:
            return False, "Ghostscript produced empty PDF"

        # Stage 2: PDF → SVG using pdf2svg
        pdf2svg_result = subprocess.run(
            ['pdf2svg', temp_pdf, output_svg],
            capture_output=True,
            text=True,
            timeout=60
        )

        if pdf2svg_result.returncode != 0:
            return False, f"pdf2svg failed (exit {pdf2svg_result.returncode}): {pdf2svg_result.stderr[:200]}"

        if not validate_svg_output(output_svg):
            return False, "pdf2svg produced invalid/empty output"

        return True, ""

    except subprocess.TimeoutExpired:
        return False, "Ghostscript+pdf2svg conversion timed out (60s)"
    except Exception as e:
        return False, f"Ghostscript+pdf2svg error: {str(e)}"
    finally:
        # Cleanup temp PDF
        if temp_pdf and os.path.exists(temp_pdf):
            try:
                os.unlink(temp_pdf)
            except Exception:
                pass


def convert_ai_to_svg_multi(ai_path: str, output_svg: str) -> Tuple[bool, str, List[str]]:
    """
    Convert AI file to SVG using multiple converter fallbacks.

    Tries converters in priority order:
    1. Inkscape (best for modern AI files)
    2. UniConvertor (good for legacy formats)
    3. Ghostscript + pdf2svg (fallback for very old formats)

    Args:
        ai_path: Path to input AI file
        output_svg: Path where SVG should be written

    Returns:
        Tuple of (success, error_message, attempted_converters)
        - success: True if conversion succeeded
        - error_message: Error details if failed, or converter name if succeeded
        - attempted_converters: List of attempted converter names with results
    """
    if not os.path.exists(ai_path):
        return False, f"File not found: {ai_path}", []

    # Detect AI version for better error messages
    version_info = detect_ai_version(ai_path)
    version_str = version_info['display_name']

    attempts = []

    # Try Inkscape first (best for modern AI files)
    success, error = try_inkscape(ai_path, output_svg)
    attempts.append(f"Inkscape: {'✓ success' if success else error}")
    if success:
        return True, f"Converted using Inkscape ({version_str})", attempts

    # Try UniConvertor (good for legacy formats)
    success, error = try_uniconvertor(ai_path, output_svg)
    attempts.append(f"UniConvertor: {'✓ success' if success else error}")
    if success:
        return True, f"Converted using UniConvertor ({version_str})", attempts

    # Try Ghostscript + pdf2svg (fallback)
    success, error = try_ghostscript_pdf2svg(ai_path, output_svg)
    attempts.append(f"Ghostscript+pdf2svg: {'✓ success' if success else error}")
    if success:
        return True, f"Converted using Ghostscript+pdf2svg ({version_str})", attempts

    # All converters failed
    error_msg = f"All converters failed for {version_str} file.\n"
    error_msg += "Attempted:\n" + "\n".join(f"  - {a}" for a in attempts)
    error_msg += "\n\nSuggestion: Check if file is corrupted or install missing converters."

    return False, error_msg, attempts
