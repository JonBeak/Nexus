import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Table, CheckSquare, Home, Calendar } from 'lucide-react';
import { PanelDashboard } from './panelDashboard';
import OrdersTable from './table/OrdersTable';
import ProgressRoleView from './progressRole/ProgressRoleView';
import TasksTable from './tasksTable/TasksTable';
import CalendarView from './calendarView/CalendarView';

type TabId = 'dashboard' | 'progress' | 'table' | 'tasksTable' | 'calendar';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/orders' },
  { id: 'table', label: 'Orders Table', icon: <Table className="w-5 h-5" />, path: '/orders/table' },
  { id: 'tasksTable', label: 'Tasks Table', icon: <CheckSquare className="w-5 h-5" />, path: '/orders/tasks' },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-5 h-5" />, path: '/orders/calendar' },
  { id: 'progress', label: 'Role-based Tasks', icon: <ListChecks className="w-5 h-5" />, path: '/orders/role-tasks' }
];

// Map URL paths to tab IDs
const pathToTab: Record<string, TabId> = {
  '/orders': 'dashboard',
  '/orders/table': 'table',
  '/orders/tasks': 'tasksTable',
  '/orders/calendar': 'calendar',
  '/orders/role-tasks': 'progress'
};

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active tab from URL
  const activeTab = pathToTab[location.pathname] || 'dashboard';

  const handleTabClick = (tab: Tab) => {
    navigate(tab.path);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <Home className="w-7 h-7" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
              <p className="text-sm text-gray-600 mt-1">Manage production orders and track progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <div className="flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`
                  flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <PanelDashboard />}
        {activeTab === 'progress' && <ProgressRoleView />}
        {activeTab === 'table' && <OrdersTable />}
        {activeTab === 'tasksTable' && <TasksTable />}
        {activeTab === 'calendar' && <CalendarView />}
      </div>
    </div>
  );
};

export default OrdersPage;
