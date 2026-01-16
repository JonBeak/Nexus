import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, Table, CheckSquare, Calendar, Kanban, ChevronDown, Menu } from 'lucide-react';
import { HomeButton } from '../common/HomeButton';
import { PanelDashboard } from './panelDashboard';
import OrdersTable from './table/OrdersTable';
import ProgressRoleView from './progressRole/ProgressRoleView';
import TasksTable from './tasksTable/TasksTable';
import CalendarView from './calendarView/CalendarView';
import KanbanView from './kanbanView/KanbanView';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { ordersApi } from '../../services/api';

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
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine active tab from URL
  const activeTab = pathToTab[location.pathname] || 'dashboard';
  const activeTabData = TABS.find(t => t.id === activeTab) || TABS[0];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Check awaiting payment orders on initial page load (auto-complete when fully paid)
  const paymentCheckDone = useRef(false);
  useEffect(() => {
    if (paymentCheckDone.current) return;
    paymentCheckDone.current = true;

    ordersApi.checkAwaitingPayments().catch(error => {
      console.error('Failed to check awaiting payments:', error);
    });
  }, []);

  const handleTabClick = (tab: Tab) => {
    navigate(tab.path);
    setMobileMenuOpen(false);
  };

  // On mobile with Tasks Table, allow page scroll so header can scroll out of view
  const mobileTasksTable = isMobile && activeTab === 'tasksTable';

  return (
    <div className={`${mobileTasksTable ? '' : 'h-full'} flex flex-col ${PAGE_STYLES.page.background}`}>
      {/* Header with Tabs */}
      <div className={`${PAGE_STYLES.panel.background} border-b ${PAGE_STYLES.panel.border} px-3 md:px-6`}>
        <div className="flex items-center justify-between">
          {/* Left: Home + Title */}
          <div className="flex items-center space-x-2 md:space-x-4 py-3">
            <HomeButton />
            <div>
              <h1 className={`text-lg md:text-xl font-bold ${PAGE_STYLES.panel.text}`}>Orders</h1>
            </div>
          </div>

          {/* Mobile: Dropdown Menu */}
          {isMobile ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg min-h-[44px] ${MODULE_COLORS.orders.light} ${MODULE_COLORS.orders.text} border border-orange-200 active:bg-orange-200`}
              >
                {activeTabData.icon}
                <span className="font-medium text-sm">{activeTabData.label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {mobileMenuOpen && (
                <div className={`absolute right-0 top-full mt-1 ${PAGE_STYLES.panel.background} rounded-lg shadow-xl border ${PAGE_STYLES.panel.border} py-1 z-50 min-w-[200px]`}>
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors min-h-[48px]
                        ${activeTab === tab.id
                          ? `bg-orange-100 ${MODULE_COLORS.orders.text} font-medium`
                          : `${PAGE_STYLES.panel.text} active:bg-gray-100`
                        }
                      `}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Desktop: Horizontal Tabs */
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
          )}
        </div>
      </div>

      {/* Content - on mobile Tasks Table: sticky container that fills full viewport (lvh = large viewport, ignores browser chrome) */}
      <div className={`${mobileTasksTable ? 'sticky top-0 h-lvh' : 'flex-1 overflow-hidden'} ${PAGE_STYLES.page.background}`}>
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
