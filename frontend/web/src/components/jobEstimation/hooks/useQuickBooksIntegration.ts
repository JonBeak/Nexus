import { useState, useEffect } from 'react';
import { quickbooksApi } from '../../../services/api';
import { EstimateVersion } from '../types';
import { EstimatePreviewData } from '../core/layers/CalculationLayer';

interface UseQuickBooksIntegrationParams {
  currentEstimate: EstimateVersion | null;
  estimatePreviewData: EstimatePreviewData | null;
  onEstimateUpdate: (estimate: EstimateVersion) => void;
}

export const useQuickBooksIntegration = ({
  currentEstimate,
  estimatePreviewData,
  onEstimateUpdate
}: UseQuickBooksIntegrationParams) => {
  const [qbConnected, setQbConnected] = useState(false);
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  const [qbCheckingStatus, setQbCheckingStatus] = useState(true);
  const [qbCreatingEstimate, setQbCreatingEstimate] = useState(false);

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

    if (!currentEstimate.is_draft) {
      alert('Only draft estimates can be sent to QuickBooks.');
      return;
    }

    if (!qbConnected) {
      alert('Not connected to QuickBooks. Please connect first.');
      return;
    }

    // Confirm finalization
    const confirmed = window.confirm(
      '⚠️ This will FINALIZE the estimate and make it IMMUTABLE.\n\n' +
      'The estimate will be locked from further edits and sent to QuickBooks.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;

    try {
      setQbCreatingEstimate(true);

      const result = await quickbooksApi.createEstimate({
        estimateId: currentEstimate.id,
        estimatePreviewData: estimatePreviewData,
      });

      if (result.success && result.qbEstimateUrl) {
        // Update local state to reflect finalization
        onEstimateUpdate({
          ...currentEstimate,
          is_draft: false,
          status: 'sent',
          qb_estimate_id: result.qbEstimateId,
          qb_estimate_url: result.qbEstimateUrl,
        });

        alert(
          `✅ Success!\n\n` +
          `Estimate finalized and sent to QuickBooks.\n` +
          `QB Document #: ${result.qbDocNumber}\n\n` +
          `Opening in QuickBooks...`
        );

        // Open QB estimate in new tab
        window.open(result.qbEstimateUrl, '_blank');
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

  return {
    qbConnected,
    qbRealmId,
    qbCheckingStatus,
    qbCreatingEstimate,
    handleCreateQuickBooksEstimate,
    handleOpenQuickBooksEstimate,
    handleConnectToQuickBooks,
    handleDisconnectFromQuickBooks
  };
};
