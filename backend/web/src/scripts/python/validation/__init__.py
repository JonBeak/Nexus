"""
AI File Validation Package

Provides modular validation for AI files used in sign manufacturing.

Structure:
- core.py: Data structures (PathInfo, ValidationIssue, ValidationResult, LetterGroup, etc.)
- svg_parser.py: AI to SVG conversion and path extraction
- transforms.py: SVG transform utilities
- geometry.py: Geometric utilities (bbox, containment, circles, polygon ops)
- letter_analysis.py: Letter-hole geometry analysis (spec-agnostic, returns unclassified holes)
- base_rules.py: Common validation rules (overlaps, strokes, etc.)
- rules/: Spec-type specific validation rules
  - front_lit.py: Front Lit channel letter rules + hole classification
  - legacy_analysis.py: Bbox-based letter analysis (fallback/trim layer)
  - (future: halo_lit.py, non_lit.py, etc.)

Usage:
    from validation import validate_file

    result = validate_file('/path/to/file.ai', {
        'no_duplicate_overlapping': {'tolerance': 0.01},
        'front_lit_structure': {'check_wire_holes': True},
        'letter_hole_analysis': {'layer': 'return'}
    })
"""

import os
import re
from typing import Dict, List, Any

from .core import (
    ValidationIssue, ValidationResult, PathInfo,
    LetterGroup, LetterAnalysisResult, HoleInfo
)
from .svg_parser import convert_ai_to_svg, extract_paths_from_svg, detect_svg_scale
from .base_rules import (
    check_overlapping_paths,
    check_stroke_requirements,
    check_mounting_holes,
    check_path_closure
)
from .rules import check_front_lit_structure
from .rules.front_lit import generate_letter_analysis_issues
from .letter_analysis import analyze_letter_hole_associations


def _classify_holes_from_standards(analysis: 'LetterAnalysisResult', standard_sizes: list) -> None:
    """
    Classify all unclassified holes using standard hole sizes from the database.
    Mutates HoleInfo objects in place — sets hole_type, matched_name, matched_size_id.
    """
    if not standard_sizes:
        return

    def classify_one(hole):
        if hole.hole_type != 'unclassified' or hole.diameter_real_mm <= 0:
            return
        best_dist = float('inf')
        best_match = None
        for std in standard_sizes:
            dist = abs(hole.diameter_real_mm - std['diameter_mm'])
            if dist <= std['tolerance_mm'] and dist < best_dist:
                best_dist = dist
                best_match = std
        if best_match:
            hole.hole_type = best_match['category']
            hole.matched_name = best_match['name']
            hole.matched_size_id = best_match.get('hole_size_id')
        else:
            hole.hole_type = 'unknown'

    for group in analysis.letter_groups:
        for hole in group.holes:
            classify_one(hole)
    for hole in analysis.orphan_holes:
        classify_one(hole)


