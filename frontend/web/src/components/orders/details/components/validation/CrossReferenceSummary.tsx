/**
 * CrossReferenceSummary Component
 * Compact comparison table across all validated files (Working + Cutting)
 * Shows letter counts, perimeter, and area for cross-verification
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  FileValidationResult,
  LetterAnalysisResponse,
} from '../../../../../types/aiFileValidation';

interface CrossReferenceSummaryProps {
  results: FileValidationResult[];
}

interface FileSummaryRow {
  fileName: string;
  fileType: 'working' | 'cutting' | undefined;
  scale: number;
  letterCount: number;
  totalPerimeter: number;  // inches
  totalArea: number;       // sq inches
  layers: LayerRow[];
}

interface LayerRow {
  layerName: string;
  letterCount: number;
  totalPerimeter: number;
  totalArea: number;
}

function buildSummaryRows(results: FileValidationResult[]): FileSummaryRow[] {
  const rows: FileSummaryRow[] = [];

  for (const result of results) {
    const analysis = result.stats?.letter_analysis as LetterAnalysisResponse | undefined;
    if (!analysis || !analysis.letters || analysis.letters.length === 0) continue;

    const scale = analysis.detected_scale || (result.file_type === 'cutting' ? 1.0 : 0.1);

    // Group letters by layer
    const layerMap = new Map<string, { count: number; perimeter: number; area: number }>();
    let totalPerimeter = 0;
    let totalArea = 0;

    for (const letter of analysis.letters) {
      const layer = letter.layer_name || 'default';
      const existing = layerMap.get(layer) || { count: 0, perimeter: 0, area: 0 };
      existing.count++;
      existing.perimeter += letter.real_perimeter_inches || 0;
      existing.area += letter.real_area_sq_inches || 0;
      layerMap.set(layer, existing);

      totalPerimeter += letter.real_perimeter_inches || 0;
      totalArea += letter.real_area_sq_inches || 0;
    }

    const layers: LayerRow[] = [];
    for (const [layerName, data] of layerMap) {
      layers.push({
        layerName,
        letterCount: data.count,
        totalPerimeter: data.perimeter,
        totalArea: data.area,
      });
    }
    layers.sort((a, b) => a.layerName.localeCompare(b.layerName));

    rows.push({
      fileName: result.file_name,
      fileType: result.file_type,
      scale,
      letterCount: analysis.letters.length,
      totalPerimeter,
      totalArea,
      layers,
    });
  }

  return rows;
}

/** Check if there are mismatches worth highlighting between working file layers and cutting files */
function findMismatches(rows: FileSummaryRow[]): Map<string, boolean> {
  const mismatches = new Map<string, boolean>();
  const workingRow = rows.find(r => r.fileType === 'working');
  if (!workingRow || workingRow.layers.length === 0) return mismatches;

  const cuttingRows = rows.filter(r => r.fileType === 'cutting');
  if (cuttingRows.length === 0) return mismatches;

  // For each working file layer, see if any cutting file has a different letter count
  for (const layer of workingRow.layers) {
    // Try to find a cutting file whose name loosely matches this layer
    const layerLower = layer.layerName.toLowerCase();
    const matchingCutting = cuttingRows.find(c => {
      const nameLower = c.fileName.toLowerCase().replace(/\.ai$/, '');
      // Match: "Returns.ai" ↔ "return", "Trimcaps.ai" ↔ "trimcap"
      return nameLower.includes(layerLower) || layerLower.includes(nameLower)
        || nameLower.includes(layerLower.replace(/s$/, ''))
        || layerLower.includes(nameLower.replace(/s$/, ''));
    });

    if (matchingCutting && matchingCutting.letterCount !== layer.letterCount) {
      mismatches.set(layer.layerName, true);
      mismatches.set(matchingCutting.fileName, true);
    }
  }

  return mismatches;
}

function fmt(n: number, decimals: number = 1): string {
  return n.toFixed(decimals);
}

const CrossReferenceSummary: React.FC<CrossReferenceSummaryProps> = ({ results }) => {
  const rows = buildSummaryRows(results);

  // Need at least 2 files with letter analysis to show cross-reference
  if (rows.length < 2) return null;

  const mismatches = findMismatches(rows);
  const hasMismatches = mismatches.size > 0;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-300 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Cross-Reference Summary</span>
        {hasMismatches && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Mismatches
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs">
              <th className="text-left px-3 py-2 font-medium">File</th>
              <th className="text-center px-3 py-2 font-medium">Type</th>
              <th className="text-center px-3 py-2 font-medium">Scale</th>
              <th className="text-center px-3 py-2 font-medium">Letters</th>
              <th className="text-right px-3 py-2 font-medium">Perimeter</th>
              <th className="text-right px-3 py-2 font-medium">Area</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <React.Fragment key={row.fileName}>
                {/* File row */}
                <tr className={`border-t border-gray-200 ${mismatches.has(row.fileName) ? 'bg-yellow-50' : ''}`}>
                  <td className="px-3 py-1.5 font-medium text-gray-800">{row.fileName}</td>
                  <td className="text-center px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      row.fileType === 'working'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {row.fileType === 'working' ? 'Working' : 'Cutting'}
                    </span>
                  </td>
                  <td className="text-center px-3 py-1.5 text-gray-600">
                    {Math.round(row.scale * 100)}%
                  </td>
                  <td className="text-center px-3 py-1.5 font-medium text-gray-800">
                    {row.letterCount}
                  </td>
                  <td className="text-right px-3 py-1.5 text-gray-600">
                    {fmt(row.totalPerimeter)}"
                  </td>
                  <td className="text-right px-3 py-1.5 text-gray-600">
                    {fmt(row.totalArea)} in&sup2;
                  </td>
                </tr>
                {/* Layer sub-rows (only for working files with multiple layers) */}
                {row.fileType === 'working' && row.layers.length > 1 && row.layers.map((layer) => (
                  <tr
                    key={`${row.fileName}-${layer.layerName}`}
                    className={`border-t border-gray-100 text-xs ${mismatches.has(layer.layerName) ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-3 py-1 pl-6 text-gray-500">
                      <span className="text-gray-400 mr-1">&lfloor;</span>
                      {layer.layerName}
                    </td>
                    <td></td>
                    <td></td>
                    <td className="text-center px-3 py-1 text-gray-600">{layer.letterCount}</td>
                    <td className="text-right px-3 py-1 text-gray-500">{fmt(layer.totalPerimeter)}"</td>
                    <td className="text-right px-3 py-1 text-gray-500">{fmt(layer.totalArea)} in&sup2;</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CrossReferenceSummary;
