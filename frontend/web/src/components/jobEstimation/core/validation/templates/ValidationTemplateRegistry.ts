// Registry for all validation templates
// Manages template registration and lookup

import { ValidationTemplate } from './ValidationTemplate';
import { TextSplitTemplate } from './TextSplitTemplate';
import { FloatTemplate } from './FloatTemplate';
import { FloatOrFormulaTemplate } from './FloatOrFormulaTemplate';
import { RequiredTemplate } from './RequiredTemplate';
import { LedOverrideTemplate } from './LedOverrideTemplate';
import { PsOverrideTemplate } from './PsOverrideTemplate';
import { UlOverrideTemplate } from './UlOverrideTemplate';
import { FloatOrGroupsTemplate } from './FloatOrGroupsTemplate';
import { FloatOrDimensionsTemplate } from './FloatOrDimensionsTemplate';
import { TwoDimensionsTemplate } from './TwoDimensionsTemplate';
import { ThreeDimensionsTemplate } from './ThreeDimensionsTemplate';
import { ConditionalDimensionsTemplate } from './ConditionalDimensionsTemplate';
import { LedTypeTemplate } from './LedTypeTemplate';
import { PsTypeTemplate } from './PsTypeTemplate';
import { PsPriceOverrideTemplate } from './PsPriceOverrideTemplate';
import { OrRequiredTemplate } from './OrRequiredTemplate';
import { MultiplierTemplate } from './MultiplierTemplate';
import { OptionalTextTemplate } from './OptionalTextTemplate';

export class ValidationTemplateRegistry {
  private templates = new Map<string, ValidationTemplate>();

  constructor() {
    // Register built-in templates
    this.registerTemplate('textsplit', new TextSplitTemplate());

    // Register basic validation templates
    const requiredTemplate = new RequiredTemplate();
    this.registerTemplate('float', new FloatTemplate());
    this.registerTemplate('floatorformula', new FloatOrFormulaTemplate());
    this.registerTemplate('required', requiredTemplate);
    this.registerTemplate('non_empty', requiredTemplate);
    this.registerTemplate('optional_text', new OptionalTextTemplate());

    // Register context-aware override templates
    this.registerTemplate('led_override', new LedOverrideTemplate());
    this.registerTemplate('ps_override', new PsOverrideTemplate());
    this.registerTemplate('ps_price_override', new PsPriceOverrideTemplate());
    this.registerTemplate('ul_override', new UlOverrideTemplate());

    // Register specialized templates
    this.registerTemplate('float_or_groups', new FloatOrGroupsTemplate());
    this.registerTemplate('floatordimensions', new FloatOrDimensionsTemplate());
    this.registerTemplate('twodimensions', new TwoDimensionsTemplate());
    this.registerTemplate('threedimensions', new ThreeDimensionsTemplate());
    this.registerTemplate('conditionaldimensions', new ConditionalDimensionsTemplate());
    this.registerTemplate('led_type', new LedTypeTemplate());
    this.registerTemplate('ps_type', new PsTypeTemplate());
    this.registerTemplate('or_required', new OrRequiredTemplate());
    this.registerTemplate('multiplier', new MultiplierTemplate());

    // Future templates can be registered here:
    // this.registerTemplate('email', new EmailTemplate());
    // this.registerTemplate('phone', new PhoneTemplate());
    // etc.
  }

  /**
   * Register a new validation template
   * @param name - Template function name (used in database configs)
   * @param template - Template implementation
   */
  registerTemplate(name: string, template: ValidationTemplate): void {
    this.templates.set(name.toLowerCase(), template);
  }

  /**
   * Get a template by name
   * @param name - Template function name
   * @returns Template instance or undefined if not found
   */
  getTemplate(name: string): ValidationTemplate | undefined {
    return this.templates.get(name.toLowerCase());
  }

  /**
   * Get all registered template names
   * @returns Array of available template names
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if a template exists
   * @param name - Template function name
   * @returns True if template is registered
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name.toLowerCase());
  }

  /**
   * Get template description and parameter schema
   * @param name - Template function name
   * @returns Template metadata or null if not found
   */
  getTemplateInfo(name: string): { description: string; parameters: Record<string, unknown> } | null {
    const template = this.getTemplate(name);
    if (!template) return null;

    return {
      description: template.getDescription(),
      parameters: template.getParameterSchema()
    };
  }
}
