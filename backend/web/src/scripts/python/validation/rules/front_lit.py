"""
Front Lit Channel Letter Validation Rules

Validates structural requirements for Front Lit channel letter working files:
1. Wire holes in Return layer (if LEDs are present)
2. Mounting holes based on letter size
3. Trim layer path count matches Return layer
4. Trim offset from Return is within tolerance

Hole classification is handled by the database (standard_hole_sizes table)
via _classify_holes_from_standards() in __init__.py.

generate_letter_analysis_issues(): Generates validation issues from classified analysis

File scale assumptions:
- Working files are at 10% scale
- Wire hole: 9.7mm real = ~2.75mm in file
- Mounting hole: 3.81mm real = ~1.08mm in file
- Trim offset: 2mm real per side = 0.2mm in file per side

Trim offset note:
- At straight edges, trim extends by the perpendicular offset
- At corners, mitered joints extend further: offset / sin(angle/2)
- For 90° corner: 1.41x the perpendicular offset
- For 60° corner: 2.0x the perpendicular offset
- For 30° corner: 3.86x the perpendicular offset
- Miter limit of 4 means max extension is 4x before bevel kicks in
- We use miter_factor to allow for this variation in bbox measurements

Integration with letter_analysis.py:
- When '_letter_analysis' is provided in rules, uses pre-computed analysis
- Falls back to legacy bbox-based analysis if not provided
"""

from typing import List, Dict, Optional, Any

from ..core import PathInfo, ValidationIssue, LetterAnalysisResult
from ..geometry import polygon_distance, buffer_polygon_with_mitre
from .legacy_analysis import (
    analyze_letters_in_layer,
    match_trim_to_return,
    convert_letter_groups_to_analysis,
)


