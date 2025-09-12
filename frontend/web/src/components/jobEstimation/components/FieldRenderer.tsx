import React from 'react';
import { FieldRendererProps } from '../types';
import { AssemblyFieldRenderer } from './AssemblyFieldRenderer';
import { ProductFieldRenderer } from './ProductFieldRenderer';

export const FieldRenderer: React.FC<FieldRendererProps> = (props) => {
  // In uniform system, all products use the same renderer
  // Special handling will be added later if needed
  return <ProductFieldRenderer {...props} />;
};