/**
 * Feedback Page
 * Standalone page for viewing and managing feedback requests
 *
 * Created: 2026-01-16
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FeedbackManager } from '../settings/FeedbackManager';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import '../jobEstimation/JobEstimation.css';

export const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header */}
      <header className={`${PAGE_STYLES.panel.background} shadow-lg border-b-4 border-indigo-500`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className={`p-2 rounded-lg ${PAGE_STYLES.interactive.hover} ${PAGE_STYLES.panel.text}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${MODULE_COLORS.feedback.base} rounded-lg flex items-center justify-center`}>
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${PAGE_STYLES.panel.text}`}>Feedback Manager</h1>
                <p className={`text-sm ${PAGE_STYLES.panel.textSecondary}`}>View and manage feedback submissions</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className={`${PAGE_STYLES.composites.panelContainer} p-6`}>
          <FeedbackManager />
        </div>
      </main>
    </div>
  );
};

export default FeedbackPage;
