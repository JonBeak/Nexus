"""
Core data structures and types for AI file validation.
"""

from dataclasses import dataclass, asdict, field
from typing import List, Optional, Dict, Any, Tuple


def _transform_for_svg(transform_chain: str) -> str:
    """Convert pipe-separated transform chain to space-separated for SVG."""
    if not transform_chain:
        return ''
    # SVG uses space-separated transforms, not pipe-separated
    return ' '.join(transform_chain.split('|'))


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
    is_compound: bool = False      # True if path has multiple subpaths (M...Z M...Z)
    num_subpaths: int = 1          # Number of continuous subpaths


@dataclass
class LetterAnalysis:
    """Analysis of a single letter (outside closed path) in a layer."""
    path_id: str
    layer: str
    bbox: Tuple[float, float, float, float]
    width: float          # Transformed coordinate width (for centroid matching)
    height: float         # Transformed coordinate height (for centroid matching)
    area: float
    perimeter: float
    centroid: Tuple[float, float]
    contained_holes: List[Dict[str, Any]]
    wire_hole_count: int
    mounting_hole_count: int
    raw_width: float = 0.0   # Untransformed width in file units (for size comparison)
    raw_height: float = 0.0  # Untransformed height in file units (for size comparison)


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
    """Information about a hole within a letter. Created unclassified by geometry layer,
    classified later by spec-specific rules (e.g. front_lit classifies as wire/mounting)."""
    path_id: str
    hole_type: str = 'unclassified'  # 'unclassified' -> classified to 'wire', 'mounting', or 'unknown' by rules
    diameter_mm: float = 0.0  # File units (points) - used for SVG rendering
    center: Tuple[float, float] = (0.0, 0.0)
    svg_path_data: str = ''
    transform: str = ''  # SVG transform chain for this hole
    diameter_real_mm: float = 0.0  # Actual diameter in millimeters
    fill: Optional[str] = None     # Original SVG fill color
    stroke: Optional[str] = None   # Original SVG stroke color
    matched_name: str = ''         # Label from standard_hole_sizes (e.g. "LED Wire Hole")
    matched_size_id: Optional[int] = None  # ID from standard_hole_sizes table
    layer_name: str = ''           # Source layer name
    raw_bbox: Optional[Tuple[float, float, float, float]] = None  # Raw bbox for SVG viewBox

    def to_dict(self) -> Dict[str, Any]:
        # Safety net: map 'unclassified' to 'unknown' for frontend contract
        display_type = self.hole_type if self.hole_type != 'unclassified' else 'unknown'
        result = {
            'path_id': self.path_id,
            'hole_type': display_type,
            'diameter_mm': round(self.diameter_mm, 3),
            'diameter_real_mm': round(self.diameter_real_mm, 2),
            'center': {'x': round(self.center[0], 2), 'y': round(self.center[1], 2)},
            'svg_path_data': self.svg_path_data,
            'transform': _transform_for_svg(self.transform),
            'layer_name': self.layer_name,
        }
        if self.raw_bbox:
            result['file_bbox'] = {
                'x': round(self.raw_bbox[0], 2),
                'y': round(self.raw_bbox[1], 2),
                'width': round(self.raw_bbox[2] - self.raw_bbox[0], 2),
                'height': round(self.raw_bbox[3] - self.raw_bbox[1], 2),
            }
        if self.fill:
            result['fill'] = self.fill
        if self.stroke:
            result['stroke'] = self.stroke
        if self.matched_name:
            result['matched_name'] = self.matched_name
        if self.matched_size_id is not None:
            result['matched_size_id'] = self.matched_size_id
        return result


