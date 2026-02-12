"""
Spec-type specific validation rules.

Each module in this package implements validation rules for a specific
sign type (front_lit, halo_lit, non_lit, etc.)
"""

from .front_lit import (
    check_front_lit_structure,
    generate_letter_analysis_issues,
)

from .front_lit_acrylic_face import (
    check_front_lit_acrylic_face_structure,
    classify_engraving_paths,
)

from .halo_lit import (
    check_halo_lit_structure,
    generate_halo_lit_letter_issues,
)

from .push_thru import check_push_thru_structure

from .common_checks import check_hole_centering

__all__ = [
    'check_front_lit_structure',
    'generate_letter_analysis_issues',
    'check_front_lit_acrylic_face_structure',
    'classify_engraving_paths',
    'check_halo_lit_structure',
    'generate_halo_lit_letter_issues',
    'check_push_thru_structure',
    'check_hole_centering',
]
