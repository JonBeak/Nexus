import { api, API_BASE_URL } from '../apiClient';

/**
 * QuickBooks Integration API
 * Handles QuickBooks Online OAuth and accounting integration
 */
export const quickbooksApi = {
  /**
   * Check connection status
   */
  async getStatus(): Promise<{
    connected: boolean;
    realmId?: string;
    environment?: string;
    tokenExpiresAt?: string;
    message: string;
  }> {
    const response = await api.get('/quickbooks/status');
    return response.data;
  },

  /**
   * Check if QB credentials are configured
   */
  async getConfigStatus(): Promise<{
    configured: boolean;
    errors: string[];
    environment: string;
  }> {
    const response = await api.get('/quickbooks/config-status');
    return response.data;
  },

  /**
   * Initiate OAuth flow (opens QB authorization in new window)
   */
  async startAuth(): Promise<void> {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Get token from localStorage to pass as query param (needed for window.open)
    const token = localStorage.getItem('access_token');
    const authUrl = token
      ? `${API_BASE_URL}/quickbooks/start-auth?token=${encodeURIComponent(token)}`
      : `${API_BASE_URL}/quickbooks/start-auth`;

    window.open(
      authUrl,
      'QuickBooks Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  },

  /**
   * Disconnect from QuickBooks
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/quickbooks/disconnect');
    return response.data;
  },

  /**
   * Create estimate in QuickBooks
   */
  async createEstimate(estimateData: {
    estimateId: number;
    estimatePreviewData: any;
    debugMode?: boolean; // Optional: enables sent vs received comparison logging
  }): Promise<{
    success: boolean;
    qbEstimateId?: string;
    qbDocNumber?: string;
    qbEstimateUrl?: string;
    error?: string;
    missingItems?: string[];
    debug?: {
      linesSent: number;
      linesReturned: number;
      sentLines: any[];
      returnedLines: any[];
      fullEstimate: any;
    };
  }> {
    const response = await api.post('/quickbooks/create-estimate', estimateData);
    return response.data;
  },

  /**
   * Get all QuickBooks items for dropdowns
   */
  async getItems(): Promise<{
    success: boolean;
    items: Array<{
      id: number;
      name: string;
      description: string | null;
      qbItemId: string;
      qbItemType: string | null;
    }>;
  }> {
    const response = await api.get('/quickbooks/items');
    return response.data;
  }
};