@dataclass
class LetterGroup:
    """A letter with its associated paths and holes.
    Holes are stored unclassified; spec-specific rules classify them later."""
    letter_id: str                           # Unique identifier (path_id)
    main_path: 'PathInfo'                    # The outer letter boundary
    counter_paths: List['PathInfo'] = field(default_factory=list)   # Legacy — counters are now baked into compound paths
    holes: List[HoleInfo] = field(default_factory=list)             # All holes (classified or unclassified)
    layer_name: str = ''                     # Source layer
    bbox: Tuple[float, float, float, float] = (0, 0, 0, 0)  # Transformed bbox (for size calcs)
    raw_bbox: Tuple[float, float, float, float] = (0, 0, 0, 0)  # Raw bbox (matches SVG path coords)
    transform: str = ''                      # SVG transform to apply to path
    area: float = 0.0                        # Net area (main - counters)
    perimeter: float = 0.0                   # Real-world perimeter in inches
    detected_scale: float = 1.0              # Detected file scale (0.1 or 1.0)
    real_size_inches: Tuple[float, float] = (0, 0)  # Real-world size (width, height)
    issues: List[Dict[str, Any]] = field(default_factory=list)  # Backend-generated validation issues

    @property
    def wire_holes(self) -> List[HoleInfo]:
        """Holes classified as wire holes."""
        return [h for h in self.holes if h.hole_type == 'wire']

    @property
    def mounting_holes(self) -> List[HoleInfo]:
        """Holes classified as mounting holes."""
        return [h for h in self.holes if h.hole_type == 'mounting']

    @property
    def unknown_holes(self) -> List[HoleInfo]:
        """Holes classified as unknown or still unclassified."""
        return [h for h in self.holes if h.hole_type in ('unknown', 'unclassified')]

    def to_dict(self) -> Dict[str, Any]:
        # Use TRANSFORMED bbox for file_bbox (viewBox needs global coordinates)
        # The SVG paths are rendered with their transform attribute, so the viewBox
        # must encompass the transformed coordinates for correct positioning
        bbox_for_display = self.bbox if self.bbox != (0, 0, 0, 0) else self.raw_bbox
        return {
            'letter_id': self.letter_id,
            'layer_name': self.layer_name,
            'file_bbox': {
                'x': round(bbox_for_display[0], 2),
                'y': round(bbox_for_display[1], 2),
                'width': round(bbox_for_display[2] - bbox_for_display[0], 2),
                'height': round(bbox_for_display[3] - bbox_for_display[1], 2)
            },
            'transform': _transform_for_svg(self.transform),
            'real_size_inches': {
                'width': round(self.real_size_inches[0], 2),
                'height': round(self.real_size_inches[1], 2)
            },
            'real_area_sq_inches': round(self.area, 2),
            'real_perimeter_inches': round(self.perimeter, 2),
            'detected_scale': self.detected_scale,
            'svg_path_data': self.main_path.d_attribute if self.main_path else '',
            'counter_paths': [
                {
                    'd': p.d_attribute,
                    'transform': _transform_for_svg(p.transform_chain) if p.transform_chain else ''
                }
                for p in self.counter_paths
            ],
            'holes': [h.to_dict() for h in self.holes],
            'wire_hole_count': len(self.wire_holes),
            'mounting_hole_count': len(self.mounting_holes),
            'unknown_hole_count': len(self.unknown_holes),
            'issues': self.issues
        }


@dataclass
class LetterAnalysisResult:
    """Complete result of letter-hole analysis."""
    letter_groups: List[LetterGroup] = field(default_factory=list)  # All identified letters with holes
    orphan_holes: List[HoleInfo] = field(default_factory=list)      # Holes not inside any letter (ERRORS)
    unassigned_paths: List['PathInfo'] = field(default_factory=list)  # Paths that couldn't be classified
    unprocessed_paths: List[Dict[str, Any]] = field(default_factory=list)  # All non-letter/non-hole paths with reasons
    detected_scale: float = 1.0              # Detected file scale
    stats: Dict[str, Any] = field(default_factory=dict)  # Summary statistics
    issues: List[Dict[str, Any]] = field(default_factory=list)  # Analysis-level validation issues

    def to_dict(self) -> Dict[str, Any]:
        return {
            'letters': [lg.to_dict() for lg in self.letter_groups],
            'orphan_holes': [h.to_dict() for h in self.orphan_holes],
            'unprocessed_paths': self.unprocessed_paths,
            'detected_scale': self.detected_scale,
            'issues': self.issues,
            'stats': {
                'total_letters': len(self.letter_groups),
                'total_wire_holes': sum(len(lg.wire_holes) for lg in self.letter_groups),
                'total_mounting_holes': sum(len(lg.mounting_holes) for lg in self.letter_groups),
                'total_unknown_holes': sum(len(lg.unknown_holes) for lg in self.letter_groups),
                'orphan_count': len(self.orphan_holes),
                **self.stats
            }
        }
