"""
Push Thru Validation Rules

Push Thru signs have acrylic letters that push through backer panel cutouts.

Architecture:
- Backer layer: compound paths (outer box + letter cutouts as interior rings)
- Acrylic layer: individual letter shapes
- Lexan layer: simple paths containing groups of backer cutouts
- LED box: non-compound rectangular path on backer layer, inside backer box

Key differences from channel letter types:
- No per-letter holes (no wire or mounting holes)
- Compound path decomposition to extract box + cutouts
- Corner radius analysis on both acrylic and cutout paths
- Multi-layer containment (lexan must contain all cutouts)
"""

from typing import List, Dict, Optional

from ..core import PathInfo, ValidationIssue, LetterAnalysisResult
from .push_thru_helpers import (
    decompose_backer_compounds,
    match_acrylic_to_cutouts,
    check_cutout_offset,
    check_corner_radii_for_path,
    check_lexan_layer,
)

RULES_CHECKED = [
    'push_thru_cutout_count',
    'push_thru_cutout_offset',
    'push_thru_sharp_corners',
    'push_thru_acrylic_corner_radius',
    'push_thru_cutout_corner_radius',
    'push_thru_acrylic_inset',
    'push_thru_lexan_exists',
    'push_thru_lexan_simple',
    'push_thru_lexan_containment',
    'push_thru_lexan_inset',
    'push_thru_lexan_area_ratio',
    'push_thru_lexan_cutout_clearance',
]


# Re-import suppressed to avoid duplicate — already imported above
from ..core import PathInfo, ValidationIssue, LetterAnalysisResult  # noqa: E402,F811
from .push_thru_helpers import (
    decompose_backer_compounds,
    match_acrylic_to_cutouts,
    check_cutout_offset,
    check_corner_radii_for_path,
    check_lexan_layer,
)


