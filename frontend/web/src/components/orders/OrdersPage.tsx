import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Table, CheckSquare, Calendar, Kanban } from 'lucide-react';
import { HomeButton } from '../common/HomeButton';
import { PanelDashboard } from './panelDashboard';
import OrdersTable from './table/OrdersTable';
import ProgressRoleView from './progressRole/ProgressRoleView';
import TasksTable from './tasksTable/TasksTable';
import CalendarView from './calendarView/CalendarView';
import KanbanView from './kanbanView/KanbanView';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';

type TabId = 'dashboard' | 'progress' | 'table' | 'tasksTable' | 'calendar' | 'kanban';

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
  { id: 'kanban', label: 'Kanban', icon: <Kanban className="w-5 h-5" />, path: '/orders/kanban' },
  { id: 'progress', label: 'Role-based Tasks', icon: <ListChecks className="w-5 h-5" />, path: '/orders/role-tasks' }
];

// Map URL paths to tab IDs
const pathToTab: Record<string, TabId> = {
  '/orders': 'dashboard',
  '/orders/table': 'table',
  '/orders/tasks': 'tasksTable',
  '/orders/calendar': 'calendar',
  '/orders/kanban': 'kanban',
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
    <div className={`h-full flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Header with Tabs */}
      <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border} px-6`}>
        <div className="flex items-center justify-between">
          {/* Left: Home + Title */}
          <div className="flex items-center space-x-4 py-3">
            <HomeButton />
            <div>
              <h1 className={`text-xl font-bold ${PAGE_STYLES.panel.text}`}>Orders</h1>
            </div>
          </div>

          {/* Right: Tabs */}
          <div className="flex space-x-1 self-end">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`
                  flex items-center space-x-1.5 px-3 pt-4 pb-2 rounded-t-lg font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? `bg-orange-100 ${MODULE_COLORS.orders.text}`
                    : `${PAGE_STYLES.panel.textMuted} hover:text-orange-600 hover:bg-orange-50`
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
      <div className={`flex-1 overflow-hidden ${PAGE_STYLES.page.background}`}>
        {activeTab === 'dashboard' && <PanelDashboard />}
        {activeTab === 'progress' && <ProgressRoleView />}
        {activeTab === 'table' && <OrdersTable />}
        {activeTab === 'tasksTable' && <TasksTable />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'kanban' && <KanbanView />}
      </div>
    </div>
  );
};

export default OrdersPage;
