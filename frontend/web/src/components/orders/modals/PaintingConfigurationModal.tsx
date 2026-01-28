/**
 * PaintingConfigurationModal - Configure painting tasks when matrix lookup returns no tasks
 *
 * Shown when task generation encounters painting combinations not in the matrix.
 * Allows user to:
 * 1. Select which painting tasks to generate
 * 2. Optionally save the mapping to the matrix for future use
 */

import React, { useState, useEffect } from 'react';
import { X, Check, Paintbrush, ChevronRight, ChevronLeft } from 'lucide-react';
import { SpecificationOptionsCache } from '@/services/specificationOptionsCache';

// Available painting tasks (must match PAINTING_TASKS in paintingTaskMatrix.ts)
const PAINTING_TASKS = [
  { id: 1, name: 'Sanding (320) before cutting' },
  { id: 2, name: 'Scuffing before cutting' },
  { id: 3, name: 'Paint before cutting' },
  { id: 4, name: 'Sanding (320) after cutting' },
  { id: 5, name: 'Scuffing after cutting' },
  { id: 6, name: 'Paint After Cutting' },
  { id: 7, name: 'Paint After Bending' },
  { id: 8, name: 'Paint after Fabrication' }
];

// Matches PaintingWarning from backend
export interface PaintingConfiguration {
  partId: number;
  partName: string;
  itemType: string;
  component: string;
  timing: string;
  colour: string;
}

export interface PaintingResolution {
  partId: number;
  itemType: string;
  itemTypeKey: string;
  component: string;
  componentKey: string;
  timing: string;
  timingKey: string;
  colour: string;
  taskNames: string[];
  saveComponent: boolean;  // Add component to specification_options
  saveToMatrix: boolean;
}

