import { useState, useMemo } from 'react';
import { ordersApi, printApi } from '../../../../services/api';
import { orderStatusApi } from '../../../../services/api/orders/orderStatusApi';
import { Order, OrderPart } from '../../../../types/orders';
import { calculateShopCount } from '../services/orderCalculations';

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
  // Print Configuration
  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    master: 1,
    estimate: 1,
    shop: 2,
    packing: 2
  });

  // Print Mode
  const [printMode, setPrintMode] = useState<PrintMode>('full');

  // Refresh key to force formUrls regeneration when modal opens
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGenerateForms = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, generatingForms: true }));
      await ordersApi.generateOrderForms(orderData.order.order_number, false);
      alert('Order forms generated successfully!');
    } catch (err) {
      console.error('Error generating forms:', err);
      alert('Failed to generate order forms. Please try again.');
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
        let message = `Successfully printed ${summary.printedCopies} forms in a single job!\n\n` +
          `Master: ${summary.master}\n` +
          `Estimate: ${summary.estimate}\n` +
          `Shop: ${summary.shop}\n` +
          `Packing: ${summary.packing}\n\n` +
          `Job ID: ${result.jobId}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\n⚠️ Note: ${summary.skipped.join(', ')} not found and skipped`;
        }

        alert(message);
      } else {
        alert('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing forms:', err);
      alert(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
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
        let message = `Successfully printed Master & Estimate forms!\n\n` +
          `Master: ${summary.master}\n` +
          `Estimate: ${summary.estimate}\n\n` +
          `Job ID: ${result.jobId}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\n⚠️ Note: ${summary.skipped.join(', ')} not found and skipped`;
        }

        alert(message);
      } else {
        alert('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing master/estimate forms:', err);
      alert(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
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
        let message = `Successfully printed Shop & Packing forms!\n\n` +
          `Shop: ${summary.shop}\n` +
          `Packing: ${summary.packing}\n\n` +
          `Job ID: ${result.jobId}`;

        if (summary.skipped && summary.skipped.length > 0) {
          message += `\n\n⚠️ Note: ${summary.skipped.join(', ')} not found and skipped`;
        }

        alert(message);
      } else {
        alert('Failed to print forms. Please check the printer and try again.');
      }

      setUiState(prev => ({ ...prev, showPrintModal: false }));
    } catch (err: any) {
      console.error('Error printing shop/packing forms:', err);
      alert(err.response?.data?.message || 'Failed to print forms. Please check that CUPS is installed and a printer is configured.');
    } finally {
      setUiState(prev => ({ ...prev, printingForm: false }));
    }
  };

  const handlePrintMasterForm = async () => {
    if (!orderData.order) return;

    try {
      setUiState(prev => ({ ...prev, printingForm: true }));
      const result = await printApi.printOrderForm(orderData.order.order_number, 'master');
      alert(`Print job submitted successfully! Job ID: ${result.jobId || 'unknown'}`);
    } catch (err: any) {
      console.error('Error printing master form:', err);
      alert(err.response?.data?.message || 'Failed to print master form. Please check that CUPS is installed and a printer is configured.');
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
        alert('Please select at least one form to print (Shop or Packing).');
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
        alert('Failed to print forms. Please check the printer and try again.');
        setUiState(prev => ({ ...prev, printingForm: false }));
        return;
      }

      const { summary } = result;
      let message = `Successfully printed Shop & Packing forms!\n\n` +
        `Shop: ${summary.shop}\n` +
        `Packing: ${summary.packing}\n\n` +
        `Job ID: ${result.jobId}`;

      if (summary.skipped && summary.skipped.length > 0) {
        message += `\n\n⚠️ Note: ${summary.skipped.join(', ')} not found and skipped`;
      }

      alert(message);

      // Update order status to production_queue
      await orderStatusApi.updateOrderStatus(
        orderData.order.order_number,
        'production_queue',
        'Order approved and moved to production queue (printed forms)'
      );

      alert('Order moved to Production Queue successfully!');

      setUiState(prev => ({ ...prev, showPrintModal: false }));

      // Refresh order data to show updated status
      if (onOrderUpdated) {
        onOrderUpdated();
      }
    } catch (err: any) {
      console.error('Error printing and moving to production:', err);
      alert(err.response?.data?.message || 'Failed to move order to production. Please try again.');
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

      alert('Order moved to Production Queue successfully!');

      setUiState(prev => ({ ...prev, showPrintModal: false }));

      // Refresh order data to show updated status
      if (onOrderUpdated) {
        onOrderUpdated();
      }
    } catch (err: any) {
      console.error('Error moving to production:', err);
      alert(err.response?.data?.message || 'Failed to move order to production. Please try again.');
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
    formUrls
  };
}