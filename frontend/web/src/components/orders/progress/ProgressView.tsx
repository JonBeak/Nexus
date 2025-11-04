import React, { useState, useEffect } from 'react';
import { ordersApi } from '../../../services/api';
import PartTasksSection from './PartTasksSection';
import ProgressBar from './ProgressBar';
import StatusDropdown from './StatusDropdown';
import TimelineView from './TimelineView';
import ProductionNotes from './ProductionNotes';

interface Props {
  orderNumber: number;
  currentStatus?: string;
  productionNotes?: string;
}

export const ProgressView: React.FC<Props> = ({ orderNumber, currentStatus, productionNotes }) => {
  const [tasksByPart, setTasksByPart] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchData();
  }, [orderNumber, refreshTrigger]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksData, progressData] = await Promise.all([
        ordersApi.getTasksByPart(orderNumber),
        ordersApi.getOrderProgress(orderNumber)
      ]);
      setTasksByPart(tasksData);
      setProgress(progressData);
    } catch (error) {
      console.error('Error fetching progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleStatusUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading progress...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Progress Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Progress Overview</h2>
          <StatusDropdown
            orderNumber={orderNumber}
            currentStatus={currentStatus as any}
            onStatusUpdated={handleStatusUpdated}
          />
        </div>
        <ProgressBar
          completed={progress?.completed_tasks || 0}
          total={progress?.total_tasks || 0}
          percent={progress?.progress_percent || 0}
        />
      </div>

      {/* Production Notes */}
      <ProductionNotes notes={productionNotes} />

      {/* Task Lists by Part */}
      <div className="space-y-4">
        {tasksByPart.map((part) => (
          <PartTasksSection
            key={part.part_id}
            part={part}
            orderNumber={orderNumber}
            onTaskUpdated={handleTaskUpdated}
          />
        ))}
      </div>

      {/* Timeline */}
      <TimelineView orderNumber={orderNumber} refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default ProgressView;