interface PaintingConfigurationModalProps {
  paintingConfigurations: PaintingConfiguration[];
  onResolve: (resolutions: PaintingResolution[]) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

/**
 * Convert display name to URL-friendly key
 * "Front Lit" -> "front-lit"
 * "Return & Trim" -> "return-trim"
 */
function toKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/\s*&\s*/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export const PaintingConfigurationModal: React.FC<PaintingConfigurationModalProps> = ({
  paintingConfigurations,
  onResolve,
  onClose,
  saving = false
}) => {
  // Track resolutions for each painting configuration
  // saveComponentManual tracks if user manually checked "Add component" (vs auto-checked from "Remember")
  const [resolutions, setResolutions] = useState<Map<string, {
    tasks: string[];
    saveComponent: boolean;
    saveComponentManual: boolean;
    saveToMatrix: boolean;
  }>>(
    () => new Map(paintingConfigurations.map(config => [
      `${config.partId}-${config.component}-${config.timing}`,
      { tasks: [], saveComponent: false, saveComponentManual: false, saveToMatrix: false }
    ]))
  );

  // Track existing painting components for "new component" detection
  const [existingComponents, setExistingComponents] = useState<string[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(true);

  // Load existing painting components on mount
  useEffect(() => {
    const loadComponents = async () => {
      try {
        const components = await SpecificationOptionsCache.getOptionsForCategory('painting_components');
        setExistingComponents(components);
      } finally {
        setLoadingComponents(false);
      }
    };
    loadComponents();
  }, []);

  // Helper to check if component is new (not in system)
  const isComponentNew = (component: string): boolean => {
    return !existingComponents.some(
      existing => existing.toLowerCase() === component.toLowerCase()
    );
  };

  // Current configuration being edited (for multi-step flow)
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentConfig = paintingConfigurations[currentIndex];
  const currentKey = `${currentConfig.partId}-${currentConfig.component}-${currentConfig.timing}`;
  const currentResolution = resolutions.get(currentKey) || { tasks: [], saveComponent: false, saveComponentManual: false, saveToMatrix: false };

  const toggleTask = (taskName: string) => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentKey) || { tasks: [], saveComponent: false, saveComponentManual: false, saveToMatrix: false };

      if (taskName === 'NO_TASK') {
        if (current.tasks.includes('NO_TASK')) {
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

  const toggleSaveComponent = () => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentKey) || { tasks: [], saveComponent: false, saveComponentManual: false, saveToMatrix: false };

      // If saveToMatrix is on, saveComponent is locked - can't toggle
      if (current.saveToMatrix) {
        return prev;
      }

      const newSaveComponent = !current.saveComponent;
      newMap.set(currentKey, {
        ...current,
        saveComponent: newSaveComponent,
        saveComponentManual: newSaveComponent  // Track that user manually set this
      });
      return newMap;
    });
  };

  const toggleSaveToMatrix = () => {
    setResolutions(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(currentKey) || { tasks: [], saveComponent: false, saveComponentManual: false, saveToMatrix: false };

      const newSaveToMatrix = !current.saveToMatrix;

      if (newSaveToMatrix) {
        // Enabling "Remember for future" - auto-enable saveComponent if component is new
        const shouldAutoSave = isComponentNew(currentConfig.component);
        newMap.set(currentKey, {
          ...current,
          saveToMatrix: true,
          saveComponent: shouldAutoSave ? true : current.saveComponent
        });
      } else {
        // Disabling "Remember for future"
        // Only uncheck "Add component" if it wasn't manually set before
        newMap.set(currentKey, {
          ...current,
          saveToMatrix: false,
          saveComponent: current.saveComponentManual ? current.saveComponent : false
        });
      }
      return newMap;
    });
  };

  const handleSubmit = async () => {
    const resolvedConfigs: PaintingResolution[] = paintingConfigurations.map(config => {
      const key = `${config.partId}-${config.component}-${config.timing}`;
      const resolution = resolutions.get(key) || { tasks: [], saveComponent: false, saveComponentManual: false, saveToMatrix: false };
      // Filter out NO_TASK - it's just a UI marker, not a real task
      const realTasks = resolution.tasks.filter(t => t !== 'NO_TASK');
      return {
        partId: config.partId,
        itemType: config.itemType,
        itemTypeKey: toKey(config.itemType),
        component: config.component,
        componentKey: toKey(config.component),
        timing: config.timing,
        timingKey: toKey(config.timing),
        colour: config.colour,
        taskNames: realTasks,
        saveComponent: resolution.saveComponent,
        saveToMatrix: resolution.saveToMatrix
      };
    });

    await onResolve(resolvedConfigs);
  };

  const canGoNext = currentIndex < paintingConfigurations.length - 1;
  const canGoPrev = currentIndex > 0;
  const isLastConfig = currentIndex === paintingConfigurations.length - 1;

  // Count how many have at least one task selected (including NO_TASK as a valid choice)
  const resolvedCount = Array.from(resolutions.values()).filter(r => r.tasks.length > 0).length;
  const allResolved = resolvedCount === paintingConfigurations.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-orange-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Paintbrush className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Configure Painting Tasks</h3>
                <p className="text-sm text-gray-600">
                  {paintingConfigurations.length > 1
                    ? `${currentIndex + 1} of ${paintingConfigurations.length} configurations`
                    : 'Select tasks to generate'
                  }
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Configuration Info */}
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Part:</span>
                <span className="ml-2 font-medium text-gray-900">{currentConfig.partName}</span>
              </div>
              <div>
                <span className="text-gray-500">Product:</span>
                <span className="ml-2 font-medium text-gray-900">{currentConfig.itemType}</span>
              </div>
              <div>
                <span className="text-gray-500">Component:</span>
                <span className="ml-2 font-semibold text-orange-700">{currentConfig.component}</span>
              </div>
              <div>
                <span className="text-gray-500">Timing:</span>
                <span className="ml-2 font-semibold text-orange-700">{currentConfig.timing}</span>
              </div>
              {currentConfig.colour && currentConfig.colour !== 'N/A' && (
                <div className="col-span-2">
                  <span className="text-gray-500">Colour:</span>
                  <span className="ml-2 font-medium text-gray-900">{currentConfig.colour}</span>
                </div>
              )}
            </div>
          </div>

          {/* Task Selection */}
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-3">Select painting tasks to generate:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
              {PAINTING_TASKS.map(task => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.name)}
                  disabled={currentResolution.tasks.includes('NO_TASK')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                    currentResolution.tasks.includes(task.name)
                      ? 'border-orange-500 bg-orange-50'
                      : currentResolution.tasks.includes('NO_TASK')
                        ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-xs font-bold flex items-center justify-center text-gray-600">
                      {task.id}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{task.name}</span>
                  </div>
                  {currentResolution.tasks.includes(task.name) && (
                    <Check className="w-5 h-5 text-orange-600" />
                  )}
                </button>
              ))}
            </div>

            {/* Save Options */}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              {/* Add Component Option - Only show if component is NEW */}
              {!loadingComponents && isComponentNew(currentConfig.component) && (
                <button
                  onClick={toggleSaveComponent}
                  disabled={currentResolution.saveToMatrix}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                    currentResolution.saveComponent
                      ? currentResolution.saveToMatrix
                        ? 'border-orange-300 bg-orange-50 cursor-not-allowed'
                        : 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    currentResolution.saveComponent
                      ? currentResolution.saveToMatrix
                        ? 'border-orange-300 bg-orange-300'
                        : 'border-orange-500 bg-orange-500'
                      : 'border-gray-300'
                  }`}>
                    {currentResolution.saveComponent && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 text-left">
                    <span className={`text-sm font-medium ${currentResolution.saveToMatrix ? 'text-gray-500' : 'text-gray-900'}`}>
                      Add component to system
                      {currentResolution.saveToMatrix && <span className="text-xs ml-1">(required)</span>}
                    </span>
                    <p className="text-xs text-gray-500">Add "{currentConfig.component}" to dropdown options</p>
                  </div>
                </button>
              )}

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
                          <div className="font-medium text-gray-700">
                            {currentConfig.itemType} + {currentConfig.component} + {currentConfig.timing}:
                          </div>
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
              {paintingConfigurations.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentIndex(i => i - 1)}
                    disabled={!canGoPrev}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-500">
                    {resolvedCount}/{paintingConfigurations.length} resolved
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
              {isLastConfig || paintingConfigurations.length === 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !allResolved}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? 'Creating Tasks...' : 'Create Tasks'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex(i => i + 1)}
                  disabled={currentResolution.tasks.length === 0}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
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

export default PaintingConfigurationModal;
