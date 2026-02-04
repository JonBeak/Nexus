"""
Core data structures and types for AI file validation.
"""

from dataclasses import dataclass, asdict, field
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


@dataclass
class HoleInfo:
    """Information about a classified hole within a letter."""
    path_id: str
    hole_type: str  # 'wire', 'mounting', 'unknown'
    diameter_mm: float
    center: Tuple[float, float]
    svg_path_data: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'path_id': self.path_id,
            'hole_type': self.hole_type,
            'diameter_mm': round(self.diameter_mm, 3),
            'center': {'x': round(self.center[0], 2), 'y': round(self.center[1], 2)},
            'svg_path_data': self.svg_path_data
        }


@dataclass
class LetterGroup:
    """A letter with its associated paths and holes."""
    letter_id: str                           # Unique identifier (path_id)
    main_path: 'PathInfo'                    # The outer letter boundary
    counter_paths: List['PathInfo'] = field(default_factory=list)   # Inner counter paths (like inside "O", "A", "B")
    wire_holes: List[HoleInfo] = field(default_factory=list)        # Holes for LED wiring (~1mm at 10% scale)
    mounting_holes: List[HoleInfo] = field(default_factory=list)    # Holes for mounting (~0.4mm at 10% scale)
    unknown_holes: List[HoleInfo] = field(default_factory=list)     # Holes that don't match known sizes
    layer_name: str = ''                     # Source layer
    bbox: Tuple[float, float, float, float] = (0, 0, 0, 0)  # Combined bounding box
    area: float = 0.0                        # Net area (main - counters)
    detected_scale: float = 1.0              # Detected file scale (0.1 or 1.0)
    real_size_inches: Tuple[float, float] = (0, 0)  # Real-world size (width, height)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'letter_id': self.letter_id,
            'layer_name': self.layer_name,
            'file_bbox': {
                'x': round(self.bbox[0], 2),
                'y': round(self.bbox[1], 2),
                'width': round(self.bbox[2] - self.bbox[0], 2),
                'height': round(self.bbox[3] - self.bbox[1], 2)
            },
            'real_size_inches': {
                'width': round(self.real_size_inches[0], 2),
                'height': round(self.real_size_inches[1], 2)
            },
            'real_area_sq_inches': round(self.area, 2),
            'detected_scale': self.detected_scale,
            'svg_path_data': self.main_path.d_attribute if self.main_path else '',
            'counter_paths': [p.d_attribute for p in self.counter_paths],
            'holes': (
                [h.to_dict() for h in self.wire_holes] +
                [h.to_dict() for h in self.mounting_holes] +
                [h.to_dict() for h in self.unknown_holes]
            ),
            'wire_hole_count': len(self.wire_holes),
            'mounting_hole_count': len(self.mounting_holes),
            'unknown_hole_count': len(self.unknown_holes)
        }


@dataclass
class LetterAnalysisResult:
    """Complete result of letter-hole analysis."""
    letter_groups: List[LetterGroup] = field(default_factory=list)  # All identified letters with holes
    orphan_holes: List[HoleInfo] = field(default_factory=list)      # Holes not inside any letter (ERRORS)
    unassigned_paths: List['PathInfo'] = field(default_factory=list)  # Paths that couldn't be classified
    detected_scale: float = 1.0              # Detected file scale
    stats: Dict[str, Any] = field(default_factory=dict)  # Summary statistics

    def to_dict(self) -> Dict[str, Any]:
        return {
            'letters': [lg.to_dict() for lg in self.letter_groups],
            'orphan_holes': [h.to_dict() for h in self.orphan_holes],
            'detected_scale': self.detected_scale,
            'stats': {
                'total_letters': len(self.letter_groups),
                'total_wire_holes': sum(len(lg.wire_holes) for lg in self.letter_groups),
                'total_mounting_holes': sum(len(lg.mounting_holes) for lg in self.letter_groups),
                'total_unknown_holes': sum(len(lg.unknown_holes) for lg in self.letter_groups),
                'orphan_count': len(self.orphan_holes),
                **self.stats
            }
        }
