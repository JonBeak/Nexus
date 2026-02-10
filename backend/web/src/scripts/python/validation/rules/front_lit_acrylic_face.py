"""
Front Lit Acrylic Face Validation Rules

Validates structural requirements for Front Lit Acrylic Face channel letters:
1. Wire holes in Return layer (LEDs are present)
2. Mounting holes based on letter size
3. Face layer path count matches Return layer
4. Face offset from Return (face must be ≥0.3mm bigger per side)
5. Face spacing (≥0.10" between face letters)
6. Engraving path detection (non-circular inner paths inset ~0.4mm from face)

Key differences from trim cap (front_lit.py):
- Uses 'face' layer instead of 'trimcap'
- Smaller minimum offset (0.3mm vs 1.5mm)
- Tighter spacing tolerance (0.10" vs 0.15")
- Engraving path classification for non-circular inner paths

Hole classification is handled by _classify_holes_from_standards() in __init__.py.
Engraving classification runs after hole classification, before issue generation.
"""

from typing import List, Dict, Optional, Any

from ..core import PathInfo, ValidationIssue, LetterAnalysisResult, HoleInfo
from ..geometry import polygon_distance, buffer_polygon_with_mitre
from .legacy_analysis import (
    analyze_letters_in_layer,
    match_trim_to_return,
    convert_letter_groups_to_analysis,
)


def classify_engraving_paths(
    letter_analysis: LetterAnalysisResult,
    face_layer: str,
    rules: Dict,
) -> List[Dict[str, Any]]:
    """
    Classify non-circular inner paths on the face layer as engraving paths.

    For each face-layer LetterGroup, finds HoleInfo entries with diameter_mm == 0.0
    (non-circular inner paths) and compares their raw_bbox to the letter's raw_bbox.
    If all 4 insets are approximately equal to engraving_offset_mm (±tolerance),
    the hole is reclassified as 'engraving'.

    Args:
        letter_analysis: Pre-computed LetterAnalysisResult
        face_layer: Layer name for face paths (e.g. 'face')
        rules: Dict with engraving_offset_mm and engraving_offset_tolerance_mm

    Returns:
        List of issue dicts for face letters missing an engraving path
    """
    issues = []
    file_scale = rules.get('file_scale', 0.1)
    engraving_offset_mm = rules.get('engraving_offset_mm', 0.4)
    engraving_tolerance_mm = rules.get('engraving_offset_tolerance_mm', 0.15)

    if letter_analysis and letter_analysis.detected_scale:
        file_scale = letter_analysis.detected_scale

    # Convert offset from real mm to file units
    points_per_real_inch = 72 * file_scale
    mm_per_file_unit = 25.4 / points_per_real_inch

    for letter in letter_analysis.letter_groups:
        if letter.layer_name.lower() != face_layer.lower():
            continue

        letter_raw = letter.raw_bbox
        if not letter_raw or letter_raw == (0, 0, 0, 0):
            continue

        found_engraving = False

        for hole in letter.holes:
            # Only consider non-circular inner paths (diameter_mm == 0.0)
            if hole.diameter_mm > 0.0:
                continue
            # Skip already classified holes (wire/mounting)
            if hole.hole_type not in ('unknown', 'unclassified'):
                continue
            if not hole.raw_bbox:
                continue

            # Compute inset per side in file units, then convert to real mm
            left_inset = (hole.raw_bbox[0] - letter_raw[0]) * mm_per_file_unit
            top_inset = (hole.raw_bbox[1] - letter_raw[1]) * mm_per_file_unit
            right_inset = (letter_raw[2] - hole.raw_bbox[2]) * mm_per_file_unit
            bottom_inset = (letter_raw[3] - hole.raw_bbox[3]) * mm_per_file_unit

            insets = [left_inset, top_inset, right_inset, bottom_inset]

            # All 4 insets must be approximately engraving_offset_mm
            if all(abs(inset - engraving_offset_mm) <= engraving_tolerance_mm for inset in insets):
                hole.hole_type = 'engraving'
                hole.matched_name = 'Engraving Path'
                found_engraving = True

        if not found_engraving:
            issues.append({
                'rule': 'acrylic_face_engraving_missing',
                'severity': 'warning',
                'message': f'Face letter {letter.letter_id} has no engraving path',
                'path_id': letter.letter_id,
                'details': {
                    'layer': face_layer,
                    'letter_id': letter.letter_id,
                    'expected_offset_mm': engraving_offset_mm,
                    'tolerance_mm': engraving_tolerance_mm,
                }
            })

    return issues