def check_push_thru_structure(
    paths_info: List[PathInfo],
    rules: Dict,
) -> List[ValidationIssue]:
    """
    Main entry point for Push Thru validation.

    Steps:
    1. Decompose backer compound paths → box(es) + cutouts
    2. Find acrylic letters on acrylic layer
    3. Match acrylic to cutouts, validate count
    4. Validate cutout offset (0.8mm uniform rounded offset)
    5. Validate corner radii on acrylic and cutouts
    6. Validate acrylic inset from box edge (≥3")
    7. Validate lexan layer (exists, simple, contains all cutouts, inset)
    8. Validate LED box (exists, offset from backer)
    """
    issues = []

    # Configuration from DB profile
    backer_layer = rules.get('backer_layer', 'backer')
    acrylic_layer = rules.get('acrylic_layer', 'push_thru_acrylic')
    lexan_layer = rules.get('lexan_layer', 'lexan')
    file_scale = rules.get('file_scale', 0.1)

    cutout_offset_mm = rules.get('cutout_offset_mm', 0.8)
    cutout_offset_tol_mm = rules.get('cutout_offset_tolerance_mm', 0.05)
    corner_tol_pct = rules.get('corner_radius_tolerance_pct', 0.05)
    acrylic_convex_r = rules.get('acrylic_convex_radius_inches', 0.028)
    acrylic_concave_r = rules.get('acrylic_concave_radius_inches', 0.059)
    cutout_convex_r = rules.get('cutout_convex_radius_inches', 0.059)
    cutout_concave_r = rules.get('cutout_concave_radius_inches', 0.028)
    min_acrylic_inset_inches = rules.get('min_acrylic_inset_from_box_inches', 3.0)
    lexan_inset_inches = rules.get('lexan_inset_from_box_inches', 2.25)
    max_cutout_area_ratio = rules.get('max_cutout_area_ratio', 0.67)
    min_lexan_cutout_clearance = rules.get('min_lexan_cutout_clearance_inches', 0.25)
    # Use detected scale if available from letter analysis
    letter_analysis: Optional[LetterAnalysisResult] = rules.get('_letter_analysis')
    if letter_analysis and letter_analysis.detected_scale:
        file_scale = letter_analysis.detected_scale

    points_per_real_inch = 72 * file_scale

    # --- Step 1: Decompose backer layer ---
    boxes, cutouts = decompose_backer_compounds(paths_info, backer_layer)

    layers_found = set(p.layer_name for p in paths_info if p.layer_name)

    issues.append(ValidationIssue(
        rule='push_thru_structure',
        severity='info',
        message=(
            f'Backer: {len(boxes)} box(es), {len(cutouts)} cutout(s). '
            f'Layers: {", ".join(sorted(layers_found))}'
        ),
        details={
            'backer_boxes': len(boxes),
            'backer_cutouts': len(cutouts),
            'layers': list(sorted(layers_found)),
        }
    ))

    if not boxes:
        issues.append(ValidationIssue(
            rule='push_thru_structure',
            severity='warning',
            message=f'No compound paths with cutouts found on "{backer_layer}" layer',
            details={'available_layers': list(sorted(layers_found))}
        ))
        return issues

    # --- Step 2: Find acrylic letters ---
    acrylic_paths = [
        p for p in paths_info
        if p.layer_name and p.layer_name.lower() == acrylic_layer.lower()
        and p.is_closed and not p.is_circle and p.polygon is not None
    ]

    issues.append(ValidationIssue(
        rule='push_thru_structure',
        severity='info',
        message=f'Found {len(acrylic_paths)} acrylic letter(s) on {acrylic_layer} layer',
        details={'acrylic_count': len(acrylic_paths), 'layer': acrylic_layer}
    ))

    if not acrylic_paths:
        issues.append(ValidationIssue(
            rule='push_thru_cutout_count',
            severity='error',
            message=f'No acrylic letters found on "{acrylic_layer}" layer',
            details={'available_layers': list(sorted(layers_found))}
        ))
        return issues

    # --- Step 3: Match acrylic ↔ cutouts ---
    matches = match_acrylic_to_cutouts(acrylic_paths, cutouts)

    unmatched_acrylic = [m[0] for m in matches if m[1] is None]
    matched_cutout_count = sum(1 for m in matches if m[1] is not None)
    unmatched_cutout_count = len(cutouts) - matched_cutout_count

    if len(acrylic_paths) != len(cutouts):
        issues.append(ValidationIssue(
            rule='push_thru_cutout_count',
            severity='error',
            message=(
                f'Cutout count ({len(cutouts)}) does not match '
                f'acrylic count ({len(acrylic_paths)})'
            ),
            details={
                'cutout_count': len(cutouts),
                'acrylic_count': len(acrylic_paths),
                'unmatched_acrylic': len(unmatched_acrylic),
                'unmatched_cutouts': unmatched_cutout_count,
            }
        ))

    for acrylic in unmatched_acrylic:
        issues.append(ValidationIssue(
            rule='push_thru_cutout_count',
            severity='error',
            message=f'Acrylic letter {acrylic.path_id} has no matching backer cutout',
            path_id=acrylic.path_id,
        ))

    # --- Step 4: Cutout offset validation ---
    for acrylic, cutout, dist in matches:
        if cutout is None or acrylic.polygon is None:
            continue

        offset_issue = check_cutout_offset(
            acrylic.polygon, cutout, cutout_offset_mm, cutout_offset_tol_mm, file_scale
        )
        if offset_issue:
            sides = offset_issue['offsets_mm']
            issues.append(ValidationIssue(
                rule='push_thru_cutout_offset',
                severity='error',
                message=(
                    f'Cutout for {acrylic.path_id} offset is wrong '
                    f'(L:{sides["left"]}mm R:{sides["right"]}mm '
                    f'T:{sides["top"]}mm B:{sides["bottom"]}mm, '
                    f'expected {cutout_offset_mm}mm \u00b1{cutout_offset_tol_mm}mm)'
                ),
                path_id=acrylic.path_id,
                details=offset_issue,
            ))

    # --- Step 5: Corner radius validation ---
    _check_acrylic_corners(issues, acrylic_paths, file_scale,
                           acrylic_convex_r, acrylic_concave_r, corner_tol_pct)
    _check_cutout_corners(issues, paths_info, backer_layer, file_scale,
                          cutout_convex_r, cutout_concave_r, corner_tol_pct)

    # --- Step 6: Acrylic inset from box edge ---
    _check_acrylic_inset(issues, acrylic_paths, boxes,
                         min_acrylic_inset_inches, points_per_real_inch)

    # --- Step 7: Lexan layer validation ---
    check_lexan_layer(issues, paths_info, lexan_layer, layers_found, boxes,
                      cutouts, lexan_inset_inches, max_cutout_area_ratio,
                      min_lexan_cutout_clearance, points_per_real_inch)

    return issues


