/**
 * UnknownApplicationModal - Handle unknown vinyl/digital print applications during task generation
 *
 * Shown when task generation encounters applications not in the vinyl matrix.
 * Allows user to:
 * 1. Select which tasks to generate for each unknown application
 * 2. Optionally save the mapping to the matrix for future use
 */

import React, { useState } from 'react';
import { X, Check, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';

// Available vinyl-related tasks
const VINYL_TASKS = [
  'Vinyl Plotting',
  'Vinyl Face Before Cutting',
  'Vinyl Face After Cutting',
  'Vinyl Wrap Return/Trim',
  'Vinyl after Fabrication'
];

export interface UnknownApplication {
  partId: number;
  partDisplayNumber: string;
  productType: string;
  productTypeKey: string;
  application: string;
  applicationKey: string;
  colour: string | null;
  specName: 'Vinyl' | 'Digital Print';
}

export interface ApplicationResolution {
  partId: number;
  application: string;
  applicationKey: string;
  productType: string;
  productTypeKey: string;
  colour: string | null;
  specName: 'Vinyl' | 'Digital Print';
  taskNames: string[];
  saveApplication: boolean;  // Add to specification_options
  saveToMatrix: boolean;     // Save task mapping for future
}

interface UnknownApplicationModalProps {
  unknownApplications: UnknownApplication[];
  onResolve: (resolutions: ApplicationResolution[]) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

export const UnknownApplicationModal: React.FC<UnknownApplicationModalProps> = ({
  unknownApplications,
  onResolve,
  onClose,
  saving = false
}) => {
  // Track resolutions for each unknown application
  // saveApplicationManual tracks if user manually checked "Add application" (vs auto-checked from "Remember")
  const [resolutions, setResolutions] = useState<Map<string, {
    tasks: string[];
    saveApplication: boolean;
    saveApplicationManual: boolean;
    saveToMatrix: boolean
  }>>(
    () => new Map(unknownApplications.map(app => [
      `${app.partId}-${app.applicationKey}`,
      { tasks: [], saveApplication: false, saveApplicationManual: false, saveToMatrix: false }
    ]))
  );

  // Current application being edited (for multi-step flow)
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentApp = unknownApplications[currentIndex];
  const currentKey = `${currentApp.partId}-${currentApp.applicationKey}`;
  const currentResolution = resolutions.get(currentKey) || { tasks: [], saveApplication: false, saveApplicationManual: false, saveToMatrix: false };

  const toggleTask = (taskName: string) => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentKey) || { tasks: [], saveApplication: false, saveApplicationManual: false, saveToMatrix: false };

      if (taskName === 'NO_TASK') {
        if (current.tasks.includes('NO_TASK')) {
          // Deselect NO_TASK
          newMap.set(currentKey, { ...current, tasks: [] });
        } else {
          // Select NO_TASK - exclusive, clear all other tasks and saveToMatrix
          newMap.set(currentKey, { ...current, tasks: ['NO_TASK'], saveToMatrix: false });
        }
      } else {
        // Regular task - remove NO_TASK if present, toggle this task
        const tasksWithoutNoTask = current.tasks.filter(t => t !== 'NO_TASK');
        const newTasks = tasksWithoutNoTask.includes(taskName)
          ? tasksWithoutNoTask.filter(t => t !== taskName)
          : [...tasksWithoutNoTask, taskName];
        newMap.set(currentKey, { ...current, tasks: newTasks });
      }
      return newMap;
    });
  };

  const toggleSaveApplication = () => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentKey) || { tasks: [], saveApplication: false, saveApplicationManual: false, saveToMatrix: false };

      // If saveToMatrix is on, saveApplication is locked - can't toggle
      if (current.saveToMatrix) {
        return prev;
      }

      const newSaveApplication = !current.saveApplication;
      newMap.set(currentKey, {
        ...current,
        saveApplication: newSaveApplication,
        saveApplicationManual: newSaveApplication  // Track that user manually set this
      });
      return newMap;
    });
  };

  const toggleSaveToMatrix = () => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentKey) || { tasks: [], saveApplication: false, saveApplicationManual: false, saveToMatrix: false };

      const newSaveToMatrix = !current.saveToMatrix;

      if (newSaveToMatrix) {
        // Enabling "Remember for future" - auto-enable and lock "Add application"
        newMap.set(currentKey, {
          ...current,
          saveToMatrix: true,
          saveApplication: true
        });
      } else {
        // Disabling "Remember for future"
        // Only uncheck "Add application" if it wasn't manually set before
        newMap.set(currentKey, {
          ...current,
          saveToMatrix: false,
          saveApplication: current.saveApplicationManual ? current.saveApplication : false
        });
      }
      return newMap;
    });
  };

  const handleSubmit = async () => {
    const resolvedApps: ApplicationResolution[] = unknownApplications.map(app => {
      const key = `${app.partId}-${app.applicationKey}`;
      const resolution = resolutions.get(key) || { tasks: [], saveApplication: false, saveApplicationManual: false, saveToMatrix: false };
      // Filter out NO_TASK - it's just a UI marker, not a real task
      const realTasks = resolution.tasks.filter(t => t !== 'NO_TASK');
      return {
        partId: app.partId,
        application: app.application,
        applicationKey: app.applicationKey,
        productType: app.productType,
        productTypeKey: app.productTypeKey,
        colour: app.colour,
        specName: app.specName,
        taskNames: realTasks,
        saveApplication: resolution.saveApplication,
        saveToMatrix: resolution.saveToMatrix
      };
    });

    await onResolve(resolvedApps);
  };

  const canGoNext = currentIndex < unknownApplications.length - 1;
  const canGoPrev = currentIndex > 0;
  const isLastApp = currentIndex === unknownApplications.length - 1;

  // Count how many have at least one task selected (including NO_TASK as a valid choice)
  const resolvedCount = Array.from(resolutions.values()).filter(r => r.tasks.length > 0).length;
  const allResolved = resolvedCount === unknownApplications.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-amber-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Unknown Application</h3>
                <p className="text-sm text-gray-600">
                  {unknownApplications.length > 1
                    ? `${currentIndex + 1} of ${unknownApplications.length} applications`
                    : 'Select tasks to generate'
                  }
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Application Info */}
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Part:</span>
                <span className="ml-2 font-medium text-gray-900">{currentApp.partDisplayNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium text-gray-900">{currentApp.productType}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Application:</span>
                <span className="ml-2 font-semibold text-amber-700">{currentApp.application}</span>
              </div>
              {currentApp.colour && (
                <div className="col-span-2">
                  <span className="text-gray-500">Colour:</span>
                  <span className="ml-2 font-medium text-gray-900">{currentApp.colour}</span>
                </div>
              )}
            </div>
          </div>

          {/* Task Selection */}
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-3">Select tasks to generate for this application:</p>
            <div className="space-y-2">
              {/* No Task Option */}
              <button
                onClick={() => toggleTask('NO_TASK')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                  currentResolution.tasks.includes('NO_TASK')
                    ? 'border-gray-500 bg-gray-100'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium text-gray-600 italic">No task needed</span>
                {currentResolution.tasks.includes('NO_TASK') && (
                  <Check className="w-5 h-5 text-gray-600" />
                )}
              </button>

              <div className="border-t border-gray-200 my-2" />

              {/* Task Options */}
              {VINYL_TASKS.map(taskName => (
                <button
                  key={taskName}
                  onClick={() => toggleTask(taskName)}
                  disabled={currentResolution.tasks.includes('NO_TASK')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    currentResolution.tasks.includes(taskName)
                      ? 'border-blue-500 bg-blue-50'
                      : currentResolution.tasks.includes('NO_TASK')
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">{taskName}</span>
                  {currentResolution.tasks.includes(taskName) && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>

            {/* Save Options */}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              {/* Save Application Option */}
              <button
                onClick={toggleSaveApplication}
                disabled={currentResolution.saveToMatrix}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                  currentResolution.saveApplication
                    ? currentResolution.saveToMatrix
                      ? 'border-blue-300 bg-blue-50 cursor-not-allowed'
                      : 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  currentResolution.saveApplication
                    ? currentResolution.saveToMatrix
                      ? 'border-blue-300 bg-blue-300'
                      : 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {currentResolution.saveApplication && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-sm font-medium ${currentResolution.saveToMatrix ? 'text-gray-500' : 'text-gray-900'}`}>
                    Add application to system
                    {currentResolution.saveToMatrix && <span className="text-xs ml-1">(required)</span>}
                  </span>
                  <p className="text-xs text-gray-500">Add "{currentApp.application}" to dropdown options</p>
                </div>
              </button>

              {/* Save to Matrix Option */}
              {(() => {
                const hasRealTasks = currentResolution.tasks.length > 0 && !currentResolution.tasks.includes('NO_TASK');
                return (
                  <button
                    onClick={toggleSaveToMatrix}
                    disabled={!hasRealTasks}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border transition-all ${
                      currentResolution.saveToMatrix
                        ? 'border-green-500 bg-green-50'
                        : !hasRealTasks
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                      currentResolution.saveToMatrix ? 'border-green-500 bg-green-500' : 'border-gray-300'
                    }`}>
                      {currentResolution.saveToMatrix && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium text-gray-900">Remember for future orders</span>
                      {hasRealTasks ? (
                        <div className="mt-1 text-xs text-gray-600 bg-gray-100 rounded p-2">
                          <div className="font-medium text-gray-700">{currentApp.productType} + {currentApp.application}:</div>
                          <ul className="mt-1 text-gray-500 list-disc list-inside">
                            {currentResolution.tasks.map(t => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Select tasks first (not available for "No task")</p>
                      )}
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex items-center gap-2">
              {unknownApplications.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentIndex(i => i - 1)}
                    disabled={!canGoPrev}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-500">
                    {resolvedCount}/{unknownApplications.length} resolved
                  </span>
                  <button
                    onClick={() => setCurrentIndex(i => i + 1)}
                    disabled={!canGoNext}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              {isLastApp || unknownApplications.length === 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !allResolved}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? 'Creating Tasks...' : 'Create Tasks'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex(i => i + 1)}
                  disabled={currentResolution.tasks.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnknownApplicationModal;
