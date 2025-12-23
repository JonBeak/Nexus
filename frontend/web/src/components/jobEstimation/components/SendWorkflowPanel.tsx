import React from 'react';
import { Mail, Users } from 'lucide-react';
import EstimatePointPersonsEditor, { PointPersonEntry } from '../EstimatePointPersonsEditor';
import EstimateEmailComposer from '../EstimateEmailComposer';
import { EmailSummaryConfig, EstimateEmailData } from '../types';

interface SendWorkflowPanelProps {
  customerId: number;
  pointPersons: PointPersonEntry[];
  onPointPersonsChange: (pointPersons: PointPersonEntry[]) => void;
  emailSubject: string;
  emailBeginning: string;
  emailEnd: string;
  emailSummaryConfig?: EmailSummaryConfig;
  estimateData?: EstimateEmailData;
  onEmailChange: (
    subject: string,
    beginning: string,
    end: string,
    summaryConfig: EmailSummaryConfig
  ) => void;
  isConvertedToOrder: boolean;
}

/**
 * SendWorkflowPanel - Contains Point Persons and Email sections
 * Email uses 3-part structure: Beginning + Estimate Summary + End
 */
export const SendWorkflowPanel: React.FC<SendWorkflowPanelProps> = ({
  customerId,
  pointPersons,
  onPointPersonsChange,
  emailSubject,
  emailBeginning,
  emailEnd,
  emailSummaryConfig,
  estimateData,
  onEmailChange,
  isConvertedToOrder
}) => {
  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
        <Mail className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-medium text-gray-900">Send to Customer</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Point Persons Section */}
        <div className="border-2 border-gray-400 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-600" />
            <h4 className="text-xs font-medium text-gray-700">Point Person(s)</h4>
          </div>
          <EstimatePointPersonsEditor
            customerId={customerId}
            initialPointPersons={pointPersons?.map(pp => ({
              id: typeof pp.id === 'string' ? parseInt(pp.id.replace('existing-', '').replace('new-', '')) || 0 : 0,
              contact_id: pp.contact_id,
              contact_email: pp.contact_email,
              contact_name: pp.contact_name,
              contact_phone: pp.contact_phone,
              contact_role: pp.contact_role
            }))}
            onSave={async (newPointPersons) => {
              onPointPersonsChange(newPointPersons);
            }}
            disabled={isConvertedToOrder}
          />
        </div>

        {/* Email Composer Section */}
        <div className="border-2 border-gray-400 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-gray-600" />
            <h4 className="text-xs font-medium text-gray-700">Email to Customer</h4>
          </div>
          <EstimateEmailComposer
            initialSubject={emailSubject}
            initialBeginning={emailBeginning}
            initialEnd={emailEnd}
            initialSummaryConfig={emailSummaryConfig}
            estimateData={estimateData}
            onChange={onEmailChange}
            disabled={isConvertedToOrder}
          />
        </div>
      </div>
    </div>
  );
};

export default SendWorkflowPanel;
