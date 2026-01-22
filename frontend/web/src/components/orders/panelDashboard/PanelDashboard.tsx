/**
 * PanelDashboard Component
 * Main customizable Orders Dashboard with configurable panels
 *
 * Created: 2025-12-17
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, RefreshCw, AlertCircle, X, Mail, CheckCircle, FileCheck, Loader2 } from 'lucide-react';
import { dashboardPanelsApi, orderStatusApi } from '../../../services/api';
import { useTasksSocket } from '../../../hooks/useTasksSocket';
import { PanelWithData, DashboardPanelDefinition, PanelActionType, PanelOrderRow } from '../../../types/dashboardPanel';
import DashboardPanel from './DashboardPanel';
import PanelSelectionModal from './PanelSelectionModal';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { useAlert } from '../../../contexts/AlertContext';

// Action modal state type
interface ActionModalState {
  isOpen: boolean;
  action: PanelActionType | null;
  order: PanelOrderRow | null;
}

export const PanelDashboard: React.FC = () => {
  const { showError } = useAlert();

  const [panels, setPanels] = useState<PanelWithData[]>([]);
  const [availablePanels, setAvailablePanels] = useState<DashboardPanelDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Action modal state
  const [actionModal, setActionModal] = useState<ActionModalState>({
    isOpen: false,
    action: null,
    order: null
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [addReminderPrefix, setAddReminderPrefix] = useState(true);

  // Fetch dashboard data on mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardPanelsApi.getDashboardData();
      setPanels(data.panels);
      setAvailablePanels(data.available_panels);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await dashboardPanelsApi.getDashboardData();
      setPanels(data.panels);
      setAvailablePanels(data.available_panels);
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // WebSocket subscription for real-time updates
  useTasksSocket({
    onTasksUpdated: handleRefresh,
    onOrderStatus: handleRefresh,
    onOrderCreated: handleRefresh,
    onOrderUpdated: handleRefresh,
    onOrderDeleted: handleRefresh,
    onInvoiceUpdated: handleRefresh,
    onReconnect: handleRefresh
  });

  const handleToggleCollapse = async (panelId: number, collapsed: boolean) => {
    try {
      await dashboardPanelsApi.togglePanelCollapsed(panelId, collapsed);
      // Update local state
      setPanels(prev => prev.map(p =>
        p.panel_id === panelId ? { ...p, is_collapsed: collapsed } : p
      ));
    } catch (err) {
      console.error('Error toggling panel:', err);
    }
  };

  const handleSavePanelSelection = async (selectedPanelIds: number[]) => {
    try {
      await dashboardPanelsApi.setUserPanels(selectedPanelIds);
      setShowConfigModal(false);
      await fetchDashboardData();
    } catch (err) {
      console.error('Error saving panel selection:', err);
    }
  };

  const handlePanelAction = (order: PanelOrderRow, action: PanelActionType) => {
    setActionModal({ isOpen: true, action, order });
    setAddReminderPrefix(true); // Reset checkbox
  };

  const closeActionModal = () => {
    setActionModal({ isOpen: false, action: null, order: null });
    setActionLoading(false);
  };

  const handleConfirmAction = async () => {
    if (!actionModal.order || !actionModal.action) return;

    const { order, action } = actionModal;
    setActionLoading(true);

    try {
      switch (action) {
        case 'send_reminder': {
          // Navigate to order page with email modal parameters
          const params = new URLSearchParams({
            action: 'send_email',
            emailType: 'quote_confirmation',
            ...(addReminderPrefix && { subjectPrefix: '[Reminder] ' })
          });
          window.open(`/orders/${order.order_number}?${params.toString()}`, '_blank');
          closeActionModal();
          break;
        }
        case 'mark_approved':
          await orderStatusApi.updateOrderStatus(order.order_number, 'approved_by_customer');
          closeActionModal();
          await handleRefresh();
          break;
        case 'approve_files':
          await orderStatusApi.updateOrderStatus(order.order_number, 'in_production');
          closeActionModal();
          await handleRefresh();
          break;
      }
    } catch (err) {
      console.error(`Error performing action ${action}:`, err);
      showError(`Failed to perform action: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Render action modal content based on action type
  const renderActionModalContent = () => {
    if (!actionModal.order || !actionModal.action) return null;

    const { order, action } = actionModal;

    switch (action) {
      case 'send_reminder':
        return (
          <>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Send Reminder Email</h3>
                <p className="text-sm text-gray-500">Order #{order.order_number} - {order.order_name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              This will open the order page where you can compose and send a confirmation reminder email to the customer.
            </p>
            <label className="flex items-center space-x-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={addReminderPrefix}
                onChange={(e) => setAddReminderPrefix(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700">Add "[Reminder]" prefix to email subject</span>
            </label>
          </>
        );

      case 'mark_approved':
        return (
          <>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Mark as Approved</h3>
                <p className="text-sm text-gray-500">Order #{order.order_number} - {order.order_name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              This will mark the order as <strong>Approved by Customer</strong> and move it to the next stage in the workflow.
              The customer has confirmed they approve the quote and want to proceed.
            </p>
          </>
        );

      case 'approve_files':
        return (
          <>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-emerald-100 rounded-full">
                <FileCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Approve Production Files</h3>
                <p className="text-sm text-gray-500">Order #{order.order_number} - {order.order_name}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              This will approve the production files and move the order to <strong>In Production</strong>.
              Make sure all files have been reviewed and are ready for manufacturing.
            </p>
          </>
        );

      default:
        return null;
    }
  };

  const getActionButtonText = () => {
    switch (actionModal.action) {
      case 'send_reminder':
        return 'Open Email Editor';
      case 'mark_approved':
        return 'Mark as Approved';
      case 'approve_files':
        return 'Approve Files';
      default:
        return 'Confirm';
    }
  };

  const getActionButtonColor = () => {
    switch (actionModal.action) {
      case 'send_reminder':
        return 'bg-blue-600 hover:bg-blue-700';
      case 'mark_approved':
        return 'bg-green-600 hover:bg-green-700';
      case 'approve_files':
        return 'bg-emerald-600 hover:bg-emerald-700';
      default:
        return 'bg-indigo-600 hover:bg-indigo-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`flex items-center space-x-2 ${PAGE_STYLES.panel.textMuted}`}>
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchDashboardData}
          className={`px-4 py-2 ${MODULE_COLORS.orders.base} text-white rounded-lg ${MODULE_COLORS.orders.hover} transition-colors`}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Toolbar */}
      <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border} px-6 py-3 flex items-center justify-between`}>
        <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
          {panels.length} panel{panels.length !== 1 ? 's' : ''} configured
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 ${PAGE_STYLES.interactive.hover} rounded-lg transition-colors disabled:opacity-50`}
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            className={`flex items-center space-x-2 px-4 py-2 ${MODULE_COLORS.orders.base} text-white rounded-lg ${MODULE_COLORS.orders.hover} transition-colors`}
          >
            <Settings className="w-4 h-4" />
            <span>Configure Panels</span>
          </button>
        </div>
      </div>

      {/* Panels Grid */}
      <div className="flex-1 overflow-auto p-6">
        {panels.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-64 ${PAGE_STYLES.composites.panelContainer}`}>
            <Settings className={`w-12 h-12 ${PAGE_STYLES.panel.textMuted} mb-4`} />
            <p className={`${PAGE_STYLES.panel.textMuted} mb-4`}>No panels configured</p>
            <button
              onClick={() => setShowConfigModal(true)}
              className={`px-4 py-2 ${MODULE_COLORS.orders.base} text-white rounded-lg ${MODULE_COLORS.orders.hover} transition-colors`}
            >
              Configure Your Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {panels.map((panel) => (
              <DashboardPanel
                key={panel.panel_id}
                panel={panel}
                onToggleCollapse={handleToggleCollapse}
                onAction={handlePanelAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <PanelSelectionModal
          availablePanels={availablePanels}
          selectedPanelIds={panels.map(p => p.panel_id)}
          onSave={handleSavePanelSelection}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${PAGE_STYLES.panel.background} rounded-lg shadow-xl max-w-md w-full mx-4`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${PAGE_STYLES.panel.border}`}>
              <span className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>Action</span>
              <button
                onClick={closeActionModal}
                className={`p-1 ${PAGE_STYLES.panel.textMuted} hover:text-orange-600 rounded`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              {renderActionModalContent()}
            </div>
            <div className={`flex items-center justify-end space-x-3 px-6 py-4 ${PAGE_STYLES.header.background} rounded-b-lg`}>
              <button
                onClick={closeActionModal}
                className={`px-4 py-2 ${PAGE_STYLES.header.text} ${PAGE_STYLES.panel.background} border ${PAGE_STYLES.panel.border} rounded-lg ${PAGE_STYLES.interactive.hover} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2 ${getActionButtonColor()}`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{getActionButtonText()}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelDashboard;
