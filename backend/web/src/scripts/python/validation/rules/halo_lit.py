"""
Halo Lit Channel Letter Validation Rules

Return layer: letter outlines (must have NO holes)
Back layer: back panel, SMALLER than return (wire+mounting holes)
Face layer: front face, LARGER than return (overhang)
"""

from typing import List, Dict, Optional, Any

from ..core import PathInfo, ValidationIssue, LetterAnalysisResult
from .legacy_analysis import (
    analyze_letters_in_layer,
    match_trim_to_return,
    convert_letter_groups_to_analysis,
)
from .common_checks import check_hole_centering


def generate_halo_lit_letter_issues(
    analysis: LetterAnalysisResult,
    rules: Dict,
) -> List[Dict[str, Any]]:
    """Per-letter issues: return must have no holes, back gets wire+mounting checks."""
    all_issues = []

    back_layer = rules.get('back_layer', 'back')
    return_layer = rules.get('return_layer', 'return')
    expected_mounting_names = rules.get('expected_mounting_names')
    check_wire_holes = rules.get('check_wire_holes', True)

    for letter in analysis.letter_groups:
        layer_lower = letter.layer_name.lower()

        # --- Return layer: must have NO holes ---
        if layer_lower == return_layer.lower():
            all_holes = letter.wire_holes + letter.mounting_holes + letter.unknown_holes
            if len(all_holes) > 0:
                hole_summary = []
                if letter.wire_holes:
                    hole_summary.append(f'{len(letter.wire_holes)} wire')
                if letter.mounting_holes:
                    hole_summary.append(f'{len(letter.mounting_holes)} mounting')
                if letter.unknown_holes:
                    hole_summary.append(f'{len(letter.unknown_holes)} unknown')
                summary_str = ', '.join(hole_summary)

                issue = {
                    'rule': 'halo_lit_return_no_holes',
                    'severity': 'error',
                    'message': f'Return letter {letter.letter_id} has holes ({summary_str}) — return layer must have no holes',
                    'path_id': letter.letter_id,
                    'details': {
                        'layer': letter.layer_name,
                        'wire_count': len(letter.wire_holes),
                        'mounting_count': len(letter.mounting_holes),
                        'unknown_count': len(letter.unknown_holes),
                    }
                }
                all_issues.append(issue)
                letter.issues.append(issue)
            continue

        # --- Back layer: wire holes + mounting holes ---
        if layer_lower != back_layer.lower():
            continue

        if check_wire_holes:
            if len(letter.wire_holes) == 0:
                issue = {
                    'rule': 'halo_lit_back_wire_hole',
                    'severity': 'error',
                    'message': f'Back letter {letter.letter_id} has no wire hole',
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

            if len(letter.wire_holes) > 1:
                issue = {
                    'rule': 'halo_lit_back_multiple_wire_holes',
                    'severity': 'warning',
                    'message': f'Back letter {letter.letter_id} has {len(letter.wire_holes)} wire holes, expected 1',
                    'path_id': letter.letter_id,
                    'details': {
                        'wire_hole_count': len(letter.wire_holes),
                        'wire_holes': [h.to_dict() for h in letter.wire_holes]
                    }
                }
                all_issues.append(issue)
                letter.issues.append(issue)
        else:
            # Wire holes not required — warn if present
            if len(letter.wire_holes) > 0:
                issue = {
                    'rule': 'halo_lit_back_unexpected_wire_hole',
                    'severity': 'warning',
                    'message': f'Back letter {letter.letter_id} has {len(letter.wire_holes)} wire hole(s) but order has no LEDs spec',
                    'path_id': letter.letter_id,
                    'details': {
                        'wire_hole_count': len(letter.wire_holes),
                        'wire_holes': [h.to_dict() for h in letter.wire_holes]
                    }
                }
                all_issues.append(issue)
                letter.issues.append(issue)

        # Unexpected mounting type
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
                    'message': f'Back letter {letter.letter_id} has {count}x {mtype} hole{"s" if count > 1 else ""} (expected {expected_str})',
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
                'message': f'Hole {hole.path_id} in back letter {letter.letter_id} has unusual diameter {hole.diameter_real_mm:.2f}mm',
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


def check_halo_lit_structure(
    paths_info: List[PathInfo],
    rules: Dict,
) -> List[ValidationIssue]:
    """Structural validation: layer counts, offsets (back smaller, face larger), mounting holes."""
    issues = []

    # Configuration
    return_layer = rules.get('return_layer', 'return')
    back_layer = rules.get('back_layer', 'back')
    face_layer = rules.get('face_layer', 'face')
    file_scale = rules.get('file_scale', 0.1)
    min_mounting_holes = rules.get('min_mounting_holes', 2)
    holes_per_inch_perimeter = rules.get('mounting_holes_per_inch_perimeter', 0.05)
    holes_per_sq_inch_area = rules.get('mounting_holes_per_sq_inch_area', 0.0123)
    back_offset_min_mm = rules.get('back_offset_min_mm', 2.0)
    face_offset_min_mm = rules.get('face_offset_min_mm', 1.2)
    miter_factor = rules.get('miter_factor', 4.5)

    # Pre-computed letter analysis
    letter_analysis: Optional[LetterAnalysisResult] = rules.get('_letter_analysis')

    # Build return letters
    if letter_analysis and letter_analysis.letter_groups:
        return_letters = convert_letter_groups_to_analysis(letter_analysis, return_layer, file_scale)
        if letter_analysis.detected_scale:
            file_scale = letter_analysis.detected_scale
    else:
        return_letters = analyze_letters_in_layer(paths_info, return_layer, rules)

    if not return_letters:
        layers_found = set(p.layer_name for p in paths_info if p.layer_name)
        issues.append(ValidationIssue(
            rule='halo_lit_structure',
            severity='warning',
            message=f'No letters found in "{return_layer}" layer. Available layers: {", ".join(layers_found)}',
            details={'available_layers': list(layers_found)}
        ))
        return issues

    issues.append(ValidationIssue(
        rule='halo_lit_structure',
        severity='info',
        message=f'Found {len(return_letters)} letter(s) in {return_layer} layer',
        details={
            'layer': return_layer,
            'count': len(return_letters),
            'letters': [{'path_id': l.path_id, 'centroid': l.centroid, 'width': round(l.width, 1), 'height': round(l.height, 1)} for l in return_letters]
        }
    ))

    points_per_real_inch = 72 * file_scale
    mm_per_file_unit = 25.4 / points_per_real_inch

    # Standard hole sizes for mounting detail
    standard_hole_sizes = rules.get('_standard_hole_sizes', [])
    mounting_std = next((s for s in standard_hole_sizes if s.get('category') == 'mounting'), None)
    mounting_std_diameter = mounting_std['diameter_mm'] if mounting_std else None
    mounting_std_name = mounting_std['name'] if mounting_std else None

    # LetterGroup lookup for unknown hole details
    letter_group_lookup = {}
    if letter_analysis and letter_analysis.letter_groups:
        for lg in letter_analysis.letter_groups:
            letter_group_lookup[lg.letter_id] = lg

    # --- Back layer checks ---
    if letter_analysis and letter_analysis.letter_groups:
        back_letters = convert_letter_groups_to_analysis(letter_analysis, back_layer, file_scale)
    else:
        back_letters = analyze_letters_in_layer(paths_info, back_layer, rules)

    issues.append(ValidationIssue(
        rule='halo_lit_structure',
        severity='info',
        message=f'Found {len(back_letters)} letter(s) in {back_layer} layer',
        details={'layer': back_layer, 'count': len(back_letters)}
    ))

    if len(back_letters) == 0 and len(return_letters) > 0:
        issues.append(ValidationIssue(
            rule='halo_lit_back_missing',
            severity='error',
            message=f'Working file must include a {back_layer} layer with letters',
            details={'back_layer': back_layer, 'return_count': len(return_letters)}
        ))
    elif len(back_letters) != len(return_letters):
        issues.append(ValidationIssue(
            rule='halo_lit_back_count',
            severity='error',
            message=f'{back_layer} layer has {len(back_letters)} letters, {return_layer} has {len(return_letters)}',
            details={
                'back_count': len(back_letters),
                'return_count': len(return_letters),
                'back_layer': back_layer,
                'return_layer': return_layer,
            }
        ))

    # Back mounting holes
    for letter in back_letters:
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
                rule='halo_lit_back_mounting',
                severity='warning',
                message=f'Back letter {letter.path_id} needs {required_holes} mounting holes, has {letter.mounting_hole_count}',
                path_id=letter.path_id,
                details=detail,
            ))

    # Back offset: back must be SMALLER than return
    max_match_distance = rules.get('max_match_distance', 10.0)
    back_offset_max_mm = back_offset_min_mm * miter_factor

    if back_letters and return_letters:
        matches = match_trim_to_return(back_letters, return_letters)

        for back, return_match, distance in matches:
            if return_match is None or distance > max_match_distance:
                issues.append(ValidationIssue(
                    rule='halo_lit_back_offset',
                    severity='warning',
                    message=f'Back letter {back.path_id} has no matching return letter (nearest {distance:.1f} units away)',
                    path_id=back.path_id,
                    details={
                        'back_path_id': back.path_id,
                        'nearest_return': return_match.path_id if return_match else None,
                        'distance': round(distance, 2),
                    }
                ))
                continue

            # Back should be SMALLER than return
            raw_width_diff = return_match.raw_width - back.raw_width
            raw_height_diff = return_match.raw_height - back.raw_height

            width_diff_mm = raw_width_diff * mm_per_file_unit
            height_diff_mm = raw_height_diff * mm_per_file_unit

            if width_diff_mm < 0 or height_diff_mm < 0:
                issues.append(ValidationIssue(
                    rule='halo_lit_back_offset',
                    severity='error',
                    message=f'Back letter {back.path_id} is larger than return (should be smaller)',
                    path_id=back.path_id,
                    details={
                        'layer': back_layer,
                        'back_path_id': back.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                    }
                ))
                continue

            width_offset_per_side_mm = width_diff_mm / 2
            height_offset_per_side_mm = height_diff_mm / 2

            _tol = 0.05  # mm — SVG coordinate precision margin
            width_ok = (back_offset_min_mm - _tol) <= width_offset_per_side_mm <= (back_offset_max_mm + _tol)
            height_ok = (back_offset_min_mm - _tol) <= height_offset_per_side_mm <= (back_offset_max_mm + _tol)

            if not width_ok or not height_ok:
                expected_total_min = back_offset_min_mm * 2
                expected_total_max = back_offset_max_mm * 2

                issues.append(ValidationIssue(
                    rule='halo_lit_back_offset',
                    severity='error',
                    message=f'Back {back.path_id} offset: {width_diff_mm:.1f}mm W x {height_diff_mm:.1f}mm H (expected {expected_total_min:.1f}-{expected_total_max:.1f}mm total)',
                    path_id=back.path_id,
                    details={
                        'layer': back_layer,
                        'back_path_id': back.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                        'width_per_side_mm': round(width_offset_per_side_mm, 2),
                        'height_per_side_mm': round(height_offset_per_side_mm, 2),
                        'centroid_distance': round(distance, 2),
                        'expected_min_per_side_mm': back_offset_min_mm,
                        'expected_max_per_side_mm': back_offset_max_mm,
                        'miter_factor': miter_factor,
                    }
                ))

    # --- Face layer checks ---
    if letter_analysis and letter_analysis.letter_groups:
        face_letters = convert_letter_groups_to_analysis(letter_analysis, face_layer, file_scale)
    else:
        face_letters = analyze_letters_in_layer(paths_info, face_layer, rules)

    issues.append(ValidationIssue(
        rule='halo_lit_structure',
        severity='info',
        message=f'Found {len(face_letters)} letter(s) in {face_layer} layer',
        details={'layer': face_layer, 'count': len(face_letters)}
    ))

    if len(face_letters) == 0 and len(return_letters) > 0:
        issues.append(ValidationIssue(
            rule='halo_lit_face_missing',
            severity='error',
            message=f'Working file must include a {face_layer} layer with letters',
            details={'face_layer': face_layer, 'return_count': len(return_letters)}
        ))
    elif len(face_letters) != len(return_letters):
        issues.append(ValidationIssue(
            rule='halo_lit_face_count',
            severity='error',
            message=f'{face_layer} layer has {len(face_letters)} letters, {return_layer} has {len(return_letters)}',
            details={
                'face_count': len(face_letters),
                'return_count': len(return_letters),
                'face_layer': face_layer,
                'return_layer': return_layer,
            }
        ))

    # Face offset: face must be LARGER than return
    face_offset_max_mm = face_offset_min_mm * miter_factor

    if face_letters and return_letters:
        matches = match_trim_to_return(face_letters, return_letters)

        for face, return_match, distance in matches:
            if return_match is None or distance > max_match_distance:
                issues.append(ValidationIssue(
                    rule='halo_lit_face_offset',
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

            # Face should be LARGER than return
            raw_width_diff = face.raw_width - return_match.raw_width
            raw_height_diff = face.raw_height - return_match.raw_height

            width_diff_mm = raw_width_diff * mm_per_file_unit
            height_diff_mm = raw_height_diff * mm_per_file_unit

            if width_diff_mm < 0 or height_diff_mm < 0:
                issues.append(ValidationIssue(
                    rule='halo_lit_face_offset',
                    severity='error',
                    message=f'Face letter {face.path_id} is smaller than return (should be larger)',
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

            width_offset_per_side_mm = width_diff_mm / 2
            height_offset_per_side_mm = height_diff_mm / 2

            _tol = 0.05  # mm — SVG coordinate precision margin
            width_ok = (face_offset_min_mm - _tol) <= width_offset_per_side_mm <= (face_offset_max_mm + _tol)
            height_ok = (face_offset_min_mm - _tol) <= height_offset_per_side_mm <= (face_offset_max_mm + _tol)

            if not width_ok or not height_ok:
                expected_total_min = face_offset_min_mm * 2
                expected_total_max = face_offset_max_mm * 2

                issues.append(ValidationIssue(
                    rule='halo_lit_face_offset',
                    severity='error',
                    message=f'Face {face.path_id} offset: {width_diff_mm:.1f}mm W x {height_diff_mm:.1f}mm H (expected {expected_total_min:.1f}-{expected_total_max:.1f}mm total)',
                    path_id=face.path_id,
                    details={
                        'layer': face_layer,
                        'face_path_id': face.path_id,
                        'return_path_id': return_match.path_id,
                        'width_diff_mm': round(width_diff_mm, 2),
                        'height_diff_mm': round(height_diff_mm, 2),
                        'width_per_side_mm': round(width_offset_per_side_mm, 2),
                        'height_per_side_mm': round(height_offset_per_side_mm, 2),
                        'centroid_distance': round(distance, 2),
                        'expected_min_per_side_mm': face_offset_min_mm,
                        'expected_max_per_side_mm': face_offset_max_mm,
                        'miter_factor': miter_factor,
                    }
                ))

    # Mounting hole centering on back layer
    if letter_analysis and letter_analysis.letter_groups:
        issues.extend(check_hole_centering(
            letter_analysis, rules,
            return_layer=back_layer,
            centering_threshold=rules.get('hole_centering_ratio_threshold', 0.30),
            exempt_distance_inches=rules.get('hole_centering_exempt_inches', 2.0),
            target_hole_names=rules.get('hole_centering_names', ['Pin Thread Mounting', 'Rivnut']),
            min_edge_distance_inches=rules.get('hole_centering_min_edge_inches', 0.5),
            min_letter_size_inches=rules.get('hole_centering_min_letter_size_inches', 3.0),
        ))

    return issues
