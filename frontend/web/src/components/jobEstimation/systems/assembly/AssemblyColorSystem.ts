/**
 * Assembly Color System
 * 
 * Single source of truth for all assembly color management.
 * Provides consistent color definitions for grid, preview, and EstimateTable.
 */

export interface AssemblyColor {
  cssClass: string;
  name: string;
  indicator: string; // For EstimateTable backgrounds
}

const ASSEMBLY_COLORS: AssemblyColor[] = [
  { 
    cssClass: 'bg-purple-200 text-purple-900 hover:brightness-95', 
    name: 'purple',
    indicator: '#e9d5ff' // purple-200 equivalent
  },
  { 
    cssClass: 'bg-blue-200 text-blue-900 hover:brightness-95', 
    name: 'blue',
    indicator: '#dbeafe' // blue-200 equivalent
  },
  { 
    cssClass: 'bg-green-200 text-green-900 hover:brightness-95', 
    name: 'green',
    indicator: '#dcfce7' // green-200 equivalent
  },
  { 
    cssClass: 'bg-orange-200 text-orange-900 hover:brightness-95', 
    name: 'orange',
    indicator: '#fed7aa' // orange-200 equivalent
  },
  { 
    cssClass: 'bg-pink-200 text-pink-900 hover:brightness-95', 
    name: 'pink',
    indicator: '#fecdd3' // pink-200 equivalent
  },
  { 
    cssClass: 'bg-cyan-200 text-cyan-900 hover:brightness-95', 
    name: 'cyan',
    indicator: '#cffafe' // cyan-200 equivalent
  },
  { 
    cssClass: 'bg-red-200 text-red-900 hover:brightness-95', 
    name: 'red',
    indicator: '#fecaca' // red-200 equivalent
  },
  { 
    cssClass: 'bg-yellow-200 text-yellow-900 hover:brightness-95', 
    name: 'yellow',
    indicator: '#fef3c7' // yellow-200 equivalent
  },
  { 
    cssClass: 'bg-indigo-200 text-indigo-900 hover:brightness-95', 
    name: 'indigo',
    indicator: '#e0e7ff' // indigo-200 equivalent
  },
  { 
    cssClass: 'bg-emerald-200 text-emerald-900 hover:brightness-95', 
    name: 'emerald',
    indicator: '#d1fae5' // emerald-200 equivalent
  }
];

export class AssemblyColorSystem {
  static getAssemblyColor(assemblyIndex: number): string {
    return ASSEMBLY_COLORS[assemblyIndex % ASSEMBLY_COLORS.length].cssClass;
  }
  
  static getAssemblyColorName(assemblyIndex: number): string {
    return ASSEMBLY_COLORS[assemblyIndex % ASSEMBLY_COLORS.length].name;
  }
  
  static getAssemblyColorIndicator(assemblyIndex: number): string {
    return ASSEMBLY_COLORS[assemblyIndex % ASSEMBLY_COLORS.length].indicator;
  }
  
  static getAssemblyColorByName(colorName: string): string {
    const color = ASSEMBLY_COLORS.find(c => c.name === colorName);
    return color?.indicator || '#f3f4f6'; // Default gray if not found
  }
  
  static getAllColors(): AssemblyColor[] {
    return [...ASSEMBLY_COLORS];
  }
  
  static getColorCount(): number {
    return ASSEMBLY_COLORS.length;
  }
}

// Export utilities for EstimateTable compatibility
export const getAssemblyColorByIndex = (assemblyIndex: number): string => {
  return AssemblyColorSystem.getAssemblyColorName(assemblyIndex);
};

export const getAssemblyColorIndicator = (colorName: string): string => {
  return AssemblyColorSystem.getAssemblyColorByName(colorName);
};