def check_face_spacing(
    letter_analysis: LetterAnalysisResult,
    rules: Dict,
) -> List[ValidationIssue]:
    """
    Validate that face letters maintain at least the required clearance,
    using polygon shapes with buffered face offset.

    Same algorithm as check_trim_cap_spacing() but for face layer with
    different offset and spacing parameters.

    Args:
        letter_analysis: Pre-computed LetterAnalysisResult with polygon data
        rules: Dict with front_lit_acrylic_face_structure config

    Returns:
        List of ValidationIssue objects for spacing violations
    """
    issues = []

    return_layer = rules.get('return_layer', 'return')
    file_scale = rules.get('file_scale', 0.1)
    face_offset_min_mm = rules.get('face_offset_min_mm', 0.3)
    min_spacing_inches = rules.get('min_face_spacing_inches', 0.10)

    if letter_analysis and letter_analysis.detected_scale:
        file_scale = letter_analysis.detected_scale

    # Collect return layer letters with polygon data
    return_letters_with_poly = []
    for lg in letter_analysis.letter_groups:
        if lg.layer_name.lower() != return_layer.lower():
            continue
        if lg.main_path and lg.main_path.polygon is not None:
            return_letters_with_poly.append(lg)

    if len(return_letters_with_poly) < 2:
        return issues

    # Convert face offset from real mm to file units
    points_per_real_inch = 72 * file_scale
    face_buffer_file_units = face_offset_min_mm * points_per_real_inch / 25.4

    # Buffer each return letter polygon to simulate face shape
    buffered = []
    for lg in return_letters_with_poly:
        sim = buffer_polygon_with_mitre(
            lg.main_path.polygon, face_buffer_file_units, mitre_limit=4.0
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
                    rule='acrylic_face_spacing',
                    severity='error',
                    message=(
                        f'Face letters {lg_a.letter_id} and {lg_b.letter_id} '
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


def check_front_lit_acrylic_face_structure(
    paths_info: List[PathInfo],
    rules: Dict,
) -> List[ValidationIssue]:
    """
    Validate Front Lit Acrylic Face structural requirements.

    Rules:
    1. Mounting holes: Minimum based on letter size (perimeter and area)
    2. Face count: Face layer must have same number of letters as Return layer
    3. Face offset: Each face shape must be ≥0.3mm larger per side than return
    4. Face spacing: Face letters must be ≥0.10" apart

    Wire hole checks are handled per-letter in generate_letter_analysis_issues().
    Engraving classification runs separately via classify_engraving_paths().
    """
    issues = []

    # Configuration
    return_layer = rules.get('return_layer', 'return')
    face_layer = rules.get('face_layer', 'face')
    file_scale = rules.get('file_scale', 0.1)
    min_mounting_holes = rules.get('min_mounting_holes', 2)
    holes_per_inch_perimeter = rules.get('mounting_holes_per_inch_perimeter', 0.05)
    holes_per_sq_inch_area = rules.get('mounting_holes_per_sq_inch_area', 0.0123)
    face_offset_min_mm = rules.get('face_offset_min_mm', 0.3)

    # Pre-computed letter analysis
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
            rule='acrylic_face_structure',
            severity='warning',
            message=f'No letters found in "{return_layer}" layer. Available layers: {", ".join(layers_found)}',
            details={'available_layers': list(layers_found)}
        ))
        return issues

    issues.append(ValidationIssue(
        rule='acrylic_face_structure',
        severity='info',
        message=f'Found {len(return_letters)} letter(s) in {return_layer} layer',
        details={
            'layer': return_layer,
            'count': len(return_letters),
        }
    ))

    points_per_real_inch = 72 * file_scale

    # Extract standard mounting hole size
    standard_hole_sizes = rules.get('_standard_hole_sizes', [])
    mounting_std = next((s for s in standard_hole_sizes if s.get('category') == 'mounting'), None)
    mounting_std_diameter = mounting_std['diameter_mm'] if mounting_std else None
    mounting_std_name = mounting_std['name'] if mounting_std else None

    # Lookup for letter groups
    letter_group_lookup = {}
    if letter_analysis and letter_analysis.letter_groups:
        for lg in letter_analysis.letter_groups:
            letter_group_lookup[lg.letter_id] = lg

    # Rule 1: Mounting holes
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
            if mounting_std_diameter is not None:
                detail['mounting_std_diameter_mm'] = mounting_std_diameter
                detail['mounting_std_name'] = mounting_std_name

            lg = letter_group_lookup.get(letter.path_id)
            if lg:
                unknown = lg.unknown_holes
                detail['unknown_hole_count'] = len(unknown)
                if unknown:
                    detail['unknown_holes'] = [
                        {'path_id': h.path_id, 'diameter_real_mm': round(h.diameter_real_mm, 2)}
                        for h in unknown
                    ]

            issues.append(ValidationIssue(
                rule='acrylic_face_mounting_holes',
                severity='warning',
                message=f'Letter {letter.path_id} needs {required_holes} mounting holes, has {letter.mounting_hole_count}',
                path_id=letter.path_id,
                details=detail,
            ))

    # Rule 2: Face count — build face letters
    if letter_analysis and letter_analysis.letter_groups:
        face_letters = convert_letter_groups_to_analysis(letter_analysis, face_layer, file_scale)
    else:
        face_letters = analyze_letters_in_layer(paths_info, face_layer, rules)

    issues.append(ValidationIssue(
        rule='acrylic_face_structure',
        severity='info',
        message=f'Found {len(face_letters)} letter(s) in {face_layer} layer',
        details={
            'layer': face_layer,
            'count': len(face_letters),
        }
    ))

    if len(face_letters) == 0 and len(return_letters) > 0:
        issues.append(ValidationIssue(
            rule='acrylic_face_missing',
            severity='error',
            message=f'Working file must include a {face_layer} layer with letters',
            details={
                'face_layer': face_layer,
                'return_count': len(return_letters),
            }
        ))
    elif len(face_letters) != len(return_letters):
        issues.append(ValidationIssue(
            rule='acrylic_face_count',
            severity='error',
            message=f'{face_layer} layer has {len(face_letters)} letters, {return_layer} has {len(return_letters)}',
            details={
                'face_count': len(face_letters),
                'return_count': len(return_letters),
                'face_layer': face_layer,
                'return_layer': return_layer,
            }
        ))

    # Rule 3: Face offset
    max_match_distance = rules.get('max_match_distance', 10.0)
    mm_per_file_unit = 25.4 / points_per_real_inch

    if face_letters and return_letters:
        matches = match_trim_to_return(face_letters, return_letters)

        for face, return_match, distance in matches:
            if return_match is None or distance > max_match_distance:
                issues.append(ValidationIssue(
                    rule='acrylic_face_offset',
                    severity='warning',
                    message=f'Face letter {face.path_id} has no matching return letter (nearest {distance:.1f} units away)',
                    path_id=face.path_id,
                    details={
                        'face_path_id': face.path_id,
                        'nearest_return': return_match.path_id if return_match else None,
                        'distance': round(distance, 2),
                    }
                ))
                continue

            raw_width_diff = face.raw_width - return_match.raw_width
            raw_height_diff = face.raw_height - return_match.raw_height

            width_diff_mm = raw_width_diff * mm_per_file_unit
            height_diff_mm = raw_height_diff * mm_per_file_unit

            if width_diff_mm < 0 or height_diff_mm < 0:
                issues.append(ValidationIssue(
                    rule='acrylic_face_offset',
                    severity='error',
                    message=f'Return is larger than face for {face.path_id}',
                    path_id=face.path_id,
                    details={
                        'layer': face_layer,
                        'face_path_id': face.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                    }
                ))
                continue

            width_offset_per_side = width_diff_mm / 2
            height_offset_per_side = height_diff_mm / 2

            if width_offset_per_side < face_offset_min_mm or height_offset_per_side < face_offset_min_mm:
                issues.append(ValidationIssue(
                    rule='acrylic_face_offset',
                    severity='error',
                    message=(
                        f'Face {face.path_id} offset too small: '
                        f'{width_offset_per_side:.2f}mm W, {height_offset_per_side:.2f}mm H per side '
                        f'(min {face_offset_min_mm}mm)'
                    ),
                    path_id=face.path_id,
                    details={
                        'layer': face_layer,
                        'face_path_id': face.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                        'width_per_side_mm': round(width_offset_per_side, 2),
                        'height_per_side_mm': round(height_offset_per_side, 2),
                        'required_min_per_side_mm': face_offset_min_mm,
                    }
                ))

    # Rule 4: Face spacing (polygon-based)
    if letter_analysis and letter_analysis.letter_groups:
        issues.extend(check_face_spacing(letter_analysis, rules))

    return issues
