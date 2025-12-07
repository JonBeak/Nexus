/**
 * Prepare Order Modal
 * Phase 1.5.c.6.1: Core Infrastructure
 *
 * Main modal for order preparation workflow with two phases:
 * 1. Prepare - Run preparation steps (QB estimate, PDFs, tasks)
 * 2. Send - Select recipients and send to customer
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { PreparationState, PreparationPhase } from '../../../types/orderPreparation';
import { Order } from '../../../types/orders';
import { initializeSteps, areRequiredStepsComplete } from '../../../utils/stepOrchestration';
import { PrepareStepsPanel } from './PrepareStepsPanel';
import { LivePDFPreviewPanel } from './LivePDFPreviewPanel';
import { SendToCustomerPanel, SendToCustomerPanelRef } from './send/SendToCustomerPanel';
import { buildPdfUrls } from '../../../utils/pdfUrls';
import { orderPreparationApi } from '../../../services/api/orders/orderPreparationApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onComplete: () => void;
}

export const PrepareOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  order,
  onComplete
}) => {
  const [phase, setPhase] = useState<PreparationPhase>('prepare');
  const [isSending, setIsSending] = useState(false);
  const [preparationState, setPreparationState] = useState<PreparationState>({
    orderId: order.order_id,
    orderNumber: order.order_number,
    phase: 'prepare',
    steps: initializeSteps(),
    pdfs: {
      orderForm: { url: null, loading: false, error: null },
      packingList: { url: null, loading: false, error: null },
      internalEstimate: { url: null, loading: false, error: null },
      qbEstimate: { url: null, loading: false, error: null }
    },
    qbEstimate: {
      exists: false,
      id: null,
      number: null,
      isStale: false,
      createdAt: null,
      dataHash: null
    },
    pointPersons: [],
    canProceedToSend: false,
    errors: []
  });

  // Initialize on mount and reset phase when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('prepare');
      initializePreparation();
    }
  }, [isOpen]);

  // Check if can proceed to send (required steps: 2-5)
  useEffect(() => {
    const canProceed = areRequiredStepsComplete(preparationState.steps);

    setPreparationState(prev => ({
      ...prev,
      canProceedToSend: canProceed
    }));
  }, [preparationState.steps]);

  const initializePreparation = async () => {
    // Build PDF URLs from order metadata (same pattern as Print Forms modal)
    const pdfUrls = buildPdfUrls(order);

    console.log('[PrepareOrderModal] Built PDF URLs:', pdfUrls);
    console.log('[PrepareOrderModal] Order data:', {
      folder_name: order.folder_name,
      order_number: order.order_number,
      order_name: order.order_name
    });

    if (pdfUrls) {
      // Set PDF URLs immediately - previews will show PDFs if they exist
      setPreparationState(prev => ({
        ...prev,
        pdfs: {
          orderForm: { url: pdfUrls.master, loading: false, error: null },        // Master Order Form
          packingList: { url: pdfUrls.packing, loading: false, error: null },     // Packing List
          internalEstimate: { url: pdfUrls.estimate, loading: false, error: null }, // Internal Estimate
          qbEstimate: { url: pdfUrls.qbEstimate, loading: false, error: null },    // QB Estimate
          specsOrderForm: { url: pdfUrls.customer, loading: false, error: null }   // Specs Order Form (customer PDF)
        }
      }));
      console.log('[PrepareOrderModal] PDF state updated with URLs');
    } else {
      console.warn('[PrepareOrderModal] No PDF URLs built - order data missing?');
    }

    // TODO Phase 1.5.c.6.2: Load QB estimate info
    // TODO Phase 1.5.c.6.2: Check existing preparation state
    // TODO Phase 1.5.c.6.3: Load point persons
    console.log('PrepareOrderModal: Initializing for order', order.order_number);
  };

  const handleNextToSend = () => {
    if (!preparationState.canProceedToSend) {
      alert('Please complete all preparation steps first (100% progress required)');
      return;
    }
    setPhase('send');
    setPreparationState(prev => ({ ...prev, phase: 'send' }));
  };

  const handleBackToPrepare = () => {
    setPhase('prepare');
    setPreparationState(prev => ({ ...prev, phase: 'prepare' }));
  };

  const sendPanelRef = useRef<SendToCustomerPanelRef>(null);

  const handleSendAndFinalize = async () => {
    // Prevent duplicate submissions
    if (isSending) return;

    try {
      setIsSending(true);

      // Get selected recipients from SendToCustomerPanel
      const selectedRecipients = sendPanelRef.current?.getSelectedRecipients() || [];

      if (selectedRecipients.length === 0) {
        alert('Please select at least one recipient or use "Skip Email & Finalize" button.');
        return;
      }

      // Finalize with email
      const result = await orderPreparationApi.finalizeOrder(order.order_number, {
        sendEmail: true,
        recipients: selectedRecipients,
        orderName: order.order_name,
        pdfUrls: {
          orderForm: preparationState.pdfs.specsOrderForm?.url || null,
          qbEstimate: preparationState.pdfs.qbEstimate.url
        }
      });

      // API client unwraps the response, so result is the data object directly
      if (result.emailSent !== undefined && result.statusUpdated) {
        alert(result.message || 'Order finalized successfully');
        onComplete(); // Close modal and refresh order page
      } else {
        alert(`Failed to finalize order: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending and finalizing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to finalize order. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleSkipEmail = async () => {
    // Prevent duplicate submissions
    if (isSending) return;

    try {
      const confirmed = confirm(
        'Skip sending email and finalize order?\n\n' +
        'The order status will be updated to "Pending Confirmation" without sending any notification emails.'
      );

      if (!confirmed) return;

      setIsSending(true);

      // Finalize without email
      const result = await orderPreparationApi.finalizeOrder(order.order_number, {
        sendEmail: false,
        recipients: [],
        orderName: order.order_name
      });

      // API client unwraps the response, so result is the data object directly
      if (result.statusUpdated !== undefined) {
        alert(result.message || 'Order finalized successfully');
        onComplete(); // Close modal and refresh order page
      } else {
        alert(`Failed to finalize order: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error skipping email and finalizing:', error);
      alert('Failed to finalize order. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Keep modal mounted but hidden to prevent PDF.js worker destruction
  // Fixes crash when reopening modal (worker reference becomes null)
  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${
        !isOpen ? 'hidden' : ''
      }`}
    >
      <div className="bg-white rounded-lg shadow-2xl w-[95%] h-[95vh] flex">
        {/* LEFT PANEL (40%) - Header, Steps, and Footer */}
        <div className="w-[40%] border-r border-gray-200 flex flex-col">
          {/* Header Section - Order Info */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {phase === 'prepare' ? 'Prepare Order' : 'Send to Customer'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  #{order.order_number} - {order.order_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Steps Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {phase === 'prepare' ? (
              <PrepareStepsPanel
                state={preparationState}
                onStateChange={setPreparationState}
                order={order}
                isOpen={isOpen}
              />
            ) : (
              <SendToCustomerPanel
                ref={sendPanelRef}
                orderNumber={order.order_number}
                orderName={order.order_name}
                pdfUrls={{
                  specsOrderForm: preparationState.pdfs.specsOrderForm?.url || null,
                  qbEstimate: preparationState.pdfs.qbEstimate.url
                }}
                qbEstimateNumber={preparationState.qbEstimate.number}
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {phase === 'prepare' ? (
              <div className="grid grid-cols-4 gap-3">
                {/* 1st Quarter - Cancel */}
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>

                {/* 2nd Quarter - Empty */}
                <div></div>

                {/* 3rd Quarter - Empty */}
                <div></div>

                {/* 4th Quarter - Next: Send to Customer */}
                <button
                  onClick={handleNextToSend}
                  disabled={!preparationState.canProceedToSend}
                  className={`px-6 py-2.5 rounded-lg font-medium ${
                    preparationState.canProceedToSend
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Next: Send to Customer →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {/* 1st Quarter - Back */}
                <button
                  onClick={handleBackToPrepare}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  ← Back
                </button>

                {/* 2nd Quarter - Empty */}
                <div></div>

                {/* 3rd Quarter - Skip Email & Finalize */}
                <button
                  onClick={handleSkipEmail}
                  disabled={isSending}
                  className={`px-6 py-2 bg-white border border-gray-300 rounded-lg transition-colors ${
                    isSending
                      ? 'text-gray-400 cursor-not-allowed opacity-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    'Skip Email & Finalize'
                  )}
                </button>

                {/* 4th Quarter - Send Email & Finalize */}
                <button
                  onClick={handleSendAndFinalize}
                  disabled={isSending}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                    isSending
                      ? 'bg-gray-400 cursor-not-allowed opacity-50 text-white'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Email...
                    </span>
                  ) : (
                    'Send Email & Finalize'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (60%) - PDF Previews - Full Height */}
        <div className="w-[60%] overflow-y-auto bg-gray-50 p-6">
          <LivePDFPreviewPanel state={preparationState} />
        </div>
      </div>
    </div>
  );
};

export default PrepareOrderModal;
