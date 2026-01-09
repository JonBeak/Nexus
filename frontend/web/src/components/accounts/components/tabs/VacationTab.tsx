import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { User, VacationPeriod } from '../../hooks/useAccountAPI';
import { PAGE_STYLES } from '../../../../constants/moduleColors';

interface VacationTabProps {
  vacationPeriods: VacationPeriod[];
  users: User[];
  onCreateVacation: () => void;
  onDeleteVacation: (vacationId: number) => void;
}

export const VacationTab: React.FC<VacationTabProps> = ({
  vacationPeriods,
  users,
  onCreateVacation,
  onDeleteVacation
}) => {
  const getUserName = (userId: number) => {
    const user = users.find(u => u.user_id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown User';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Vacation Periods</h2>
        <button
          onClick={onCreateVacation}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Vacation</span>
        </button>
      </div>

      <div className={PAGE_STYLES.composites.panelContainer + ' overflow-hidden'}>
        <table className={`min-w-full ${PAGE_STYLES.panel.divider}`}>
          <thead className={PAGE_STYLES.header.background}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                User
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Start Date
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                End Date
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Description
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
            {vacationPeriods.map((vacation) => (
              <tr key={vacation.vacation_id} className={PAGE_STYLES.interactive.hover}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                  {getUserName(vacation.user_id)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                  {new Date(vacation.start_date).toLocaleDateString()}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`}>
                  {new Date(vacation.end_date).toLocaleDateString()}
                </td>
                <td className={`px-6 py-4 text-sm ${PAGE_STYLES.panel.text}`}>
                  {vacation.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    className="text-red-600 hover:text-red-900"
                    onClick={() => onDeleteVacation(vacation.vacation_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};