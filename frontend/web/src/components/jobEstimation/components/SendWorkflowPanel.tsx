import React, { useMemo, useRef } from 'react';
import { Mail, Users } from 'lucide-react';
import EstimatePointPersonsEditor, { PointPersonEntry, EstimatePointPersonsEditorHandle } from '../EstimatePointPersonsEditor';
import EstimateEmailComposer from '../EstimateEmailComposer';
import { EmailSummaryConfig, EstimateEmailData } from '../types';
import { PAGE_STYLES } from '../../../constants/moduleColors';

export interface SendWorkflowPanelHandle {
  savePointPersons: () => Promise<void>;
}

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
export const SendWorkflowPanel = React.forwardRef<SendWorkflowPanelHandle, SendWorkflowPanelProps>(({
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
}, ref) => {
  // Ref to point persons editor for external save calls
  const pointPersonsEditorRef = useRef<EstimatePointPersonsEditorHandle>(null);

  // Expose savePointPersons method via ref
  React.useImperativeHandle(ref, () => ({
    savePointPersons: async () => {
      if (pointPersonsEditorRef.current?.hasChanges?.()) {
        await pointPersonsEditorRef.current?.save?.();
      }
    }
  }), []);

  // Memoize initialPointPersons to prevent unnecessary resets of EstimatePointPersonsEditor state
  // when parent component re-renders (e.g., from email autosave debounce)
  const memoizedInitialPointPersons = useMemo(() => {
    return pointPersons?.map(pp => ({
      id: typeof pp.id === 'string' ? parseInt(pp.id.replace('existing-', '').replace('new-', '')) || 0 : 0,
      contact_id: pp.contact_id,
      contact_email: pp.contact_email,
      contact_name: pp.contact_name,
      contact_phone: pp.contact_phone,
      contact_role: pp.contact_role
    })) || [];
  }, [pointPersons]);

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} h-full flex flex-col`}>
      {/* Header */}
      <div className={`flex items-center gap-2 p-3 ${PAGE_STYLES.composites.tableHeader}`}>
        <Mail className="w-4 h-4 text-purple-600" />
        <h3 className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>Send to Customer</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Point Persons Section */}
        <div className={`border-2 ${PAGE_STYLES.border} rounded-lg p-3`}>
          <div className="flex items-center gap-2 mb-3">
            <Users className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
            <h4 className={`text-xs font-medium ${PAGE_STYLES.header.text}`}>Point Person(s)</h4>
          </div>
          <EstimatePointPersonsEditor
            ref={pointPersonsEditorRef}
            customerId={customerId}
            initialPointPersons={memoizedInitialPointPersons}
            onSave={async (newPointPersons) => {
              await onPointPersonsChange(newPointPersons);
            }}
            disabled={isConvertedToOrder}
          />
        </div>

        {/* Email Composer Section */}
        <div className={`border-2 ${PAGE_STYLES.border} rounded-lg p-3`}>
          <div className="flex items-center gap-2 mb-3">
            <Mail className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
            <h4 className={`text-xs font-medium ${PAGE_STYLES.header.text}`}>Email to Customer</h4>
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
});

SendWorkflowPanel.displayName = 'SendWorkflowPanel';

export default SendWorkflowPanel;
