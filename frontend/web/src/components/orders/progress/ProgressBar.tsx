import React from 'react';

interface Props {
  completed: number;
  total: number;
  percent: number;
}

export const ProgressBar: React.FC<Props> = ({ completed, total, percent }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700">
          Overall Progress
        </div>
        <div className="text-sm text-gray-600">
          {completed} of {total} tasks completed
        </div>
      </div>
      <div className="relative">
        <div className="overflow-hidden h-4 text-xs flex rounded-full bg-gray-200">
          <div
            style={{ width: `${percent}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-gray-700">
            {percent}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
