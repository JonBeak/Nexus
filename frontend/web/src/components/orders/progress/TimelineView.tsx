import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { ordersApi } from '../../../services/api';
import { ORDER_STATUS_LABELS } from '../../../types/orders';

interface Props {
  orderNumber: number;
  refreshTrigger?: number;
}

export const TimelineView: React.FC<Props> = ({ orderNumber, refreshTrigger = 0 }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchTimeline();
  }, [orderNumber, refreshTrigger]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const data = await ordersApi.getStatusHistory(orderNumber);
      setEvents(data);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayedEvents = expanded ? events : events.slice(0, 5);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Status History</h2>

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading timeline...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-4 text-gray-500">No status changes yet</div>
      ) : (
        <>
          <div className="space-y-4">
            {displayedEvents.map((event, index) => (
              <div key={event.history_id || index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    Status changed to <span className="font-semibold">{ORDER_STATUS_LABELS[event.status as keyof typeof ORDER_STATUS_LABELS] || event.status}</span>
                  </p>
                  {event.notes && (
                    <p className="text-sm text-gray-600 mt-1">{event.notes}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(event.changed_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {events.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {expanded ? 'Show less' : `Show ${events.length - 5} more events`}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default TimelineView;
