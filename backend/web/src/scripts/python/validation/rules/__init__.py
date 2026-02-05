"""
Spec-type specific validation rules.

Each module in this package implements validation rules for a specific
sign type (front_lit, halo_lit, non_lit, etc.)
"""

from .front_lit import (
    check_front_lit_structure,
    classify_holes_in_analysis,
    generate_letter_analysis_issues,
    FRONT_LIT_HOLE_CONFIG,
)

__all__ = [
    'check_front_lit_structure',
    'classify_holes_in_analysis',
    'generate_letter_analysis_issues',
    'FRONT_LIT_HOLE_CONFIG',
]
