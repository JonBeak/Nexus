import { useState, useEffect } from 'react';
import { quickbooksApi } from '../../../services/api';
import { jobVersioningApi } from '../../../services/jobVersioningApi';
import { EstimateVersion, EmailSummaryConfig } from '../types';
import { EstimatePreviewData } from '../core/layers/CalculationLayer';
import { PointPersonEntry } from '../EstimatePointPersonsEditor';
import { EmailRecipients } from '../components/EstimateEmailPreviewModal';

interface UseQuickBooksIntegrationParams {
  currentEstimate: EstimateVersion | null;
  estimatePreviewData: EstimatePreviewData | null;
  onEstimateUpdate: (estimate: EstimateVersion) => void;
  // Phase 7: Workflow data
  pointPersons?: PointPersonEntry[];
  emailSubject?: string;
  emailBeginning?: string;
  emailEnd?: string;
  emailSummaryConfig?: EmailSummaryConfig;
  lineDescriptions?: Map<number, string>;  // QB descriptions by line index
  // Optional callback to run before prepare (e.g., clear empty rows)
  onBeforePrepare?: () => Promise<void>;
}

export const useQuickBooksIntegration = ({
  currentEstimate,
  estimatePreviewData,
  onEstimateUpdate,
  pointPersons,
  emailSubject,
  emailBeginning,
  emailEnd,
  emailSummaryConfig,
  lineDescriptions,
  onBeforePrepare
}: UseQuickBooksIntegrationParams) => {
  const [qbConnected, setQbConnected] = useState(false);
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  const [qbCheckingStatus, setQbCheckingStatus] = useState(true);
  const [qbCreatingEstimate, setQbCreatingEstimate] = useState(false);

  // Phase 7: Prepare/Send workflow states
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Modal states
  const [showConfirmFinalizeModal, setShowConfirmFinalizeModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ qbDocNumber: string; qbEstimateUrl: string } | null>(null);
  // Sent success modal state
  const [showSentSuccessModal, setShowSentSuccessModal] = useState(false);
  const [sentSuccessData, setSentSuccessData] = useState<{ emailsSentTo: string[]; wasResent: boolean } | null>(null);

  // Check QuickBooks connection status on mount
  useEffect(() => {
    checkQBConnectionStatus();
  }, []);

  const checkQBConnectionStatus = async () => {
    try {
      setQbCheckingStatus(true);
      const status = await quickbooksApi.getStatus();
      setQbConnected(status.connected);
      setQbRealmId(status.realmId || null);
    } catch (error) {
      console.error('Error checking QB status:', error);
      setQbConnected(false);
    } finally {
      setQbCheckingStatus(false);
    }
  };

  const handleCreateQuickBooksEstimate = async () => {
    if (!currentEstimate || !estimatePreviewData) {
      alert('No estimate data available.');
      return;
    }

    // Validate QuickBooks name is configured
    if (!estimatePreviewData.customerName || !estimatePreviewData.customerName.trim()) {
      alert(
        '❌ QuickBooks Name Not Configured\n\n' +
        'This customer does not have a QuickBooks name set.\n\n' +
        'Please edit the customer and set their QuickBooks name to match ' +
        'their exact DisplayName in QuickBooks before creating estimates.'
      );
      return;
    }

    // Allow QB creation from draft OR prepared state
    if (!currentEstimate.is_draft && !currentEstimate.is_prepared) {
      alert('Only draft or prepared estimates can be sent to QuickBooks.');
      return;
    }

    if (!qbConnected) {
      alert('Not connected to QuickBooks. Please connect first.');
      return;
    }

    // Show confirmation modal instead of window.confirm
    setShowConfirmFinalizeModal(true);
  };

  const handleConfirmFinalize = async () => {
    if (!currentEstimate || !estimatePreviewData) return;

    setShowConfirmFinalizeModal(false);

    try {
      setQbCreatingEstimate(true);

      // Enrich items with QB descriptions from lineDescriptions map
      const enrichedPreviewData = {
        ...estimatePreviewData,
        items: estimatePreviewData.items.map((item, index) => ({
          ...item,
          qbDescription: lineDescriptions?.get(index) || undefined
        }))
      };

      const result = await quickbooksApi.createEstimate({
        estimateId: currentEstimate.id,
        estimatePreviewData: enrichedPreviewData,
        debugMode: true, // TEMPORARY: Enable debug mode to compare sent vs received
      });

      // TEMPORARY: Log debug info if available
      if (result.debug) {
        console.log('🔬 DEBUG MODE RESULTS:');
        console.log(`Lines Sent: ${result.debug.linesSent}`);
        console.log(`Lines Returned: ${result.debug.linesReturned}`);
        console.log('Full debug data:', result.debug);
      }

      if (result.success && result.qbEstimateUrl) {
        // Update local state to reflect finalization
        // Use estimate_date from QB TxnDate (returned from backend)
        onEstimateUpdate({
          ...currentEstimate,
          is_draft: false,
          status: 'sent',
          qb_estimate_id: result.qbEstimateId,
          qb_estimate_url: result.qbEstimateUrl,
          qb_doc_number: result.qbDocNumber,  // Include QB doc number for email template
          estimate_date: result.estimateDate || new Date().toISOString().split('T')[0],  // Use QB TxnDate, fallback to today
        });

        // Show success modal with options
        setSuccessData({
          qbDocNumber: result.qbDocNumber,
          qbEstimateUrl: result.qbEstimateUrl
        });
        setShowSuccessModal(true);
      } else {
        alert(`❌ Failed to create estimate:\n\n${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error creating QB estimate:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`❌ Error creating estimate in QuickBooks:\n\n${errorMsg}`);
    } finally {
      setQbCreatingEstimate(false);
    }
  };

  const handleOpenFromSuccessModal = () => {
    if (successData?.qbEstimateUrl) {
      window.open(successData.qbEstimateUrl, '_blank');
    }
  };

  // Phase 7: Prepare estimate for sending (locks grid, saves point persons + email)
  const handlePrepareEstimate = async () => {
    if (!currentEstimate) return;

    // Debug: Check what we're sending
    console.log('[Prepare] estimatePreviewData sending:', !!estimatePreviewData, 'items:', estimatePreviewData?.items?.length ?? 0);

    try {
      setIsPreparing(true);

      // Clear empty rows first (if callback provided)
      if (onBeforePrepare) {
        console.log('[Prepare] Running onBeforePrepare (clearing empty rows)...');
        await onBeforePrepare();
        console.log('[Prepare] onBeforePrepare completed');
      }

      const result = await jobVersioningApi.prepareEstimate(currentEstimate.id, {
        emailSubject,
        emailBeginning,
        emailEnd,
        emailSummaryConfig,
        pointPersons: pointPersons?.map(pp => ({
          contact_id: pp.contact_id,
          contact_email: pp.contact_email,
          contact_name: pp.contact_name,
          contact_phone: pp.contact_phone,
          contact_role: pp.contact_role,
          saveToDatabase: pp.saveToDatabase
        })),
        estimatePreviewData  // Pass for QB description auto-fill
      });

      if (result.success) {
        // Update local state to reflect preparation
        onEstimateUpdate({
          ...currentEstimate,
          is_draft: false,
          is_prepared: true,
          uses_preparation_table: true
        });
      } else {
        alert(`Failed to prepare estimate: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error preparing estimate:', error);
      alert(`Error preparing estimate: ${error.message || 'Unknown error'}`);
    } finally {
      setIsPreparing(false);
    }
  };

  // Phase 7: Send estimate to customer (creates QB estimate, sends email)
  const handleSendToCustomer = async (recipients?: EmailRecipients) => {
    if (!currentEstimate || !estimatePreviewData) return;

    try {
      setIsSending(true);

      // Enrich items with QB descriptions from lineDescriptions map
      const enrichedPreviewData = {
        ...estimatePreviewData,
        items: estimatePreviewData.items.map((item, index) => ({
          ...item,
          qbDescription: lineDescriptions?.get(index) || undefined
        }))
      };

      const result = await jobVersioningApi.sendEstimateToCustomer(
        currentEstimate.id,
        enrichedPreviewData,
        recipients
      );

      if (result.success) {
        // Update local state with estimate_date from QB TxnDate
        onEstimateUpdate({
          ...currentEstimate,
          qb_estimate_id: result.qbEstimateId,
          status: 'sent',
          estimate_date: result.estimateDate || new Date().toISOString().split('T')[0]
        });

        // Show success modal with sent details
        if (result.emailSentTo && result.emailSentTo.length > 0) {
          setSentSuccessData({
            emailsSentTo: result.emailSentTo,
            wasResent: !!result.message // message indicates it was a resend
          });
          setShowSentSuccessModal(true);
        }
      } else {
        alert(`Failed to send estimate: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error sending estimate:', error);
      // Extract backend error message if available
      const backendMessage = error.response?.data?.message;
      const errorMessage = backendMessage || error.message || 'Unknown error';
      alert(`Error sending estimate: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenQuickBooksEstimate = () => {
    if (currentEstimate?.qb_estimate_url) {
      window.open(currentEstimate.qb_estimate_url, '_blank');
    } else if (currentEstimate?.qb_estimate_id && qbRealmId) {
      // Build URL from ID if URL not stored (backward compatibility)
      const url = `https://qbo.intuit.com/app/estimate?txnId=${currentEstimate.qb_estimate_id}`;
      window.open(url, '_blank');
    }
  };

  const handleConnectToQuickBooks = async () => {
    try {
      // Check if credentials are configured first
      const configStatus = await quickbooksApi.getConfigStatus();

      if (!configStatus.configured) {
        alert('QuickBooks credentials not configured. Please contact administrator.');
        return;
      }

      // Open OAuth window
      await quickbooksApi.startAuth();

      // Poll for connection status (OAuth happens in popup)
      const pollInterval = setInterval(async () => {
        try {
          const status = await quickbooksApi.getStatus();
          if (status.connected) {
            setQbConnected(true);
            setQbRealmId(status.realmId || null);
            clearInterval(pollInterval);
            // Success message already shown in OAuth callback page
          }
        } catch (error) {
          console.error('Error polling QB status:', error);
        }
      }, 2000); // Check every 2 seconds

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);

    } catch (error) {
      console.error('Error connecting to QuickBooks:', error);
      alert('Failed to connect to QuickBooks. Please try again.');
    }
  };

  const handleDisconnectFromQuickBooks = async () => {
    if (!confirm('Disconnect from QuickBooks? You will need to reconnect to create estimates.')) {
      return;
    }

    try {
      const result = await quickbooksApi.disconnect();
      if (result.success) {
        setQbConnected(false);
        setQbRealmId(null);
        alert('✅ Disconnected from QuickBooks');
      }
    } catch (error) {
      console.error('Error disconnecting from QuickBooks:', error);
      alert('Failed to disconnect. Please try again.');
    }
  };

  // Handler to close sent success modal
  const handleCloseSentSuccessModal = () => {
    setShowSentSuccessModal(false);
    setSentSuccessData(null);
  };

  return {
    qbConnected,
    qbRealmId,
    qbCheckingStatus,
    qbCreatingEstimate,
    handleCreateQuickBooksEstimate,
    handleOpenQuickBooksEstimate,
    handleConnectToQuickBooks,
    handleDisconnectFromQuickBooks,
    // Modal states and handlers
    showConfirmFinalizeModal,
    setShowConfirmFinalizeModal,
    showSuccessModal,
    setShowSuccessModal,
    successData,
    handleConfirmFinalize,
    // Phase 7: Prepare/Send workflow
    isPreparing,
    isSending,
    handlePrepareEstimate,
    handleSendToCustomer,
    handleOpenFromSuccessModal,
    // Sent success modal
    showSentSuccessModal,
    sentSuccessData,
    handleCloseSentSuccessModal
  };
};
