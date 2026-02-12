/**
 * Issue Detail Renderers
 * Specialized expanded-content renderers for different validation rule types.
 * Extracted from IssueDisplay.tsx to keep file sizes manageable.
 */

import React from 'react';
import { ValidationIssue, LetterDetail } from '../../../../../types/aiFileValidation';
import LetterSvgPreview from '../LetterSvgPreview';

interface RendererProps {
  issue: ValidationIssue;
  matchedLetter?: LetterDetail;
}

/** Mounting hole requirements (front_lit_mounting_holes, acrylic_face_mounting_holes) */
export const MountingHolesRenderer: React.FC<RendererProps> = ({ issue, matchedLetter }) => {
  const d = issue.details!;
  return (
    <div className="mt-2 p-2 bg-white rounded flex gap-4">
      {matchedLetter && (
        <div className="flex-shrink-0">
          <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="font-medium text-gray-500">Required</dt>
          <dd className="text-gray-700">{d.required_holes} mounting holes</dd>
          <dt className="font-medium text-gray-500">Detected</dt>
          <dd className="text-gray-700">{d.actual_holes} mounting holes</dd>
          {d.mounting_std_name && (
            <>
              <dt className="font-medium text-gray-500">Expected size</dt>
              <dd className="text-gray-700">{d.mounting_std_name} ({d.mounting_std_diameter_mm}mm)</dd>
            </>
          )}
          <dt className="font-medium text-gray-500">Letter size</dt>
          <dd className="text-gray-700">{d.real_perimeter_inches}&quot; perimeter, {d.real_area_sq_inches} sq in</dd>
        </dl>
        {d.unknown_hole_count > 0 && (
          <div className="border border-orange-200 bg-orange-50 rounded p-2">
            <p className="text-xs font-medium text-orange-700 mb-1">
              {d.unknown_hole_count} unknown hole{d.unknown_hole_count !== 1 ? 's' : ''} detected
            </p>
            {d.unknown_holes && (
              <ul className="text-xs text-orange-600 space-y-0.5">
                {(d.unknown_holes as Array<{ path_id: string; diameter_real_mm: number }>).map(
                  (h: { path_id: string; diameter_real_mm: number }) => (
                    <li key={h.path_id}>{h.path_id}: {h.diameter_real_mm}mm diameter</li>
                  )
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** Hole centering issues */
export const HoleCenteringRenderer: React.FC<RendererProps> = ({ issue, matchedLetter }) => {
  const d = issue.details!;
  return (
    <div className="mt-2 p-2 bg-white rounded flex gap-4">
      {matchedLetter && (
        <div className="flex-shrink-0">
          <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} highlightHoleIds={issue.path_id ? [issue.path_id] : undefined} />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {d.hole_matched_name && (
            <>
              <dt className="font-medium text-gray-500">Hole type</dt>
              <dd className="text-gray-700">{d.hole_matched_name}</dd>
            </>
          )}
          {d.d_min_inches != null && (
            <>
              <dt className="font-medium text-gray-500">Nearest edge</dt>
              <dd className="text-gray-700">{Number(d.d_min_inches).toFixed(2)}&quot;</dd>
            </>
          )}
          {d.d_opposite_inches != null && (
            <>
              <dt className="font-medium text-gray-500">Opposite edge</dt>
              <dd className="text-gray-700">{Number(d.d_opposite_inches).toFixed(2)}&quot;</dd>
            </>
          )}
          {d.centering_ratio != null && (
            <>
              <dt className="font-medium text-gray-500">Centering ratio</dt>
              <dd className="text-gray-700">{(Number(d.centering_ratio) * 100).toFixed(0)}%</dd>
            </>
          )}
          {d.min_edge_distance_inches != null && (
            <>
              <dt className="font-medium text-gray-500">Min edge distance</dt>
              <dd className="text-gray-700">{Number(d.min_edge_distance_inches).toFixed(2)}&quot;</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
};

/** Sharp corners visualization with diamond markers */
export const SharpCornersRenderer: React.FC<RendererProps> = ({ issue, matchedLetter }) => {
  const d = issue.details!;
  const corners = (d.sharp_corners || []) as Array<{ x: number; y: number; is_convex: boolean }>;
  const convexCount = corners.filter(c => c.is_convex).length;
  const concaveCount = corners.filter(c => !c.is_convex).length;

  return (
    <div className="mt-2 p-2 bg-white rounded flex gap-4">
      {matchedLetter && (
        <div className="flex-shrink-0">
          <LetterSvgPreview
            letter={matchedLetter}
            maxWidth={200}
            maxHeight={150}
            showGrid={true}
            showRuler={false}
            highlightPoints={corners}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="font-medium text-gray-500">Sharp corners</dt>
          <dd className="text-gray-700">{d.sharp_count}</dd>
          {convexCount > 0 && (
            <>
              <dt className="font-medium text-gray-500">Convex</dt>
              <dd className="text-gray-700">{convexCount} (outer corners)</dd>
            </>
          )}
          {concaveCount > 0 && (
            <>
              <dt className="font-medium text-gray-500">Concave</dt>
              <dd className="text-gray-700">{concaveCount} (inner corners)</dd>
            </>
          )}
        </dl>
        <p className="text-xs text-gray-500">
          Red diamonds mark sharp corners that need radius applied.
        </p>
      </div>
    </div>
  );
};

/** Default fallback — key-value pairs from details */
export const DefaultIssueRenderer: React.FC<RendererProps> = ({ issue, matchedLetter }) => {
  const detailEntries = Object.entries(issue.details!).filter(([key]) => key !== 'path_id' && key !== 'layer');

  return (
    <div className="mt-2 p-2 bg-white rounded flex gap-4">
      {matchedLetter && (
        <div className="flex-shrink-0">
          <LetterSvgPreview letter={matchedLetter} maxWidth={200} maxHeight={150} showGrid={true} showRuler={false} />
        </div>
      )}
      {detailEntries.length > 0 && (
        <div className="flex-1 min-w-0">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {detailEntries.map(([key, value]) => (
              <React.Fragment key={key}>
                <dt className="font-medium text-gray-500 whitespace-nowrap">{key.replace(/_/g, ' ')}</dt>
                <dd className="text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};
