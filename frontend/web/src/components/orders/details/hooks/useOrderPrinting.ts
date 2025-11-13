import { useState } from 'react';
import { ordersApi, printApi } from '../../../../services/api';
import { Order, OrderPart } from '../../../../types/orders';
import { calculateShopCount } from '../services/orderCalculations';

interface PrintConfig {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
}

interface OrderData {
  order: Order | null;
  parts: OrderPart[];
  taxRules: any[];
  customerDiscount: number;
}

interface FormUrls {
  master: string;
  shop: string;
  customer: string;
  packing: string;
}

export function useOrderPrinting(
  orderData: OrderData,
  setUiState: (updater: (prev: any) => any) => void
) {
  // Print Configuration
  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    master: 1,
    estimate: 1,
    shop: 2,
    packing: 2
  });

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

  const handleOpenPrintModal = () => {
    // Calculate shop count based on specs
    const shopCount = calculateShopCount(orderData.parts);

    // Set default quantities
    setPrintConfig({
      master: 1,
      estimate: 1,
      shop: shopCount,
      packing: 2
    });

    setUiState(prev => ({ ...prev, showPrintModal: true }));
  };

  const handleClosePrintModal = () => {
    setUiState(prev => ({ ...prev, showPrintModal: false }));
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
    return {
      master: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName}.pdf${cacheBuster}`,
      shop: `${apiUrl}/order-images/Orders/${folderName}/${orderNum} - ${jobName} - Shop.pdf${cacheBuster}`,
      customer: `${apiUrl}/order-images/Orders/${folderName}/Specs/${orderNum} - ${jobName} - Specs.pdf${cacheBuster}`,
      packing: `${apiUrl}/order-images/Orders/${folderName}/Specs/${orderNum} - ${jobName} - Packing List.pdf${cacheBuster}`
    };
  };

  const handleViewForms = () => {
    const urls = buildFormUrls();
    if (!urls) return;

    // Open all 4 forms in new tabs
    Object.values(urls).forEach((url) => {
      window.open(url, '_blank');
    });
  };

  const handleViewSingleForm = (formType: 'master' | 'shop' | 'customer' | 'packing') => {
    const urls = buildFormUrls();
    if (!urls) return;

    window.open(urls[formType], '_blank');
    setUiState(prev => ({ ...prev, showFormsDropdown: false }));
  };

  return {
    printConfig,
    setPrintConfig,
    showPrintModal: false, // This is managed in uiState
    handleOpenPrintModal,
    handleClosePrintModal,
    handlePrintForms,
    handleGenerateForms,
    handleViewForms,
    handleViewSingleForm,
    handlePrintMasterForm,
    formUrls: buildFormUrls()
  };
}