def generate_letter_analysis_issues(
    analysis: LetterAnalysisResult,
    return_layer: str = 'return',
    expected_mounting_names: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Generate validation issues from letter analysis results.
    Attaches issues directly to letter.issues and analysis.issues as it generates them.
    Only checks hole requirements for the return layer (trim letters have no holes by design).

    Args:
        analysis: LetterAnalysisResult (holes should already be classified)
        return_layer: Layer name for return paths (default 'return')
        expected_mounting_names: List of expected mounting type names (e.g. ['Regular Mounting']).
                                 If set, warns when other mounting types are found.

    Returns:
        List of issue dicts with rule, severity, message, details
    """
    all_issues = []

    # Check each letter for required holes (return layer only)
    for letter in analysis.letter_groups:
        # Only check hole requirements for return layer
        if letter.layer_name.lower() != return_layer.lower():
            continue

        # No wire hole is an error
        if len(letter.wire_holes) == 0:
            issue = {
                'rule': 'letter_no_wire_hole',
                'severity': 'error',
                'message': f'Letter {letter.letter_id} has no wire hole',
                'path_id': letter.letter_id,
                'details': {
                    'layer': letter.layer_name,
                    'size_inches': letter.real_size_inches,
                    'hole_counts': {
                        'wire': len(letter.wire_holes),
                        'mounting': len(letter.mounting_holes),
                        'unknown': len(letter.unknown_holes)
                    }
                }
            }
            all_issues.append(issue)
            letter.issues.append(issue)

        # Multiple wire holes is a warning
        if len(letter.wire_holes) > 1:
            issue = {
                'rule': 'letter_multiple_wire_holes',
                'severity': 'warning',
                'message': f'Letter {letter.letter_id} has {len(letter.wire_holes)} wire holes, expected 1',
                'path_id': letter.letter_id,
                'details': {
                    'wire_hole_count': len(letter.wire_holes),
                    'wire_holes': [h.to_dict() for h in letter.wire_holes]
                }
            }
            all_issues.append(issue)
            letter.issues.append(issue)

        # Unexpected mounting type is a warning
        if expected_mounting_names and letter.mounting_holes:
            unexpected: Dict[str, int] = {}
            for hole in letter.mounting_holes:
                if hole.matched_name and hole.matched_name not in expected_mounting_names:
                    unexpected[hole.matched_name] = unexpected.get(hole.matched_name, 0) + 1
            for mtype, count in unexpected.items():
                expected_str = ', '.join(expected_mounting_names)
                issue = {
                    'rule': 'unexpected_mounting_type',
                    'severity': 'warning',
                    'message': f'Letter {letter.letter_id} has {count}x {mtype} hole{"s" if count > 1 else ""} (expected {expected_str})',
                    'path_id': letter.letter_id,
                    'details': {
                        'layer': letter.layer_name,
                        'letter_id': letter.letter_id,
                        'unexpected_type': mtype,
                        'count': count,
                        'expected_types': expected_mounting_names,
                    }
                }
                all_issues.append(issue)
                letter.issues.append(issue)

        # Unknown holes are info
        for hole in letter.unknown_holes:
            issue = {
                'rule': 'unknown_hole_size',
                'severity': 'info',
                'message': f'Hole {hole.path_id} in letter {letter.letter_id} has unusual diameter {hole.diameter_real_mm:.2f}mm',
                'path_id': hole.path_id,
                'details': {
                    'layer': letter.layer_name,
                    'letter_id': letter.letter_id,
                    'diameter_mm': hole.diameter_mm,
                    'diameter_real_mm': hole.diameter_real_mm,
                }
            }
            all_issues.append(issue)
            letter.issues.append(issue)

    return all_issues


def check_trim_cap_spacing(
    letter_analysis: LetterAnalysisResult,
    rules: Dict,
) -> List[ValidationIssue]:
    """
    Validate that trim cap letters maintain at least the required clearance
    between each other, using polygon shapes (not bounding boxes) with
    simulated mitered corners.

    Algorithm:
    1. Get return letter polygons from letter_analysis
    2. Buffer each outward by trim_offset_max with mitre join to simulate
       physical trim cap shape including mitered corners
    3. Pairwise distance check between buffered polygons
    4. Convert distance to inches, compare against min_trim_spacing_inches

    Args:
        letter_analysis: Pre-computed LetterAnalysisResult with polygon data
        rules: Dict with front_lit_structure config values

    Returns:
        List of ValidationIssue objects for spacing violations
    """
    issues = []

    return_layer = rules.get('return_layer', 'return')
    file_scale = rules.get('file_scale', 0.1)
    trim_offset_max_mm = rules.get('trim_offset_max_mm', 2.5)
    miter_factor = rules.get('miter_factor', 4.0)
    min_spacing_inches = rules.get('min_trim_spacing_inches', 0.15)

    if letter_analysis and letter_analysis.detected_scale:
        file_scale = letter_analysis.detected_scale

    # Collect return layer letters that have polygon data
    return_letters_with_poly = []
    for lg in letter_analysis.letter_groups:
        if lg.layer_name.lower() != return_layer.lower():
            continue
        if lg.main_path and lg.main_path.polygon is not None:
            return_letters_with_poly.append(lg)

    if len(return_letters_with_poly) < 2:
        # Need at least 2 letters to check spacing
        return issues

    # Convert trim_offset_max from real mm to file units
    # mm -> inches -> points -> file-scale points
    points_per_real_inch = 72 * file_scale
    trim_buffer_file_units = trim_offset_max_mm * points_per_real_inch / 25.4

    # Buffer each return letter polygon to simulate mitered trim cap shape
    buffered = []
    for lg in return_letters_with_poly:
        sim = buffer_polygon_with_mitre(
            lg.main_path.polygon, trim_buffer_file_units, mitre_limit=miter_factor
        )
        buffered.append((lg, sim))

    # Pairwise distance check
    for i in range(len(buffered)):
        lg_a, poly_a = buffered[i]
        if poly_a is None:
            continue
        for j in range(i + 1, len(buffered)):
            lg_b, poly_b = buffered[j]
            if poly_b is None:
                continue

            dist = polygon_distance(poly_a, poly_b)
            dist_inches = dist / points_per_real_inch

            if dist_inches < min_spacing_inches:
                issues.append(ValidationIssue(
                    rule='front_lit_trim_spacing',
                    severity='error',
                    message=(
                        f'Trim caps for {lg_a.letter_id} and {lg_b.letter_id} '
                        f'are {dist_inches:.3f}" apart (min {min_spacing_inches}")'
                    ),
                    details={
                        'letter_a': lg_a.letter_id,
                        'letter_b': lg_b.letter_id,
                        'distance_inches': round(dist_inches, 4),
                        'required_inches': min_spacing_inches,
                        'distance_file_units': round(dist, 2),
                    }
                ))

    return issues


def check_front_lit_structure(paths_info: List[PathInfo], rules: Dict) -> List[ValidationIssue]:
    """
    Validate Front Lit channel letter structural requirements.

    Rules:
    1. Mounting holes: Minimum based on letter size (perimeter and area)
    2. Trim count: Trim layer must have same number of letters as Return layer
    3. Trim offset: Each trim shape must be ~2mm larger per side than corresponding return

    Wire hole checks are handled per-letter in generate_letter_analysis_issues().

    If '_letter_analysis' is provided in rules, uses pre-computed analysis for
    more accurate polygon-based containment instead of bbox-based.
    """
    issues = []

    # Configuration
    return_layer = rules.get('return_layer', 'return')
    trim_layer = rules.get('trim_layer', 'trimcap')
    file_scale = rules.get('file_scale', 0.1)
    min_mounting_holes = rules.get('min_mounting_holes', 2)
    holes_per_inch_perimeter = rules.get('mounting_holes_per_inch_perimeter', 0.05)
    holes_per_sq_inch_area = rules.get('mounting_holes_per_sq_inch_area', 0.0123)
    trim_offset_min = rules.get('trim_offset_min_mm', 0.19)
    trim_offset_max = rules.get('trim_offset_max_mm', 0.21)
    miter_factor = rules.get('miter_factor', 4.0)

    # Check for pre-computed letter analysis
    letter_analysis: Optional[LetterAnalysisResult] = rules.get('_letter_analysis')

    # Build return_letters from letter analysis or legacy method
    if letter_analysis and letter_analysis.letter_groups:
        return_letters = convert_letter_groups_to_analysis(letter_analysis, return_layer, file_scale)
        if letter_analysis.detected_scale:
            file_scale = letter_analysis.detected_scale
    else:
        return_letters = analyze_letters_in_layer(paths_info, return_layer, rules)

    if not return_letters:
        layers_found = set(p.layer_name for p in paths_info if p.layer_name)
        issues.append(ValidationIssue(
            rule='front_lit_structure',
            severity='warning',
            message=f'No letters found in "{return_layer}" layer. Available layers: {", ".join(layers_found)}',
            details={'available_layers': list(layers_found)}
        ))
        return issues

    issues.append(ValidationIssue(
        rule='front_lit_structure',
        severity='info',
        message=f'Found {len(return_letters)} letter(s) in {return_layer} layer',
        details={
            'layer': return_layer,
            'count': len(return_letters),
            'letters': [{'path_id': l.path_id, 'centroid': l.centroid, 'width': round(l.width, 1), 'height': round(l.height, 1)} for l in return_letters]
        }
    ))

    points_per_real_inch = 72 * file_scale

    # Extract standard mounting hole size from standard_hole_sizes (if available)
    standard_hole_sizes = rules.get('_standard_hole_sizes', [])
    mounting_std = next((s for s in standard_hole_sizes if s.get('category') == 'mounting'), None)
    mounting_std_diameter = mounting_std['diameter_mm'] if mounting_std else None
    mounting_std_name = mounting_std['name'] if mounting_std else None

    # Build a lookup from letter path_id to LetterGroup for unknown hole details
    letter_group_lookup = {}
    if letter_analysis and letter_analysis.letter_groups:
        for lg in letter_analysis.letter_groups:
            letter_group_lookup[lg.letter_id] = lg

    # Rule 1: Mounting holes (wire holes now handled per-letter in generate_letter_analysis_issues)
    for letter in return_letters:
        real_perimeter_inches = letter.perimeter / points_per_real_inch
        real_area_sq_inches = letter.area / (points_per_real_inch ** 2)

        holes_by_perimeter = round(real_perimeter_inches * holes_per_inch_perimeter)
        holes_by_area = round(real_area_sq_inches * holes_per_sq_inch_area)
        required_holes = max(min_mounting_holes, holes_by_perimeter, holes_by_area)

        if letter.mounting_hole_count < required_holes:
            detail = {
                'layer': letter.layer,
                'actual_holes': letter.mounting_hole_count,
                'required_holes': required_holes,
                'real_perimeter_inches': round(real_perimeter_inches, 2),
                'real_area_sq_inches': round(real_area_sq_inches, 2),
                'holes_by_perimeter': holes_by_perimeter,
                'holes_by_area': holes_by_area,
            }

            # Add required mounting hole size from standards
            if mounting_std_diameter is not None:
                detail['mounting_std_diameter_mm'] = mounting_std_diameter
                detail['mounting_std_name'] = mounting_std_name

            # Add unknown hole info from LetterGroup (if available)
            lg = letter_group_lookup.get(letter.path_id)
            if lg:
                unknown = lg.unknown_holes
                detail['unknown_hole_count'] = len(unknown)
                if unknown:
                    detail['unknown_holes'] = [
                        {
                            'path_id': h.path_id,
                            'diameter_real_mm': round(h.diameter_real_mm, 2),
                        }
                        for h in unknown
                    ]

            issues.append(ValidationIssue(
                rule='front_lit_mounting_holes',
                severity='warning',
                message=f'Letter {letter.path_id} needs {required_holes} mounting holes, has {letter.mounting_hole_count}',
                path_id=letter.path_id,
                details=detail,
            ))

    # Rule 3: Trim count — use same analysis source as return for consistency
    if letter_analysis and letter_analysis.letter_groups:
        trim_letters = convert_letter_groups_to_analysis(letter_analysis, trim_layer, file_scale)
    else:
        trim_letters = analyze_letters_in_layer(paths_info, trim_layer, rules)

    issues.append(ValidationIssue(
        rule='front_lit_structure',
        severity='info',
        message=f'Found {len(trim_letters)} letter(s) in {trim_layer} layer',
        details={
            'layer': trim_layer,
            'count': len(trim_letters),
            'letters': [{'path_id': l.path_id, 'centroid': l.centroid, 'width': round(l.width, 1), 'height': round(l.height, 1)} for l in trim_letters]
        }
    ))

    if len(trim_letters) == 0 and len(return_letters) > 0:
        issues.append(ValidationIssue(
            rule='front_lit_trim_missing',
            severity='error',
            message=f'Working file must include a {trim_layer} layer with letters',
            details={
                'trim_layer': trim_layer,
                'return_count': len(return_letters),
            }
        ))
    elif len(trim_letters) != len(return_letters):
        issues.append(ValidationIssue(
            rule='front_lit_trim_count',
            severity='error',
            message=f'{trim_layer} layer has {len(trim_letters)} letters, {return_layer} has {len(return_letters)}',
            details={
                'trim_count': len(trim_letters),
                'return_count': len(return_letters),
                'trim_layer': trim_layer,
                'return_layer': return_layer
            }
        ))

    # Rule 4: Trim offset
    max_match_distance = rules.get('max_match_distance', 10.0)

    if trim_letters and return_letters:
        matches = match_trim_to_return(trim_letters, return_letters)

        for trim, return_match, distance in matches:
            if return_match is None or distance > max_match_distance:
                issues.append(ValidationIssue(
                    rule='front_lit_trim_offset',
                    severity='warning',
                    message=f'Trim letter {trim.path_id} has no matching return letter (nearest is {distance:.1f} units away)',
                    path_id=trim.path_id,
                    details={
                        'trim_path_id': trim.path_id,
                        'trim_bbox': trim.bbox,
                        'nearest_return': return_match.path_id if return_match else None,
                        'distance': round(distance, 2)
                    }
                ))
                continue

            raw_width_diff = trim.raw_width - return_match.raw_width
            raw_height_diff = trim.raw_height - return_match.raw_height

            mm_per_file_unit = 25.4 / points_per_real_inch
            width_diff_mm = raw_width_diff * mm_per_file_unit
            height_diff_mm = raw_height_diff * mm_per_file_unit

            if width_diff_mm < 0 or height_diff_mm < 0:
                issues.append(ValidationIssue(
                    rule='front_lit_trim_offset',
                    severity='error',
                    message=f'{return_layer} is larger than {trim_layer}',
                    path_id=trim.path_id,
                    details={
                        'layer': trim_layer,
                        'trim_path_id': trim.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                        'centroid_distance': round(distance, 2)
                    }
                ))
                continue

            width_offset_per_side_mm = width_diff_mm / 2
            height_offset_per_side_mm = height_diff_mm / 2

            max_with_miter = trim_offset_max * miter_factor

            width_ok = trim_offset_min <= width_offset_per_side_mm <= max_with_miter
            height_ok = trim_offset_min <= height_offset_per_side_mm <= max_with_miter

            if not width_ok or not height_ok:
                expected_total_min = trim_offset_min * 2
                expected_total_max = max_with_miter * 2

                issues.append(ValidationIssue(
                    rule='front_lit_trim_offset',
                    severity='error',
                    message=f'Trim {trim.path_id} offset: {width_diff_mm:.1f}mm W x {height_diff_mm:.1f}mm H (expected {expected_total_min:.1f}-{expected_total_max:.1f}mm total)',
                    path_id=trim.path_id,
                    details={
                        'layer': trim_layer,
                        'trim_path_id': trim.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                        'width_per_side_mm': round(width_offset_per_side_mm, 2),
                        'height_per_side_mm': round(height_offset_per_side_mm, 2),
                        'centroid_distance': round(distance, 2),
                        'expected_min_per_side_mm': trim_offset_min,
                        'expected_max_per_side_mm': max_with_miter,
                        'miter_factor': miter_factor
                    }
                ))

    # Rule 5: Trim cap spacing (polygon-based with simulated miters)
    if letter_analysis and letter_analysis.letter_groups:
        issues.extend(check_trim_cap_spacing(letter_analysis, rules))

    return issues