def validate_file(ai_path: str, rules: Dict[str, Dict]) -> ValidationResult:
    """
    Main validation function.

    Args:
        ai_path: Path to the AI file
        rules: Dictionary of rule configurations keyed by rule name.
               Available rules:
               - no_duplicate_overlapping: Check for duplicate paths
               - stroke_requirements: Validate stroke color/width/fill
               - structural_mounting_holes: Check hole count based on size
               - path_closure: Check paths are closed
               - front_lit_structure: Front Lit channel letter validation

    Returns:
        ValidationResult with issues and stats
    """
    file_name = os.path.basename(ai_path)
    all_issues: List[ValidationIssue] = []
    stats: Dict[str, Any] = {}
    temp_svg = None

    try:
        # SVG files don't need conversion — use directly
        detected_svg_scale = None
        if ai_path.lower().endswith('.svg'):
            svg_path = ai_path
            temp_svg = None  # Don't delete the original!
            detected_svg_scale = detect_svg_scale(svg_path)
        else:
            success, result, temp_svg = convert_ai_to_svg(ai_path)
            if not success:
                return ValidationResult(
                    success=False,
                    file_path=ai_path,
                    file_name=file_name,
                    status='error',
                    issues=[],
                    stats={},
                    error=result
                )
            svg_path = result

        # Parse paths from SVG
        # For .svg files, pass None as ai_path to skip binary OCG extraction
        source_ai_path = None if ai_path.lower().endswith('.svg') else ai_path
        paths_info = extract_paths_from_svg(svg_path, source_ai_path)

        # Filter out non-production paths:
        # - "Layer 1", "Layer_2" etc: Illustrator default unnamed layers
        # - "_no_layer_": stray paths outside any layer group (Inkscape export artifact)
        # - "_defs_": SVG <defs> definitions, not visible geometry
        # - Separator layers: names with no alphanumeric chars (e.g., "---")
        _skip_layers = ('_no_layer_', '_defs_')
        paths_info = [
            p for p in paths_info
            if not (
                p.layer_name in _skip_layers
                or (p.layer_name and re.match(r'^Layer[\s_]\d+$', p.layer_name))
                or (p.layer_name and not re.search(r'[a-zA-Z0-9]', p.layer_name))
            )
        ]

        # Collect stats
        layers_found = set(p.layer_name for p in paths_info if p.layer_name)
        paths_per_layer = {}
        for p in paths_info:
            layer = p.layer_name or '_unknown_'
            paths_per_layer[layer] = paths_per_layer.get(layer, 0) + 1

        stats = {
            'total_paths': len(paths_info),
            'closed_paths': sum(1 for p in paths_info if p.is_closed),
            'paths_with_stroke': sum(1 for p in paths_info if p.stroke),
            'paths_with_fill': sum(1 for p in paths_info if p.fill and p.fill != 'none'),
            'total_holes': sum(p.num_holes for p in paths_info),
            'total_area': sum(p.area or 0 for p in paths_info),
            'total_perimeter': sum(p.length for p in paths_info),
            'layers': list(layers_found),
            'paths_per_layer': paths_per_layer
        }

        # Letter-hole geometry analysis (run before other validations if requested)
        # Returns UNCLASSIFIED holes — spec rules classify them before serialization
        letter_analysis = None
        if 'letter_hole_analysis' in rules or 'front_lit_structure' in rules:
            analysis_config = rules.get('letter_hole_analysis', rules.get('front_lit_structure', {}))

            # For SVG files with detected unit scale, override file_scale
            if detected_svg_scale is not None:
                analysis_config = {**analysis_config, 'file_scale': detected_svg_scale}

            # 1. Geometry analysis — all layers (returns UNCLASSIFIED holes)
            letter_analysis = analyze_letter_hole_associations(
                paths_info,
                layer_name=None,
                config=analysis_config
            )

            # 2. Classify holes using standard sizes from DB (if provided)
            standard_sizes = analysis_config.get('standard_hole_sizes', [])
            if standard_sizes:
                _classify_holes_from_standards(letter_analysis, standard_sizes)

            # 3. Per-letter issues (attaches to letter.issues + analysis.issues)
            if 'front_lit_structure' in rules:
                return_layer = rules.get('front_lit_structure', {}).get('return_layer', 'return')
                analysis_issues = generate_letter_analysis_issues(letter_analysis, return_layer)
                for issue_dict in analysis_issues:
                    all_issues.append(ValidationIssue(
                        rule=issue_dict['rule'],
                        severity=issue_dict['severity'],
                        message=issue_dict['message'],
                        path_id=issue_dict.get('path_id'),
                        details=issue_dict.get('details')
                    ))

            # 4. Serialize AFTER classification + issue attachment
            stats['letter_analysis'] = letter_analysis.to_dict()
            stats['detected_scale'] = letter_analysis.detected_scale

        # Run validations based on active rules
        if 'no_duplicate_overlapping' in rules:
            all_issues.extend(check_overlapping_paths(paths_info, rules['no_duplicate_overlapping']))

        if 'stroke_requirements' in rules:
            all_issues.extend(check_stroke_requirements(paths_info, rules['stroke_requirements']))

        if 'structural_mounting_holes' in rules:
            all_issues.extend(check_mounting_holes(paths_info, rules['structural_mounting_holes']))

        if 'path_closure' in rules:
            all_issues.extend(check_path_closure(paths_info, rules['path_closure']))

        # 4. Structural checks (use classified data)
        if 'front_lit_structure' in rules:
            front_lit_rules = rules['front_lit_structure'].copy()
            if letter_analysis:
                front_lit_rules['_letter_analysis'] = letter_analysis
            all_issues.extend(check_front_lit_structure(paths_info, front_lit_rules))

        # Determine overall status
        has_errors = any(i.severity == 'error' for i in all_issues)
        has_warnings = any(i.severity == 'warning' for i in all_issues)

        if has_errors:
            status = 'failed'
        elif has_warnings:
            status = 'warning'
        else:
            status = 'passed'

        return ValidationResult(
            success=True,
            file_path=ai_path,
            file_name=file_name,
            status=status,
            issues=all_issues,
            stats=stats
        )

    except Exception as e:
        return ValidationResult(
            success=False,
            file_path=ai_path,
            file_name=file_name,
            status='error',
            issues=[],
            stats=stats,
            error=str(e)
        )
    finally:
        if temp_svg and os.path.exists(temp_svg):
            try:
                os.unlink(temp_svg)
            except Exception:
                pass


__all__ = [
    'validate_file',
    'ValidationIssue',
    'ValidationResult',
    'PathInfo',
    'LetterGroup',
    'LetterAnalysisResult',
    'HoleInfo',
    'analyze_letter_hole_associations',
    'generate_letter_analysis_issues',
]
