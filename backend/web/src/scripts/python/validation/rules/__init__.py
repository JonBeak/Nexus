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

__all__ = [
    'check_front_lit_structure',
    'generate_letter_analysis_issues',
    'check_front_lit_acrylic_face_structure',
    'classify_engraving_paths',
]
