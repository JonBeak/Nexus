"""
Core data structures and types for AI file validation.
"""

from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any, Tuple


@dataclass
class ValidationIssue:
    """Represents a single validation issue found in the file."""
    rule: str
    severity: str  # 'error', 'warning', 'info'
    message: str
    path_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PathInfo:
    """Information about a parsed path."""
    path_id: str
    d_attribute: str
    stroke: Optional[str]
    stroke_width: Optional[float]
    fill: Optional[str]
    transform: Optional[str]
    bbox: Optional[Tuple[float, float, float, float]]
    length: float
    area: Optional[float]
    is_closed: bool
    num_holes: int
    layer_name: Optional[str] = None
    transform_chain: Optional[str] = None
    is_circle: bool = False
    circle_diameter: Optional[float] = None
    polygon: Optional[Any] = None  # Shapely Polygon for geometric containment checks


@dataclass
class LetterAnalysis:
    """Analysis of a single letter (outside closed path) in a layer."""
    path_id: str
    layer: str
    bbox: Tuple[float, float, float, float]
    width: float
    height: float
    area: float
    perimeter: float
    centroid: Tuple[float, float]
    contained_holes: List[Dict[str, Any]]
    wire_hole_count: int
    mounting_hole_count: int


@dataclass
class ValidationResult:
    """Complete validation result for a file."""
    success: bool
    file_path: str
    file_name: str
    status: str  # 'passed', 'failed', 'warning', 'error'
    issues: List[ValidationIssue]
    stats: Dict[str, Any]
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'status': self.status,
            'issues': [issue.to_dict() for issue in self.issues],
            'stats': self.stats,
            'error': self.error
        }
