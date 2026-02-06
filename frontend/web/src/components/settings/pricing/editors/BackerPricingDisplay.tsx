/**
 * BackerPricingDisplay - Backer pricing overview with inline hinged raceway editing
 *
 * Shows calculated backer pricing from:
 * - Substrate costs (read-only, link to Substrate & Cutting)
 * - Angle/assembly costs (read-only, link to Miscellaneous)
 * - Hinged raceway prices (editable inline from hinged_raceway_pricing table)
 * - Structural constants + formula + calculated price grids
 */

import React, { useEffect, useState } from 'react';
import { Info, Calculator, Grid3X3, DollarSign, Loader2, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { PricingDataResource, SubstrateCutPricing, MiscPricingMap, HingedRacewayPricing } from '../../../../services/pricingDataResource';
import { pricingManagementApi } from '../../../../services/api/pricingManagementApi';
import {
  BACKER_CONSTANTS,
  ACM_CONSTANTS,
  generateBackerLookupTables,
  BackerLookupTables
} from '../../../jobEstimation/core/calculations/backerPricingLookup';

interface SubstrateInputs {
  aluminum: SubstrateCutPricing | null;
  acmSmall: SubstrateCutPricing | null;
  acmLarge: SubstrateCutPricing | null;
}

interface BaseConstants {
  markupMultiplier: number;
  shippingPerSheet: number;
}

interface MiscDisplayValues {
  angleLinearDivisor: number;
  alumAngle: number; alumAssembly: number; alumMounting: number;
  alumPerCut: number; alumTotal: number;
  acmAngle: number; acmAssembly: number; acmMounting: number;
  acmPerCut: number; acmTotal: number;
}

function scrollToSection(sectionId: string) {
  const el = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Flash the section to draw attention
    el.classList.add('ring-2', 'ring-blue-400');
    setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2000);
  }
}

