import React from 'react';
import { LoginLog } from '../../hooks/useAccountAPI';
import { PAGE_STYLES } from '../../../../constants/moduleColors';

interface LoginLogsTabProps {
  loginLogs: LoginLog[];
}

export const LoginLogsTab: React.FC<LoginLogsTabProps> = ({ loginLogs }) => {
  return (
    <div>
      <h2 className={`text-2xl font-bold ${PAGE_STYLES.panel.text} mb-6`}>Login Activity</h2>
      <div className={PAGE_STYLES.composites.panelContainer + ' overflow-hidden'}>
        <table className={`min-w-full ${PAGE_STYLES.panel.divider}`}>
          <thead className={PAGE_STYLES.header.background}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                User
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                IP Address
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Login Time
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                User Agent
              </th>
            </tr>
          </thead>
          <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
            {loginLogs.map((log) => (
              <tr key={log.log_id} className={PAGE_STYLES.interactive.hover}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${PAGE_STYLES.panel.text}`}>
                    {log.first_name} {log.last_name}
                  </div>
                  <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>@{log.username}</div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                  {log.ip_address}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                  {new Date(log.login_time).toLocaleString()}
                </td>
                <td className={`px-6 py-4 text-sm ${PAGE_STYLES.panel.textMuted} max-w-xs truncate`}>
                  {log.user_agent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};