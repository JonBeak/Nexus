/**
 * NetworkInterfacesPanel Component
 * Created: Jan 14, 2026
 *
 * Displays network interfaces with IP addresses and status.
 */

import React from 'react';
import { RefreshCw, Wifi, Cable, Network } from 'lucide-react';
import type { NetworkInterface } from '../../../services/api/serverManagementApi';

interface NetworkInterfacesPanelProps {
  interfaces: NetworkInterface[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const NetworkInterfacesPanel: React.FC<NetworkInterfacesPanelProps> = ({
  interfaces,
  isLoading = false,
  onRefresh
}) => {
  const getIcon = (type: NetworkInterface['type']) => {
    switch (type) {
      case 'wifi':
        return <Wifi className="w-5 h-5" />;
      case 'ethernet':
        return <Cable className="w-5 h-5" />;
      default:
        return <Network className="w-5 h-5" />;
    }
  };

  const getNetworkLabel = (iface: NetworkInterface) => {
    // Use description if available, otherwise fall back to network type
    if (iface.description) {
      // Color based on type
      if (iface.type === 'ethernet') {
        return { text: iface.description, bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
      } else if (iface.type === 'wifi') {
        return { text: iface.description, bgColor: 'bg-purple-100', textColor: 'text-purple-700' };
      } else {
        return { text: iface.description, bgColor: 'bg-gray-100', textColor: 'text-gray-600' };
      }
    }
    // Fallback to network type
    switch (iface.network) {
      case 'main':
        return { text: 'Main Network', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
      case 'guest':
        return { text: 'Guest Network', bgColor: 'bg-purple-100', textColor: 'text-purple-700' };
      default:
        return { text: 'Unknown', bgColor: 'bg-gray-100', textColor: 'text-gray-700' };
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-800">Network Interfaces</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {interfaces.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No network interfaces found</p>
      ) : (
        <div className="space-y-3">
          {interfaces.map((iface) => {
            const networkLabel = getNetworkLabel(iface);

            return (
              <div
                key={iface.name}
                className={`p-3 rounded-lg border ${
                  iface.status === 'up' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={iface.status === 'up' ? 'text-green-600' : 'text-gray-400'}>
                      {getIcon(iface.type)}
                    </div>
                    <span className="font-mono font-medium text-gray-800">{iface.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${networkLabel.bgColor} ${networkLabel.textColor}`}>
                      {networkLabel.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${iface.status === 'up' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className={`text-xs font-medium ${iface.status === 'up' ? 'text-green-700' : 'text-gray-500'}`}>
                      {iface.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">IP:</span>
                    <span className="ml-1 font-mono font-medium text-gray-800">
                      {iface.ip || 'No IP assigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-1 text-gray-700 capitalize">{iface.type}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NetworkInterfacesPanel;
