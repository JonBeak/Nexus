// =====================================================
// PRICING CALCULATION ENGINE - Core Stateless Functions
// =====================================================

import { 
  CalculationInput, 
  CalculationResult, 
  CalculationBreakdown,
  VinylCalculationInput,
  ChannelLetterCalculationInput,
  SubstrateCalculationInput,
  BackerCalculationInput,
  PushThruCalculationInput,
  BladeSignCalculationInput,
  LEDNeonCalculationInput,
  PaintingCalculationInput,
  CustomCalculationInput,
  WiringCalculationInput,
  MaterialCutCalculationInput,
  ShippingCalculationInput,
  ULCalculationInput
} from '../types/pricing';

export class PricingCalculationEngine {
  
  /**
   * Main calculation dispatcher - routes to category-specific calculators
   * Pure function - no side effects, no database calls
   */
  static calculateItem(input: CalculationInput, rates: Record<string, any>): CalculationResult {
    const timestamp = new Date();
    const itemId = `item_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let calculations;
    let description = '';
    let internalNotes = '';
    
    switch (input.category) {
      case 'vinyl':
        calculations = this.calculateVinyl(input.inputData as VinylCalculationInput, rates);
        description = `${input.inputData.vinyl_type} - ${input.inputData.dimensions}`;
        break;
        
      case 'channel_letters':
        calculations = this.calculateChannelLetters(input.inputData as ChannelLetterCalculationInput, rates);
        description = `Channel Letters - ${input.inputData.return_depth} ${input.inputData.face_material}`;
        internalNotes = input.inputData.letter_data;
        break;
        
      case 'substrate':
        calculations = this.calculateSubstrate(input.inputData as SubstrateCalculationInput, rates);
        description = `${input.inputData.substrate_type} - ${input.inputData.dimensions}`;
        break;
        
      case 'backer':
        calculations = this.calculateBacker(input.inputData as BackerCalculationInput, rates);
        description = `${input.inputData.material_type} Backer - ${input.inputData.dimensions}`;
        break;
        
      case 'push_thru':
        calculations = this.calculatePushThru(input.inputData as PushThruCalculationInput, rates);
        description = `Push Thru - Backer: ${input.inputData.backer_dimensions}, Acrylic: ${input.inputData.acrylic_dimensions}`;
        break;
        
      case 'blade_sign':
        calculations = this.calculateBladeSign(input.inputData as BladeSignCalculationInput, rates);
        description = `Blade Sign - ${input.inputData.frame_dimensions} (${input.inputData.shape})`;
        break;
        
      case 'led_neon':
        calculations = this.calculateLEDNeon(input.inputData as LEDNeonCalculationInput, rates);
        description = `LED Neon - ${input.inputData.linear_footage}ft ${input.inputData.neon_type}`;
        break;
        
      case 'painting':
        calculations = this.calculatePainting(input.inputData as PaintingCalculationInput, rates);
        description = `Painting - ${input.inputData.face_dimensions}`;
        break;
        
      case 'custom':
        calculations = this.calculateCustom(input.inputData as CustomCalculationInput, rates);
        description = `Custom - ${input.inputData.description}`;
        break;
        
      case 'wiring':
        calculations = this.calculateWiring(input.inputData as WiringCalculationInput, rates);
        description = `Wiring - ${input.inputData.dc_plugs || 0} DC, ${input.inputData.wall_plugs || 0} Wall`;
        break;
        
      case 'material_cut':
        calculations = this.calculateMaterialCut(input.inputData as MaterialCutCalculationInput, rates);
        description = `Material Cut - ${input.inputData.material_type} ${input.inputData.dimensions}`;
        break;
        
      case 'shipping':
        calculations = this.calculateShipping(input.inputData as ShippingCalculationInput, rates);
        description = `Shipping - ${input.inputData.shipping_type} ${input.inputData.weight}lbs`;
        break;
        
      case 'ul_supplementary':
        calculations = this.calculateUL(input.inputData as ULCalculationInput, rates);
        description = `UL ${input.inputData.ul_type} - ${input.inputData.set_count} sets`;
        break;
        
      default:
        throw new Error(`Unsupported calculation category: ${input.category}`);
    }
    
    return {
      itemId,
      productType: input.productType,
      category: input.category,
      calculations,
      description,
      internalNotes,
      timestamp
    };
  }
  
  // =====================================================
  // VINYL CALCULATIONS
  // =====================================================
  
  private static calculateVinyl(input: VinylCalculationInput, rates: any): any {
    const breakdown: CalculationBreakdown[] = [];
    
    // Parse dimensions - Excel TEXTSPLIT equivalent
    const totalArea = this.parseDimensionsToArea(input.dimensions);
    
    // Get vinyl rates
    const vinylRate = rates.vinyl_types?.[input.vinyl_type] || { base_price_per_sqft: 0, application_fee: 0, setup_charge: 0 };
    
    // Material cost
    const materialCost = totalArea * vinylRate.base_price_per_sqft;
    breakdown.push({
      component: 'Material',
      description: `${totalArea} sq ft @ $${vinylRate.base_price_per_sqft}/sq ft`,
      quantity: totalArea,
      rate: vinylRate.base_price_per_sqft,
      amount: materialCost,
      formula: 'area * rate'
    });
    
    // Application fee
    let applicationCost = 0;
    if (vinylRate.application_fee > 0) {
      applicationCost = vinylRate.application_fee;
      breakdown.push({
        component: 'Application',
        description: `${input.application_method} application`,
        quantity: 1,
        rate: vinylRate.application_fee,
        amount: applicationCost,
        formula: 'flat_fee'
      });
    }
    
    // Setup charge
    let setupCost = 0;
    if (vinylRate.setup_charge > 0) {
      setupCost = vinylRate.setup_charge;
      breakdown.push({
        component: 'Setup',
        description: 'Setup charge',
        quantity: 1,
        rate: vinylRate.setup_charge,
        amount: setupCost,
        formula: 'flat_fee'
      });
    }
    
    const basePrice = materialCost + applicationCost + setupCost;
    const quantity = input.quantity || 1;
    const subtotal = basePrice * quantity;
    
    return {
      basePrice: Math.round(basePrice * 100) / 100,
      quantity,
      subtotal: Math.round(subtotal * 100) / 100,
      breakdown
    };
  }
  
  // =====================================================
  // CHANNEL LETTERS CALCULATIONS
  // =====================================================
  
  private static calculateChannelLetters(input: ChannelLetterCalculationInput, rates: any): any {
    const breakdown: CalculationBreakdown[] = [];
    
    // Parse letter data - this would analyze the letter specifications
    // For now, using simplified calculation
    const letterAnalysis = this.parseChannelLetterData(input.letter_data);
    
    // Get channel letter rates
    const letterRates = rates.channel_letter_types || {};
    const ledRates = rates.led_types || {};
    const transformerRates = rates.transformer_types || {};
    const ulRates = rates.ul_listing || {};
    
    // Base letter cost (per inch calculation)
    const baseLetterCost = letterAnalysis.totalInches * (letterRates.base_rate_per_inch || 0);
    breakdown.push({
      component: 'Channel Letters',
      description: `${letterAnalysis.totalInches}" @ $${letterRates.base_rate_per_inch || 0}/inch`,
      quantity: letterAnalysis.totalInches,
      rate: letterRates.base_rate_per_inch || 0,
      amount: baseLetterCost,
      formula: 'total_inches * rate_per_inch'
    });
    
    // LED calculation if required
    let ledCost = 0;
    if (input.led_type) {
      const ledRate = ledRates[input.led_type] || { cost_per_led: 0 };
      ledCost = letterAnalysis.ledCount * ledRate.cost_per_led;
      breakdown.push({
        component: 'LEDs',
        description: `${letterAnalysis.ledCount} LEDs @ $${ledRate.cost_per_led} each`,
        quantity: letterAnalysis.ledCount,
        rate: ledRate.cost_per_led,
        amount: ledCost,
        formula: 'led_count * led_rate'
      });
    }
    
    // Transformer calculation
    let transformerCost = 0;
    if (input.transformer_required) {
      const tfRate = transformerRates.standard || { unit_cost: 0 };
      const tfCount = Math.ceil(letterAnalysis.totalWattage / 60); // 60W per transformer
      transformerCost = tfCount * tfRate.unit_cost;
      breakdown.push({
        component: 'Transformers',
        description: `${tfCount} x ${tfRate.unit_cost} transformers`,
        quantity: tfCount,
        rate: tfRate.unit_cost,
        amount: transformerCost,
        formula: 'Math.ceil(wattage / 60) * transformer_cost'
      });
    }
    
    // UL listing
    let ulCost = 0;
    if (input.ul_listing) {
      const ulRate = ulRates.standard || { base_fee: 0, per_set_fee: 0 };
      ulCost = ulRate.base_fee + (input.quantity * ulRate.per_set_fee);
      breakdown.push({
        component: 'UL Listing',
        description: `Base: $${ulRate.base_fee} + ${input.quantity} sets @ $${ulRate.per_set_fee}`,
        quantity: input.quantity,
        rate: ulRate.per_set_fee,
        amount: ulCost,
        formula: 'base_fee + (sets * per_set_fee)'
      });
    }
    
    const basePrice = baseLetterCost + ledCost + transformerCost + ulCost;
    const quantity = input.quantity || 1;
    const subtotal = basePrice * quantity;
    
    return {
      basePrice: Math.round(basePrice * 100) / 100,
      quantity,
      subtotal: Math.round(subtotal * 100) / 100,
      breakdown
    };
  }
  
  // =====================================================
  // SUBSTRATE CALCULATIONS  
  // =====================================================
  
  private static calculateSubstrate(input: SubstrateCalculationInput, rates: any): any {
    const breakdown: CalculationBreakdown[] = [];
    
    const totalArea = this.parseDimensionsToArea(input.dimensions);
    const substrateRates = rates.substrate_cut || {};
    
    // Material cost
    const materialRate = substrateRates[input.substrate_type]?.material_cost_per_sqft || 0;
    const materialCost = totalArea * materialRate;
    breakdown.push({
      component: 'Material',
      description: `${totalArea} sq ft @ $${materialRate}/sq ft`,
      quantity: totalArea,
      rate: materialRate,
      amount: materialCost,
      formula: 'area * material_rate'
    });
    
    // Cutting cost
    let cuttingCost = 0;
    if (input.cutting_required) {
      const cuttingRate = substrateRates[input.substrate_type]?.cutting_rate_per_sqft || 0;
      cuttingCost = totalArea * cuttingRate;
      breakdown.push({
        component: 'Cutting',
        description: `${totalArea} sq ft @ $${cuttingRate}/sq ft`,
        quantity: totalArea,
        rate: cuttingRate,
        amount: cuttingCost,
        formula: 'area * cutting_rate'
      });
    }
    
    // Drilling cost
    let drillingCost = 0;
    if (input.drilling_holes && input.drilling_holes > 0) {
      const drillingRate = substrateRates[input.substrate_type]?.drilling_rate_per_hole || 0;
      drillingCost = input.drilling_holes * drillingRate;
      breakdown.push({
        component: 'Drilling',
        description: `${input.drilling_holes} holes @ $${drillingRate}/hole`,
        quantity: input.drilling_holes,
        rate: drillingRate,
        amount: drillingCost,
        formula: 'holes * drilling_rate'
      });
    }
    
    // Hardware cost
    let hardwareCost = 0;
    if (input.hardware && input.hardware !== 'None') {
      const hardwareRate = substrateRates[input.substrate_type]?.[`${input.hardware.toLowerCase()}_cost_per_piece`] || 0;
      const hardwareCount = input.drilling_holes || 4; // Default 4 pieces
      hardwareCost = hardwareCount * hardwareRate;
      breakdown.push({
        component: 'Hardware',
        description: `${hardwareCount} ${input.hardware} @ $${hardwareRate} each`,
        quantity: hardwareCount,
        rate: hardwareRate,
        amount: hardwareCost,
        formula: 'hardware_count * hardware_rate'
      });
    }
    
    const basePrice = materialCost + cuttingCost + drillingCost + hardwareCost;
    const subtotal = basePrice;
    
    return {
      basePrice: Math.round(basePrice * 100) / 100,
      quantity: 1,
      subtotal: Math.round(subtotal * 100) / 100,
      breakdown
    };
  }
  
  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================
  
  /**
   * Parse dimension strings like "12x8,6x4" into total area
   * Replicates Excel TEXTSPLIT functionality
   */
  private static parseDimensionsToArea(dimensions: string): number {
    if (!dimensions) return 0;
    
    const pieces = dimensions.split(',').map(d => d.trim());
    let totalArea = 0;
    
    for (const piece of pieces) {
      const dims = piece.split('x').map(d => parseFloat(d.trim()));
      if (dims.length === 2 && !isNaN(dims[0]) && !isNaN(dims[1])) {
        totalArea += dims[0] * dims[1];
      }
    }
    
    // Convert to square feet if needed
    return totalArea / 144; // assuming input is in inches, convert to sq ft
  }
  
  /**
   * Parse channel letter data - simplified for now
   * In production, this would be much more sophisticated
   */
  private static parseChannelLetterData(letterData: string): any {
    // This is a simplified parser - in production would analyze actual letter specifications
    const lines = letterData.split('\n').filter(line => line.trim());
    let totalInches = 0;
    let ledCount = 0;
    let totalWattage = 0;
    
    // Simple heuristic parsing
    for (const line of lines) {
      const numbers = line.match(/\d+/g);
      if (numbers) {
        totalInches += parseInt(numbers[0]) || 0;
        ledCount += Math.ceil((parseInt(numbers[0]) || 0) / 3); // Rough LED count
      }
    }
    
    totalWattage = ledCount * 1.2; // Rough wattage calculation
    
    return {
      totalInches: Math.max(totalInches, 12), // Minimum 12"
      ledCount: Math.max(ledCount, 4), // Minimum 4 LEDs  
      totalWattage: Math.max(totalWattage, 5) // Minimum 5W
    };
  }
  
  // Placeholder implementations for other categories
  // Each would follow similar pattern but with category-specific logic
  
  private static calculateBacker(input: BackerCalculationInput, rates: any): any {
    // Implementation for backer calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculatePushThru(input: PushThruCalculationInput, rates: any): any {
    // Implementation for push thru calculations  
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateBladeSign(input: BladeSignCalculationInput, rates: any): any {
    // Implementation for blade sign calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateLEDNeon(input: LEDNeonCalculationInput, rates: any): any {
    // Implementation for LED neon calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculatePainting(input: PaintingCalculationInput, rates: any): any {
    // Implementation for painting calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateCustom(input: CustomCalculationInput, rates: any): any {
    // Implementation for custom calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateWiring(input: WiringCalculationInput, rates: any): any {
    // Implementation for wiring calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateMaterialCut(input: MaterialCutCalculationInput, rates: any): any {
    // Implementation for material cut calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateShipping(input: ShippingCalculationInput, rates: any): any {
    // Implementation for shipping calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
  
  private static calculateUL(input: ULCalculationInput, rates: any): any {
    // Implementation for UL calculations
    return { basePrice: 0, quantity: 1, subtotal: 0, breakdown: [] };
  }
}