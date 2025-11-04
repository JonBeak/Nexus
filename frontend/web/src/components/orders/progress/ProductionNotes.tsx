import React from 'react';
import { FileText } from 'lucide-react';

interface Props {
  notes?: string;
}

export const ProductionNotes: React.FC<Props> = ({ notes }) => {
  if (!notes) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <FileText className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-900">Production Notes</h3>
          <p className="text-sm text-amber-800 mt-1 whitespace-pre-wrap">{notes}</p>
        </div>
      </div>
    </div>
  );
};

export default ProductionNotes;
