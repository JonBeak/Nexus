import React, { useState, useEffect } from 'react';
import { ordersApi } from '../../../services/api';
import PartTasksSection from './PartTasksSection';
import ProgressBar from './ProgressBar';
import StatusButtonArray from './StatusButtonArray';
import TimelineView from './TimelineView';
import ProductionNotes from './ProductionNotes';

interface Props {
  orderNumber: number;
  currentStatus?: string;
  productionNotes?: string;
  onOrderUpdated?: () => void;  // Callback to refetch order data from parent
}

export const ProgressView: React.FC<Props> = ({ orderNumber, currentStatus, productionNotes, onOrderUpdated }) => {
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
    // Notify parent to refetch order data so currentStatus prop updates
    if (onOrderUpdated) {
      onOrderUpdated();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading progress...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Summary */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="mb-4">
          <StatusButtonArray
            orderNumber={orderNumber}
            currentStatus={currentStatus as any}
            onStatusUpdated={handleStatusUpdated}
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Production Progress</h2>
          <ProgressBar
            completed={progress?.completed_tasks || 0}
            total={progress?.total_tasks || 0}
            percent={progress?.progress_percent || 0}
          />
        </div>
      </div>

      {/* Production Notes */}
      <ProductionNotes notes={productionNotes} />

      {/* Task Cards by Part - Horizontal Layout */}
      {/* Outer container handles scrolling, inner container centers content */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 justify-center min-w-min">
          {tasksByPart.map((part, index) => (
            <PartTasksSection
              key={part.part_id}
              part={part}
              partIndex={index + 1}
              orderNumber={orderNumber}
              orderStatus={currentStatus || ''}
              onTaskUpdated={handleTaskUpdated}
            />
          ))}
        </div>
      </div>

      {/* Timeline */}
      <TimelineView orderNumber={orderNumber} refreshTrigger={refreshTrigger} />
    </div>
  );
};

export default ProgressView;
