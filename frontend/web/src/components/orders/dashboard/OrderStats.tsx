import React, { useMemo } from 'react';
import { Order } from '../../../types/orders';
import { Clock, AlertCircle, CheckCircle, Package } from 'lucide-react';

interface Props {
  orders: Order[];
}

export const OrderStats: React.FC<Props> = ({ orders }) => {
  const stats = useMemo(() => {
    const total = orders.length;
    const inProduction = orders.filter(o =>
      o.status === 'in_production' || o.status === 'production_queue'
    ).length;
    const overdue = orders.filter(o => o.status === 'overdue').length;
    const completed = orders.filter(o => o.status === 'completed').length;

    return { total, inProduction, overdue, completed };
  }, [orders]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          icon={<Package className="w-6 h-6 text-indigo-600" />}
          label="Total Orders"
          value={stats.total}
          color="indigo"
        />
        <StatCard
          icon={<Clock className="w-6 h-6 text-blue-600" />}
          label="In Production"
          value={stats.inProduction}
          color="blue"
        />
        <StatCard
          icon={<AlertCircle className="w-6 h-6 text-red-600" />}
          label="Overdue"
          value={stats.overdue}
          color="red"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          label="Completed"
          value={stats.completed}
          color="green"
        />
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'indigo' | 'blue' | 'red' | 'green';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    indigo: 'bg-indigo-50',
    blue: 'bg-blue-50',
    red: 'bg-red-50',
    green: 'bg-green-50'
  };

  return (
    <div className="flex items-center space-x-3">
      <div className={`${colorClasses[color]} rounded-lg p-3`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default OrderStats;
