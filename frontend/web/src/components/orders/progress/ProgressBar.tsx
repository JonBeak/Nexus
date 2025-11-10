import React from 'react';

interface Props {
  completed: number;
  total: number;
  percent: number;
}

export const ProgressBar: React.FC<Props> = ({ completed, total, percent }) => {
  return (
    <div>
      <div className="relative">
        <div className="overflow-hidden h-6 text-xs flex rounded-full bg-gray-200">
          <div
            style={{ width: `${percent}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-700">
            {percent}% ({completed}/{total} tasks)
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
