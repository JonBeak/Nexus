/**
 * Prepare Order Modal
 * Phase 1.5.c.6.1: Core Infrastructure
 *
 * Main modal for order preparation workflow with two phases:
 * 1. Prepare - Run preparation steps (QB estimate, PDFs, tasks)
 * 2. Send - Select recipients and send to customer
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PreparationState, PreparationPhase } from '../../../types/orderPreparation';
import { Order } from '../../../types/orders';
import { initializeSteps, areRequiredStepsComplete } from '../../../utils/stepOrchestration';
import { PrepareStepsPanel } from './PrepareStepsPanel';
import { LivePDFPreviewPanel } from './LivePDFPreviewPanel';

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
  const [preparationState, setPreparationState] = useState<PreparationState>({
    orderId: order.order_id,
    orderNumber: order.order_number,
    phase: 'prepare',
    steps: initializeSteps(),
    pdfs: {
      orderForm: null,
      qbEstimate: null
    },
    qbEstimate: null,
    pointPersons: [],
    canProceedToSend: false,
    errors: []
  });

  // Initialize on mount
  useEffect(() => {
    if (isOpen) {
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
    // TODO Phase 1.5.c.6.2: Load QB estimate info
    // TODO Phase 1.5.c.6.2: Check existing preparation state
    // TODO Phase 1.5.c.6.3: Load point persons
    console.log('PrepareOrderModal: Initializing for order', order.order_number);
  };

  const handleNextToSend = () => {
    if (!preparationState.canProceedToSend) {
      alert('Please complete required preparation steps first (steps 2-5)');
      return;
    }
    setPhase('send');
    setPreparationState(prev => ({ ...prev, phase: 'send' }));
  };

  const handleBackToPrepare = () => {
    setPhase('prepare');
    setPreparationState(prev => ({ ...prev, phase: 'prepare' }));
  };

  const handleSendAndFinalize = async () => {
    // TODO Phase 1.5.c.6.3: Send email (placeholder)
    // TODO Phase 1.5.c.6.3: Update status to pending_confirmation
    console.log('PrepareOrderModal: Send and finalize (placeholder)');
    onComplete();
  };

  const handleSkipEmail = async () => {
    // TODO Phase 1.5.c.6.3: Skip email, just update status
    console.log('PrepareOrderModal: Skip email (placeholder)');
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[90%] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {phase === 'prepare' ? 'Prepare Order' : 'Send to Customer'} #{order.order_number}
            </h2>
            <p className="text-sm text-gray-600">{order.order_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Main Content: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL (40%) */}
          <div className="w-[40%] border-r border-gray-200 overflow-y-auto p-6">
            {phase === 'prepare' ? (
              <PrepareStepsPanel
                state={preparationState}
                onStateChange={setPreparationState}
                orderNumber={order.order_number}
              />
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Send to Customer
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Phase 1.5.c.6.3: Point person selection and email preview will be implemented here
                </p>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    🚧 Phase 1.5.c.6.3 components (point person selector, email preview)
                    will be implemented next.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL (60%) - PDF Previews */}
          <div className="w-[60%] overflow-y-auto bg-gray-50 p-6">
            <LivePDFPreviewPanel state={preparationState} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          {phase === 'prepare' ? (
            <>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNextToSend}
                disabled={!preparationState.canProceedToSend}
                className={`px-6 py-2 rounded-lg font-medium ${
                  preparationState.canProceedToSend
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next: Send to Customer →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBackToPrepare}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ← Back to Prepare
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipEmail}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Skip Email
                </button>
                <button
                  onClick={handleSendAndFinalize}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Send Email & Finalize
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrepareOrderModal;