export const BackerPricingDisplay: React.FC = () => {
  const [substrates, setSubstrates] = useState<SubstrateInputs>({ aluminum: null, acmSmall: null, acmLarge: null });
  const [baseConstants, setBaseConstants] = useState<BaseConstants>({ markupMultiplier: 1.25, shippingPerSheet: 50 });
  const [miscDisplay, setMiscDisplay] = useState<MiscDisplayValues | null>(null);
  const [racewayRows, setRacewayRows] = useState<HingedRacewayPricing[]>([]);
  const [lookupTables, setLookupTables] = useState<BackerLookupTables | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hinged raceway inline editing state
  const [editingRacewayId, setEditingRacewayId] = useState<number | null>(null);
  const [editRacewayPrice, setEditRacewayPrice] = useState('');
  const [savingRaceway, setSavingRaceway] = useState(false);

  useEffect(() => { loadData(); }, []);

  function buildMiscDisplay(misc: MiscPricingMap): MiscDisplayValues {
    const alumAngle = misc['alum_angle_cost'] ?? 50;
    const alumAssembly = misc['alum_assembly_cost'] ?? 50;
    const alumMounting = misc['alum_mounting_angle_cost'] ?? 50;
    const acmAngle = misc['acm_angle_cost'] ?? 75;
    const acmAssembly = misc['acm_assembly_cost'] ?? 100;
    const acmMounting = misc['acm_mounting_angle_cost'] ?? 50;
    return {
      angleLinearDivisor: misc['angle_linear_divisor'] ?? 240,
      alumAngle, alumAssembly, alumMounting,
      alumPerCut: misc['alum_per_angle_cut'] ?? 25,
      alumTotal: alumAngle + alumAssembly + alumMounting,
      acmAngle, acmAssembly, acmMounting,
      acmPerCut: misc['acm_per_length_cut'] ?? 25,
      acmTotal: acmAngle + acmAssembly + acmMounting
    };
  }

  async function loadData() {
    try {
      setLoading(true);
      const [alumP, acmSmallP, acmLargeP, baseMap, miscMap, rwRows, tables] = await Promise.all([
        PricingDataResource.getSubstrateCutPricing('Alum 0.040"'),
        PricingDataResource.getSubstrateCutPricing(ACM_CONSTANTS.SMALL_PANEL.NAME),
        PricingDataResource.getSubstrateCutPricing(ACM_CONSTANTS.LARGE_PANEL.NAME),
        PricingDataResource.getSubstrateCutBasePricingMap(),
        PricingDataResource.getMiscPricingMap(),
        PricingDataResource.getHingedRacewayPricing(),
        generateBackerLookupTables()
      ]);
      setSubstrates({ aluminum: alumP, acmSmall: acmSmallP, acmLarge: acmLargeP });
      setBaseConstants({
        markupMultiplier: Number(baseMap['material_markup_multiplier']) || 1.25,
        shippingPerSheet: Number(baseMap['material_base_cost']) || 50
      });
      setMiscDisplay(buildMiscDisplay(miscMap));
      setRacewayRows(rwRows);
      setLookupTables(tables);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  }

  // Hinged raceway inline edit handlers
  function startRacewayEdit(row: HingedRacewayPricing) {
    setEditingRacewayId(row.id);
    setEditRacewayPrice(Number(row.price).toFixed(2));
  }

  function cancelRacewayEdit() {
    setEditingRacewayId(null);
    setEditRacewayPrice('');
  }

  async function saveRacewayEdit(row: HingedRacewayPricing) {
    setSavingRaceway(true);
    try {
      await pricingManagementApi.updateRow('hinged_raceway_pricing', row.id, {
        price: parseFloat(editRacewayPrice)
      });
      PricingDataResource.clearCache();
      setEditingRacewayId(null);
      await loadData(); // Reload everything so lookup tables recalculate
    } catch (err) {
      console.error('Failed to save raceway price:', err);
    } finally {
      setSavingRaceway(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading backer pricing data...
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>;
  }

  function computeTotalSheetCost(substrate: SubstrateCutPricing | null): string {
    if (!substrate) return 'N/A';
    const total = (Number(substrate.material_cost_per_sheet) * baseConstants.markupMultiplier) + Number(substrate.cutting_rate_per_sheet);
    return `$${total.toFixed(2)}`;
  }

  return (
    <div className="space-y-5">
      {/* A) Info Banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          Backer prices are calculated from substrate costs, angle/assembly costs,
          and hinged raceway prices. Hinged raceway is editable below.
          Substrate and angle costs can be edited in their respective sections.
        </p>
      </div>

      {/* B) Substrate Inputs (read-only, link to Substrate & Cutting) */}
      <Section
        icon={<DollarSign className="h-4 w-4" />}
        title="Substrate Inputs"
        editAction={{ label: 'Edit in Substrate & Cutting', sectionId: 'substrate-cutting' }}
      >
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <Th>Substrate</Th>
              <Th align="right">Material $/Sheet</Th>
              <Th align="right">Cutting $/Sheet</Th>
              <Th align="right">Markup</Th>
              <Th align="right">Shipping/Sheet</Th>
              <Th align="right">Total Sheet Cost</Th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Alum 0.040"', data: substrates.aluminum },
              { label: ACM_CONSTANTS.SMALL_PANEL.NAME, data: substrates.acmSmall },
              { label: ACM_CONSTANTS.LARGE_PANEL.NAME, data: substrates.acmLarge }
            ].map(({ label, data }) => (
              <tr key={label} className="border-t border-gray-100">
                <Td className="font-medium text-gray-700">{label}</Td>
                <Td align="right">{data ? `$${Number(data.material_cost_per_sheet).toFixed(2)}` : 'N/A'}</Td>
                <Td align="right">{data ? `$${Number(data.cutting_rate_per_sheet).toFixed(2)}` : 'N/A'}</Td>
                <Td align="right">{baseConstants.markupMultiplier}x</Td>
                <Td align="right">${baseConstants.shippingPerSheet.toFixed(2)}</Td>
                <Td align="right" className="font-semibold text-gray-800">{computeTotalSheetCost(data)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* C) Angle & Assembly Costs (read-only, link to Miscellaneous) */}
      {miscDisplay && (
        <Section
          icon={<Calculator className="h-4 w-4" />}
          title="Angle & Assembly Costs"
          editAction={{ label: 'Edit in Miscellaneous', sectionId: 'miscellaneous' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConstantCard title="Aluminum Backer">
              <ConstantRow label="1.25\" Angle" value={`$${miscDisplay.alumAngle}`} />
              <ConstantRow label="Assembly" value={`$${miscDisplay.alumAssembly}`} />
              <ConstantRow label="Mounting angle" value={`$${miscDisplay.alumMounting}`} />
              <ConstantRow label="Total angle cost" value={`$${miscDisplay.alumTotal} per ${miscDisplay.angleLinearDivisor}" linear`} />
              <ConstantRow label="Per angle cut" value={`$${miscDisplay.alumPerCut}`} />
              <ConstantRow label="Perimeter type" value="Horizontal only (top + bottom)" />
            </ConstantCard>
            <ConstantCard title="ACM Backer">
              <ConstantRow label="2\" Angle" value={`$${miscDisplay.acmAngle}`} />
              <ConstantRow label="Assembly + VHB" value={`$${miscDisplay.acmAssembly}`} />
              <ConstantRow label="Mounting angle" value={`$${miscDisplay.acmMounting}`} />
              <ConstantRow label="Total angle cost" value={`$${miscDisplay.acmTotal} per ${miscDisplay.angleLinearDivisor}" linear`} />
              <ConstantRow label="Per length cut" value={`$${miscDisplay.acmPerCut}`} />
              <ConstantRow label="Perimeter type" value="Full perimeter" />
            </ConstantCard>
          </div>
        </Section>
      )}

      {/* D) Hinged Raceway Pricing (editable inline) */}
      <Section icon={<DollarSign className="h-4 w-4" />} title="Hinged Raceway Pricing">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Max Width</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Price</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 w-16">Edit</th>
              </tr>
            </thead>
            <tbody>
              {racewayRows.map(row => {
                const isEditing = editingRacewayId === row.id;
                return (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-700">
                      ≤ {Number(row.category_max_width)}"
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editRacewayPrice}
                          onChange={e => setEditRacewayPrice(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRacewayEdit(row); if (e.key === 'Escape') cancelRacewayEdit(); }}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs text-right"
                          autoFocus
                        />
                      ) : (
                        <span className="font-mono font-medium">${Number(row.price).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.config_description}</td>
                    <td className="px-3 py-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={cancelRacewayEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => saveRacewayEdit(row)}
                            disabled={savingRaceway}
                            className="p-1 text-green-500 hover:text-green-700"
                            title="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startRacewayEdit(row)} className="p-1 text-gray-400 hover:text-blue-600" title="Edit price">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* E) Structural Constants */}
      <Section icon={<Calculator className="h-4 w-4" />} title="Structural Constants">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConstantCard title="Aluminum Grid">
            <ConstantRow label="Reference sheet" value={`${BACKER_CONSTANTS.REFERENCE_WIDTH}" × ${BACKER_CONSTANTS.REFERENCE_HEIGHT}"`} />
            <ConstantRow label="Width categories" value={BACKER_CONSTANTS.X_CATEGORIES.map(v => `${v}"`).join(', ')} />
            <ConstantRow label="Height categories" value={BACKER_CONSTANTS.Y_CATEGORIES.map(v => `${v}"`).join(', ')} />
          </ConstantCard>
          <ConstantCard title="ACM Grid">
            <ConstantRow label="Small panel" value={`${ACM_CONSTANTS.SMALL_PANEL.WIDTH}" × ${ACM_CONSTANTS.SMALL_PANEL.HEIGHT}" (${ACM_CONSTANTS.SMALL_PANEL.NAME})`} />
            <ConstantRow label="Large panel" value={`${ACM_CONSTANTS.LARGE_PANEL.WIDTH}" × ${ACM_CONSTANTS.LARGE_PANEL.HEIGHT}" (${ACM_CONSTANTS.LARGE_PANEL.NAME})`} />
            <ConstantRow label="Width categories" value={ACM_CONSTANTS.X_CATEGORIES.map(v => `${v}"`).join(', ')} />
            <ConstantRow label="Height categories" value={ACM_CONSTANTS.Y_CATEGORIES.map(v => `${v}"`).join(', ')} />
          </ConstantCard>
        </div>
      </Section>

      {/* F) Formula */}
      <Section icon={<Calculator className="h-4 w-4" />} title="Calculation Formula">
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto font-mono">
{`1. areaCost     = (categoryX × categoryY) / (refWidth × refHeight) × totalSheetCost
2. shippingCost = ceil(area / refArea) × shippingPerSheet
3. perimeter    = Aluminum: categoryX × 2  |  ACM: (categoryX + categoryY) × 2
4. angleCost    = (perimeter / angleLinearDivisor) × totalAngleCost
5. angleCuts    = ceil(perimeter / angleLinearDivisor) × perCut
6. total        = ceil((1 + 2 + 3 + 4 + 5) / 5) × 5    ← round up to nearest $5`}
        </pre>
      </Section>

      {/* G) Calculated Price Grids */}
      {lookupTables && (
        <Section icon={<Grid3X3 className="h-4 w-4" />} title="Calculated Lookup Tables">
          <div className="space-y-4">
            <PriceGrid
              title="Aluminum Backer"
              subtitle={`Total sheet cost: ${computeTotalSheetCost(substrates.aluminum)}`}
              xCategories={BACKER_CONSTANTS.X_CATEGORIES}
              yCategories={BACKER_CONSTANTS.Y_CATEGORIES}
              lookup={lookupTables.aluminum}
            />
            <PriceGrid
              title={`ACM Small Panel (≤ ${ACM_CONSTANTS.SMALL_PANEL.MAX_X}" × ${ACM_CONSTANTS.SMALL_PANEL.MAX_Y}")`}
              subtitle={`Total sheet cost: ${computeTotalSheetCost(substrates.acmSmall)}`}
              xCategories={ACM_CONSTANTS.X_CATEGORIES.filter(x => x <= ACM_CONSTANTS.SMALL_PANEL.MAX_X)}
              yCategories={ACM_CONSTANTS.Y_CATEGORIES.filter(y => y <= ACM_CONSTANTS.SMALL_PANEL.MAX_Y)}
              lookup={lookupTables.acmSmall}
            />
            <PriceGrid
              title={`ACM Large Panel (${ACM_CONSTANTS.LARGE_PANEL.NAME})`}
              subtitle={`Total sheet cost: ${computeTotalSheetCost(substrates.acmLarge)}`}
              xCategories={ACM_CONSTANTS.X_CATEGORIES}
              yCategories={ACM_CONSTANTS.Y_CATEGORIES}
              lookup={lookupTables.acmLarge}
            />
          </div>
        </Section>
      )}
    </div>
  );
};

/* ── Helper Components ─────────────────────────────────────────── */

function Section({ icon, title, children, editAction }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  editAction?: { label: string; sectionId: string };
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</h4>
        </div>
        {editAction && (
          <button
            onClick={() => scrollToSection(editAction.sectionId)}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
          >
            {editAction.label}
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-2 text-${align} font-medium text-gray-500 border-b border-gray-200`}>{children}</th>;
}

function Td({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-3 py-1.5 text-${align} text-gray-600 ${className}`}>{children}</td>;
}

function ConstantCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <h5 className="text-xs font-semibold text-gray-700 mb-2">{title}</h5>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ConstantRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-700 font-medium ml-2 text-right">{value}</span>
    </div>
  );
}

function PriceGrid({ title, subtitle, xCategories, yCategories, lookup }: {
  title: string; subtitle: string;
  xCategories: number[]; yCategories: number[];
  lookup: Record<string, number>;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-xs text-gray-400 ml-2">{subtitle}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse border border-gray-200 rounded">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-2 py-1.5 border border-gray-200 text-gray-500 font-medium">W \ H</th>
              {yCategories.map(y => (
                <th key={y} className="px-2 py-1.5 border border-gray-200 text-gray-500 font-medium text-right">{y}"</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xCategories.map(x => (
              <tr key={x}>
                <td className="px-2 py-1 border border-gray-200 text-gray-500 font-medium bg-gray-50">{x}"</td>
                {yCategories.map(y => {
                  const price = lookup[`${x}x${y}`];
                  return (
                    <td key={y} className="px-2 py-1 border border-gray-200 text-right text-gray-700 font-mono">
                      {price !== undefined ? `$${price}` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BackerPricingDisplay;
