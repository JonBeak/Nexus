import React from 'react';
import { Plus, Edit, Key, Eye, Calendar } from 'lucide-react';
import { User } from '../../hooks/useAccountAPI';
import { PAGE_STYLES, MODULE_COLORS } from '../../../../constants/moduleColors';

interface UsersTabProps {
  users: User[];
  onCreateUser: () => void;
  onEditUser: (user: User) => void;
  onChangePassword: (user: User) => void;
  onViewLogs: (user: User) => void;
  onManageVacation: (user: User) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  users,
  onCreateUser,
  onEditUser,
  onChangePassword,
  onViewLogs,
  onManageVacation
}) => {
  // Check if account is a non-user/demo account
  const nonUserUsernames = ['admin', 'manager', 'designer', 'staff', 'demo'];
  const isNonUserAccount = (user: User) =>
    user.last_name === 'User' || nonUserUsernames.includes(user.username.toLowerCase());

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'designer': return 'bg-red-100 text-red-800';
      case 'production_staff': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'manager': return 'Manager';
      case 'designer': return 'Designer';
      case 'production_staff': return 'Production Staff';
      default: return role;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>User Accounts</h2>
        <button
          onClick={onCreateUser}
          className={`flex items-center space-x-2 ${MODULE_COLORS.accounts.base} ${MODULE_COLORS.accounts.hover} text-white px-4 py-2 rounded-lg transition-colors`}
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
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
                Role
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Group
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Status
              </th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.divider}`}>
            {(() => {
              // Sort function for users within each group
              const sortUsers = (a: User, b: User) => {
                // Sort by: 1) active status (active first), 2) role, 3) name
                if (a.is_active && !b.is_active) return -1;
                if (!a.is_active && b.is_active) return 1;
                // Role priority: owner > manager > designer > production_staff
                const rolePriority: Record<string, number> = {
                  owner: 0,
                  manager: 1,
                  designer: 2,
                  production_staff: 3
                };
                const aRolePriority = rolePriority[a.role] ?? 99;
                const bRolePriority = rolePriority[b.role] ?? 99;
                if (aRolePriority !== bRolePriority) return aRolePriority - bRolePriority;
                // If same role, sort by first name
                return a.first_name.localeCompare(b.first_name);
              };

              // Separate users into regular and non-user accounts
              const regularUsers = users.filter(u => !isNonUserAccount(u)).sort(sortUsers);
              const nonUserAccounts = users.filter(u => isNonUserAccount(u)).sort(sortUsers);

              // Combine with section header
              const rows: React.ReactNode[] = [];

              regularUsers.forEach((userData) => {
                rows.push(renderUserRow(userData));
              });

              if (nonUserAccounts.length > 0) {
                rows.push(
                  <tr key="non-user-header" className="bg-gray-200">
                    <td colSpan={5} className="px-6 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Non-User Accounts
                    </td>
                  </tr>
                );
                nonUserAccounts.forEach((userData) => {
                  rows.push(renderUserRow(userData));
                });
              }

              return rows;

              function renderUserRow(userData: User) {
                return (
                  <tr key={userData.user_id} className={PAGE_STYLES.interactive.hover}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 ${PAGE_STYLES.header.background} rounded-full flex items-center justify-center`}>
                          <span className={`${PAGE_STYLES.panel.textSecondary} font-medium`}>
                            {userData.first_name[0]}{userData.last_name[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                            {userData.first_name} {userData.last_name}
                          </div>
                          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>@{userData.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userData.role)}`}>
                        {getRoleLabel(userData.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        userData.user_group === 'Group A' ? 'bg-purple-100 text-purple-800' :
                        userData.user_group === 'Group B' ? 'bg-orange-100 text-orange-800' :
                        userData.user_group ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-gray-500'
                      }`}>
                        {userData.user_group || 'No Group'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        userData.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {userData.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => onEditUser(userData)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors text-sm"
                        >
                          <Edit className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => onChangePassword(userData)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm"
                        >
                          <Key className="h-4 w-4" />
                          <span>Password</span>
                        </button>
                        <button
                          onClick={() => onViewLogs(userData)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                        >
                          <Eye className="h-4 w-4" />
                          <span>Logs</span>
                        </button>
                        <button
                          onClick={() => onManageVacation(userData)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors text-sm"
                        >
                          <Calendar className="h-4 w-4" />
                          <span>Vacation</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};