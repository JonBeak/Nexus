import React from 'react';
import { Lock, AlertTriangle, Clock, Shield, CheckCircle } from 'lucide-react';
import { LockStatus } from '../../services/lockService';

interface EditLockIndicatorProps {
  lockStatus: LockStatus | null;
  hasLock: boolean;
  isLoading?: boolean;
  canOverride: boolean;
  onOverride: () => void;
  onViewReadOnly?: () => void;
  compact?: boolean; // For header bar display
  showDetails?: boolean; // Show detailed status info
}

export const EditLockIndicator: React.FC<EditLockIndicatorProps> = ({
  lockStatus,
  hasLock,
  isLoading = false,
  canOverride,
  onOverride,
  onViewReadOnly,
  compact = false,
  showDetails = true
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center ${compact ? 'text-sm' : ''}`}>
        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
        <span className="text-gray-600">Checking lock status...</span>
      </div>
    );
  }

  // No lock status available
  if (!lockStatus) {
    return null;
  }

  // User has the lock - show success indicator
  if (hasLock) {
    if (compact) {
      return (
        <div className="flex items-center text-green-600 text-sm">
          <CheckCircle className="w-4 h-4 mr-1" />
          <span>Editing</span>
          {lockStatus.locked_by_override && (
            <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded text-xs ml-2">
              Override
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center text-green-600">
        <CheckCircle className="w-5 h-5 mr-2" />
        <div>
          <span className="font-medium">You are editing this resource</span>
          {lockStatus.locked_by_override && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs ml-2">
              Override Active
            </span>
          )}
        </div>
      </div>
    );
  }

  // Someone else has the lock - show conflict
  if (lockStatus.editing_user && !hasLock) {
    return <LockConflictDisplay 
      lockStatus={lockStatus}
      canOverride={canOverride}
      onOverride={onOverride}
      onViewReadOnly={onViewReadOnly}
      compact={compact}
      showDetails={showDetails}
    />;
  }

  // No active lock
  return null;
};

interface LockConflictDisplayProps {
  lockStatus: LockStatus;
  canOverride: boolean;
  onOverride: () => void;
  onViewReadOnly?: () => void;
  compact?: boolean;
  showDetails?: boolean;
}

const LockConflictDisplay: React.FC<LockConflictDisplayProps> = ({
  lockStatus,
  canOverride,
  onOverride,
  onViewReadOnly,
  compact = false,
  showDetails = true
}) => {
  const getTimeRemaining = (): string | null => {
    if (!lockStatus.editing_expires_at) return null;
    
    const expiresAt = new Date(lockStatus.editing_expires_at);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m remaining`;
    } else {
      return `${diffMinutes}m remaining`;
    }
  };

  // Compact version for header bars
  if (compact) {
    return (
      <div className="flex items-center text-orange-600 text-sm">
        <Lock className="w-4 h-4 mr-1" />
        <span>Locked by {lockStatus.editing_user}</span>
        {canOverride && (
          <button
            onClick={onOverride}
            className="ml-2 px-1 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Override
          </button>
        )}
      </div>
    );
  }

  // Full version with details
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Lock className="w-5 h-5 text-orange-500" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-medium text-orange-800">Resource Locked</h3>
            {lockStatus.locked_by_override && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                Override Active
              </span>
            )}
          </div>
          
          <p className="text-sm text-orange-700 mb-2">
            <strong>{lockStatus.editing_user}</strong> is currently editing this resource.
          </p>
          
          {showDetails && lockStatus.editing_started_at && (
            <div className="flex items-center space-x-2 text-xs text-orange-600 mb-3">
              <Clock className="w-4 h-4" />
              <span>Started: {new Date(lockStatus.editing_started_at).toLocaleString()}</span>
              {getTimeRemaining() && (
                <>
                  <span>•</span>
                  <span>{getTimeRemaining()}</span>
                </>
              )}
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            {onViewReadOnly && (
              <button
                onClick={onViewReadOnly}
                className="px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                View Read-Only
              </button>
            )}
            
            {canOverride && (
              <button
                onClick={onOverride}
                className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
              >
                <Shield className="w-3 h-3" />
                <span>Override Lock</span>
              </button>
            )}
          </div>
          
          {canOverride && showDetails && (
            <p className="text-xs text-orange-600 mt-2">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Overriding may cause editing conflicts
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Simple status indicator for showing in lists
export const LockStatusBadge: React.FC<{
  lockStatus: LockStatus | null;
  currentUserId: number;
}> = ({ lockStatus, currentUserId }) => {
  if (!lockStatus || !lockStatus.editing_user) return null;

  const isCurrentUser = lockStatus.editing_user_id === currentUserId;

  return (
    <div className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
      isCurrentUser 
        ? 'bg-green-100 text-green-800' 
        : 'bg-orange-100 text-orange-800'
    }`}>
      <Lock className="w-3 h-3 mr-1" />
      {isCurrentUser ? 'You' : lockStatus.editing_user}
    </div>
  );
};