def _check_acrylic_corners(
    issues: List[ValidationIssue],
    acrylic_paths: List[PathInfo],
    file_scale: float,
    convex_r: float,
    concave_r: float,
    tol_pct: float,
) -> None:
    """Validate corner radii on acrylic letter paths."""
    for acrylic in acrylic_paths:
        violations = check_corner_radii_for_path(
            acrylic, file_scale,
            min_convex_inches=convex_r,
            min_concave_inches=concave_r,
            tolerance_pct=tol_pct,
            is_compound_interior=False,
        )
        sharp_count = sum(1 for v in violations if v['type'] == 'sharp')
        undersized = [v for v in violations if v['type'] != 'sharp']

        if sharp_count > 0:
            issues.append(ValidationIssue(
                rule='push_thru_sharp_corners',
                severity='error',
                message=f'Acrylic letter {acrylic.path_id} has {sharp_count} sharp corner(s)',
                path_id=acrylic.path_id,
                details={
                    'sharp_count': sharp_count,
                    'sharp_corners': [
                        {'x': round(v['position'][0], 2), 'y': round(v['position'][1], 2), 'is_convex': v['is_convex']}
                        for v in violations if v['type'] == 'sharp'
                    ],
                },
            ))

        if undersized:
            parts = _format_radius_violations(undersized, convex_r, concave_r)
            issues.append(ValidationIssue(
                rule='push_thru_acrylic_corner_radius',
                severity='error',
                message=f'Acrylic {acrylic.path_id} undersized radii: {"; ".join(parts)}',
                path_id=acrylic.path_id,
                details={'violations': undersized},
            ))


def _check_cutout_corners(
    issues: List[ValidationIssue],
    paths_info: List[PathInfo],
    backer_layer: str,
    file_scale: float,
    convex_r: float,
    concave_r: float,
    tol_pct: float,
) -> None:
    """Validate corner radii on backer cutout paths."""
    backer_compounds = [
        p for p in paths_info
        if p.layer_name and p.layer_name.lower() == backer_layer.lower()
        and p.is_compound and p.polygon is not None
        and hasattr(p.polygon, 'interiors') and len(p.polygon.interiors) > 0
    ]
    for compound_path in backer_compounds:
        violations = check_corner_radii_for_path(
            compound_path, file_scale,
            min_convex_inches=convex_r,
            min_concave_inches=concave_r,
            tolerance_pct=tol_pct,
            is_compound_interior=True,
        )
        sharp_count = sum(1 for v in violations if v['type'] == 'sharp')
        undersized = [v for v in violations if v['type'] != 'sharp']

        if sharp_count > 0:
            issues.append(ValidationIssue(
                rule='push_thru_sharp_corners',
                severity='error',
                message=f'Backer cutout(s) in {compound_path.path_id} have {sharp_count} sharp corner(s)',
                path_id=compound_path.path_id,
                details={
                    'sharp_count': sharp_count,
                    'layer': backer_layer,
                    'sharp_corners': [
                        {'x': round(v['position'][0], 2), 'y': round(v['position'][1], 2), 'is_convex': v['is_convex']}
                        for v in violations if v['type'] == 'sharp'
                    ],
                },
            ))

        if undersized:
            parts = _format_radius_violations(undersized, convex_r, concave_r)
            issues.append(ValidationIssue(
                rule='push_thru_cutout_corner_radius',
                severity='error',
                message=f'Cutout(s) in {compound_path.path_id} undersized radii: {"; ".join(parts)}',
                path_id=compound_path.path_id,
                details={'violations': undersized, 'layer': backer_layer},
            ))


def _format_radius_violations(undersized: list, convex_r: float, concave_r: float) -> list:
    """Format radius violation details into human-readable parts."""
    parts = []
    convex_v = [v for v in undersized if 'convex' in v['type']]
    concave_v = [v for v in undersized if 'concave' in v['type']]
    if convex_v:
        worst = min(v['radius_inches'] for v in convex_v)
        parts.append(f'{len(convex_v)} convex (worst {worst:.4f}", min {convex_r}")')
    if concave_v:
        worst = min(v['radius_inches'] for v in concave_v)
        parts.append(f'{len(concave_v)} concave (worst {worst:.4f}", min {concave_r}")')
    return parts


def _check_acrylic_inset(
    issues: List[ValidationIssue],
    acrylic_paths: List[PathInfo],
    boxes: list,
    min_inset_inches: float,
    points_per_real_inch: float,
) -> None:
    """Validate acrylic letters are far enough from backer box edges."""
    for acrylic in acrylic_paths:
        if acrylic.polygon is None:
            continue

        best_inset = float('inf')
        for box in boxes:
            try:
                dist = acrylic.polygon.boundary.distance(box.boundary)
                best_inset = min(best_inset, dist)
            except Exception:
                continue

        if best_inset < float('inf'):
            inset_inches = best_inset / points_per_real_inch
            if inset_inches < min_inset_inches:
                issues.append(ValidationIssue(
                    rule='push_thru_acrylic_inset',
                    severity='error',
                    message=(
                        f'Acrylic {acrylic.path_id} is {inset_inches:.2f}" from box edge '
                        f'(min {min_inset_inches}")'
                    ),
                    path_id=acrylic.path_id,
                    details={
                        'inset_inches': round(inset_inches, 3),
                        'required_inches': min_inset_inches,
                    },
                ))


