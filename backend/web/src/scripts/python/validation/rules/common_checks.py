"""
Common validation checks reusable across spec types.

These functions accept configurable thresholds so any spec type
(front_lit, halo_lit, etc.) can invoke them with its own values.
"""

from typing import List, Dict, Optional

from ..core import ValidationIssue, LetterAnalysisResult
from ..geometry import compute_hole_centering, get_centroid


def check_hole_centering(
    letter_analysis: LetterAnalysisResult,
    rules: Dict,
    return_layer: str = 'return',
    centering_threshold: float = 0.30,
    exempt_distance_inches: float = 2.0,
    target_hole_names: Optional[List[str]] = None,
    min_edge_distance_inches: float = 0.5,
    min_letter_size_inches: float = 3.0,
) -> List[ValidationIssue]:
    """
    Check that mounting holes are reasonably centered within the letter stroke.

    Off-center holes (too close to one edge) can cause structural issues for
    pin thread and rivnut mounting types.

    Args:
        letter_analysis: Pre-computed LetterAnalysisResult with polygon data
        rules: Dict with validation config (file_scale, etc.)
        return_layer: Layer name for return paths
        centering_threshold: Warn if centering_ratio < this (0.5 = centered)
        exempt_distance_inches: Skip if nearest edge > this (wide stroke)
        target_hole_names: matched_name values to check (e.g. ['Pin Thread Mounting', 'Rivnut'])
        min_edge_distance_inches: Warn if hole < this from nearest edge
        min_letter_size_inches: Skip letters smaller than this in width or height

    Returns:
        List of ValidationIssue objects
    """
    if target_hole_names is None:
        target_hole_names = ['Pin Thread Mounting', 'Rivnut']

    if not letter_analysis or not letter_analysis.letter_groups:
        return []

    issues: List[ValidationIssue] = []

    file_scale = rules.get('file_scale', 0.1)
    if letter_analysis.detected_scale:
        file_scale = letter_analysis.detected_scale

    points_per_real_inch = 72 * file_scale
    on_edge_threshold_inches = 0.01  # ~0.25mm — effectively on the edge

    for letter in letter_analysis.letter_groups:
        if letter.layer_name.lower() != return_layer.lower():
            continue

        polygon = letter.main_path.polygon if letter.main_path else None
        if polygon is None:
            continue

        # Skip small letters — centering/edge checks aren't meaningful
        real_w, real_h = letter.real_size_inches if letter.real_size_inches else (0, 0)
        if real_w < min_letter_size_inches or real_h < min_letter_size_inches:
            continue

        for hole in letter.mounting_holes:
            if hole.matched_name not in target_hole_names:
                continue

            # hole.center is in raw/untransformed coords (for SVG rendering),
            # but letter.main_path.polygon is in transformed global coords.
            # Use the transformed bbox to get a center in matching coord space.
            hole_center = get_centroid(hole.bbox) if hole.bbox else hole.center
            result = compute_hole_centering(polygon, hole_center)
            if result is None:
                continue

            d_min_inches = result['d_min'] / points_per_real_inch
            d_opposite_inches = result['d_opposite'] / points_per_real_inch
            stroke_width_inches = result['stroke_width'] / points_per_real_inch

            # Error: hole is on the letter edge
            if result.get('on_edge') or d_min_inches < on_edge_threshold_inches:
                issues.append(ValidationIssue(
                    rule='hole_centering',
                    severity='error',
                    message=(
                        f'{hole.matched_name} hole {hole.path_id} in letter '
                        f'{letter.letter_id} is on the letter edge'
                    ),
                    path_id=hole.path_id,
                    details={
                        'letter_id': letter.letter_id,
                        'hole_matched_name': hole.matched_name,
                        'd_min_inches': round(d_min_inches, 4),
                        'centering_ratio': 0.0,
                    }
                ))
                continue

            # Error: rays missed boundary (hole outside or open path)
            if result['rays_missed'] == len(result['ray_results']):
                issues.append(ValidationIssue(
                    rule='hole_centering',
                    severity='error',
                    message=(
                        f'{hole.matched_name} hole {hole.path_id} in letter '
                        f'{letter.letter_id} may be outside the letter boundary'
                    ),
                    path_id=hole.path_id,
                    details={
                        'letter_id': letter.letter_id,
                        'hole_matched_name': hole.matched_name,
                        'rays_missed': result['rays_missed'],
                    }
                ))
                continue

            # Warning: hole too close to nearest edge
            if d_min_inches < min_edge_distance_inches:
                issues.append(ValidationIssue(
                    rule='hole_centering',
                    severity='warning',
                    message=(
                        f'{hole.matched_name} hole {hole.path_id} in letter '
                        f'{letter.letter_id} is only {d_min_inches:.2f}" from '
                        f'the nearest edge (minimum {min_edge_distance_inches:.2f}")'
                    ),
                    path_id=hole.path_id,
                    details={
                        'letter_id': letter.letter_id,
                        'hole_matched_name': hole.matched_name,
                        'd_min_inches': round(d_min_inches, 4),
                        'd_opposite_inches': round(d_opposite_inches, 4),
                        'min_edge_distance_inches': min_edge_distance_inches,
                    }
                ))
                # Do NOT continue — still check centering ratio below

            # Exempt: wide stroke — centering doesn't matter structurally
            if d_min_inches >= exempt_distance_inches:
                continue

            # Warning: off-center
            if result['centering_ratio'] < centering_threshold:
                issues.append(ValidationIssue(
                    rule='hole_centering',
                    severity='warning',
                    message=(
                        f'{hole.matched_name} hole {hole.path_id} in letter '
                        f'{letter.letter_id} may be off-center \u2014 '
                        f'{d_min_inches:.2f}" from nearest edge vs '
                        f'{d_opposite_inches:.2f}" from opposite edge'
                    ),
                    path_id=hole.path_id,
                    details={
                        'letter_id': letter.letter_id,
                        'hole_matched_name': hole.matched_name,
                        'd_min_inches': round(d_min_inches, 4),
                        'd_opposite_inches': round(d_opposite_inches, 4),
                        'stroke_width_inches': round(stroke_width_inches, 4),
                        'centering_ratio': round(result['centering_ratio'], 4),
                        'ray_results': result['ray_results'],
                    }
                ))

    return issues
