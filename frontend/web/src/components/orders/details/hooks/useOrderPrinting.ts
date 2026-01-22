import { useState, useMemo } from 'react';
import { ordersApi, printApi } from '../../../../services/api';
import { orderStatusApi } from '../../../../services/api/orders/orderStatusApi';
import { Order, OrderPart } from '../../../../types/orders';
import { calculateShopCount } from '../services/orderCalculations';
import { PrintApprovalSuccessData } from '../../modals/PrintApprovalSuccessModal';
import { PrintApprovalErrorData } from '../../modals/PrintApprovalErrorModal';
import { useAlert } from '../../../../contexts/AlertContext';

interface PrintConfig {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
}

export type PrintMode = 'full' | 'master_estimate' | 'shop_packing_production';

interface OrderData {
  order: Order | null;
  parts: OrderPart[];
  taxRules: any[];
  customerDiscount: number;
}

interface FormUrls {
  master: string;
  estimate: string;
  shop: string;
  customer: string;
  packing: string;
}

export function useOrderPrinting(
  orderData: OrderData,
  setUiState: (updater: (prev: any) => any) => void,
  onOrderUpdated?: () => void
) {
  const { showSuccess, showError } = useAlert();

  // Print Configuration
  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    master: 1,
    estimate: 1,
    shop: 2,
    packing: 2
  });

  // Print Mode
  const [printMode, setPrintMode] = useState<PrintMode>('full');

  // Success modal state
  const [successModalData, setSuccessModalData] = useState<PrintApprovalSuccessData | null>(null);

  // Error modal state
  const [errorModalData, setErrorModalData] = useState<PrintApprovalErrorData | null>(null);

  // Refresh key to force formUrls regeneration when modal opens
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGenerateForms = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, generatingForms: true }));
      await ordersApi.generateOrderForms(orderData.order.order_number, false);
      showSuccess('Order forms generated successfully!');
    } catch (err) {
      console.error('Error generating forms:', err);
      showError('Failed to generate order forms. Please try again.');
    } finally {
      setUiState(prev => ({ ...prev, generatingForms: false }));
    }
  };

  const handleOpenPrintModal = (mode: PrintMode = 'full') => {
    // Calculate shop count based on current specs in state
    const shopCount = calculateShopCount(orderData.parts);

    // Set default quantities based on mode
    if (mode === 'master_estimate') {
      setPrintConfig({
        master: 1,
        estimate: 1,
        shop: 0,
        packing: 0
      });
    } else if (mode === 'shop_packing_production') {
      setPrintConfig({
        master: 0,
        estimate: 0,
        shop: shopCount,
        packing: 2
      });
    } else {
      setPrintConfig({
        master: 1,
        estimate: 1,
        shop: shopCount,
        packing: 2
      });
    }

    setPrintMode(mode);

    // Increment refresh key to force formUrls regeneration with new timestamp
    setRefreshKey(prev => {
      const newKey = prev + 1;
      return newKey;
    });

    setUiState(prev => ({ ...prev, showPrintModal: true }));
  };

  const handleClosePrintModal = () => {
    setUiState(prev => ({ ...prev, showPrintModal: false }));
    setPrintMode('full'); // Reset to default
  };

  const handlePrintForms = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const result = await printApi.printOrderFormsBatch(orderData.order.order_number, printConfig);

      if (result.success) {
        const { summary } = result;
        let message = `Master: ${summary.master}\nEstimate: ${summary.estimate}\nShop: ${summary.shop}\nPacking: ${summary.packing}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\nNote: ${summary.skipped.join(', ')} not found and skipped`;
        }

        showSuccess(message, `Printed ${summary.printedCopies} Forms (Job: ${result.jobId})`);
      } else {
        showError('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing forms:', err);
      showError(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handlePrintMasterEstimate = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const masterEstimateConfig: PrintConfig = {
        master: printConfig.master,
        estimate: printConfig.estimate,
        shop: 0,
        packing: 0
      };

      const result = await printApi.printOrderFormsBatch(orderData.order.order_number, masterEstimateConfig);

      if (result.success) {
        const { summary } = result;
        let message = `Master: ${summary.master}\nEstimate: ${summary.estimate}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\nNote: ${summary.skipped.join(', ')} not found and skipped`;
        }

        showSuccess(message, `Master & Estimate Printed (Job: ${result.jobId})`);
      } else {
        showError('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing master/estimate forms:', err);
      showError(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handlePrintShopPacking = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const shopPackingConfig: PrintConfig = {
        master: 0,
        estimate: 0,
        shop: printConfig.shop,
        packing: printConfig.packing
      };

      const result = await printApi.printOrderFormsBatch(orderData.order.order_number, shopPackingConfig);

      if (result.success) {
        const { summary } = result;
        let message = `Shop: ${summary.shop}\nPacking: ${summary.packing}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\nNote: ${summary.skipped.join(', ')} not found and skipped`;
        }

        showSuccess(message, `Shop & Packing Printed (Job: ${result.jobId})`);
      } else {
        showError('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing shop/packing forms:', err);
      showError(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handlePrintMasterForm = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const result = await printApi.printOrderForm(orderData.order.order_number, 'master');
      showSuccess(`Print job submitted successfully!`, `Job ID: ${result.jobId || 'unknown'}`);
    } catch (err: any) {
      console.error('Error printing master form:', err);
      showError(err.response?.data?.message || 'Failed to print master form. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handlePrintAndMoveToProduction = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));

      // Check if at least one form is selected
      if (printConfig.shop === 0 && printConfig.packing === 0) {
        setErrorModalData({
          type: 'validation',
          title: 'No Forms Selected',
          message: 'Please select at least one form to print (Shop or Packing).'
        });
        setUiState(prev => ({ ...prev, printingForm: false }));
        return;
      }

      // Print forms
      const shopPackingConfig: PrintConfig = {
        master: 0,
        estimate: 0,
        shop: printConfig.shop,
        packing: printConfig.packing
      };

      const result = await printApi.printOrderFormsBatch(orderData.order.order_number, shopPackingConfig);

      if (!result.success) {
        setErrorModalData({
          type: 'print_failure',
          title: 'Print Failed',
          message: 'Failed to print forms. Please check the printer and try again.'
        });
        setUiState(prev => ({ ...prev, printingForm: false }));
        return;
      }

      // Update order status to production_queue
      await orderStatusApi.updateOrderStatus(
        orderData.order.order_number,
        'production_queue',
        'Order approved and moved to production queue (printed forms)'
      );

      // Show success modal with print summary and production status
      setSuccessModalData({
        type: 'print_and_production',
        printSummary: result.summary,
        jobId: result.jobId,
        movedToProduction: true,
        orderNumber: orderData.order.order_number,
        orderName: orderData.order.order_name
      });

      setUiState(prev => ({ ...prev, showPrintModal: false }));

      // Refresh order data to show updated status
      if (onOrderUpdated) {
        onOrderUpdated();
      }
    } catch (err: any) {
      console.error('Error printing and moving to production:', err);
      setErrorModalData({
        type: 'production_failure',
        title: 'Operation Failed',
        message: 'Failed to move order to production.',
        details: err.response?.data?.message || err.message
      });
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handleMoveToProductionWithoutPrinting = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));

      // Update order status to production_queue
      await orderStatusApi.updateOrderStatus(
        orderData.order.order_number,
        'production_queue',
        'Order approved and moved to production queue (no forms printed)'
      );

      // Show success modal with production status only
      setSuccessModalData({
        type: 'production_only',
        movedToProduction: true,
        orderNumber: orderData.order.order_number,
        orderName: orderData.order.order_name
      });

      setUiState(prev => ({ ...prev, showPrintModal: false }));

      // Refresh order data to show updated status
      if (onOrderUpdated) {
        onOrderUpdated();
      }
    } catch (err: any) {
      console.error('Error moving to production:', err);
      setErrorModalData({
        type: 'production_failure',
        title: 'Operation Failed',
        message: 'Failed to move order to production.',
        details: err.response?.data?.message || err.message
      });
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const buildFormUrls = (): FormUrls | null => {
    if (!orderData.order || !orderData.order.folder_name) return null;

    // Get base URL for PDFs (remove /api suffix since order-images is served from root)
    const apiUrl = (import.meta.env.VITE_API_URL || 'http://192.168.2.14:3001').replace(/\/api$/, '');
    const folderName = orderData.order.folder_name; // e.g., "Job Name ----- Customer Name"
    const orderNum = orderData.order.order_number;
    const jobName = orderData.order.order_name;

    // Add cache buster using current timestamp to ensure browser fetches latest PDF
    const cacheBuster = `?v=${Date.now()}`;

    // Build URLs using actual folder structure and new file names
    const urls = {
      master: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName}.pdf${cacheBuster}`,
      estimate: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName} - Estimate.pdf${cacheBuster}`,
      shop: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName} - Shop.pdf${cacheBuster}`,
      customer: `${apiUrl}/order-images/Orders/${folderName}/Specs/${orderNum} - ${jobName} - Specs.pdf${cacheBuster}`,
      packing: `${apiUrl}/order-images/Orders/${folderName}/Specs/${orderNum} - ${jobName} - Packing List.pdf${cacheBuster}`
    };

    return urls;
  };

  // Memoize formUrls to prevent unnecessary re-renders of PDF components
  // refreshKey is incremented when modal opens to ensure fresh timestamp
  const formUrls = useMemo(() => {
    return buildFormUrls();
  }, [
    orderData.order?.folder_name,
    orderData.order?.order_number,
    orderData.order?.order_name,
    refreshKey
  ]);

  const handleCloseSuccessModal = () => {
    setSuccessModalData(null);
  };

  const handleCloseErrorModal = () => {
    setErrorModalData(null);
  };

  return {
    printConfig,
    setPrintConfig,
    printMode,
    showPrintModal: false, // This is managed in uiState
    handleOpenPrintModal,
    handleClosePrintModal,
    handlePrintForms,
    handlePrintMasterEstimate,
    handlePrintShopPacking,
    handlePrintAndMoveToProduction,
    handleMoveToProductionWithoutPrinting,
    handleGenerateForms,
    handlePrintMasterForm,
    formUrls,
    successModalData,
    handleCloseSuccessModal,
    errorModalData,
    handleCloseErrorModal
  };
}