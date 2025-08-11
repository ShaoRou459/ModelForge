import { Suspense } from 'react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AppShell from './Shell';
import { AnimatedPage, LoadingPulse } from '../components/animations';
import { useTheme } from '../hooks/useTheme';
import ProvidersPage from '../features/providers/ProvidersPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import RunsPage from '../features/runs/RunsPage';
import ProblemSetsPage from '../features/problems/ProblemSetsPage';
import ReviewPage from '../features/review/ReviewPage';
import ManualReviewPage from '../features/review/ManualReviewPage';
import LeaderboardPage from '../features/leaderboard/LeaderboardPage';
import SettingsPage from '../features/settings/SettingsPage';

export default function App() {
  const location = useLocation();
  useTheme(); // Apply theme settings

  return (
    <AppShell>
      <Suspense fallback={
        <div className="p-6 flex items-center gap-3">
          <LoadingPulse className="text-textDim">Loading…</LoadingPulse>
        </div>
      }>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <AnimatedPage>
                <DashboardPage />
              </AnimatedPage>
            } />
            <Route path="/runs" element={
              <AnimatedPage>
                <RunsPage />
              </AnimatedPage>
            } />
            <Route path="/problem-sets" element={
              <AnimatedPage>
                <ProblemSetsPage />
              </AnimatedPage>
            } />
            <Route path="/providers" element={
              <AnimatedPage>
                <ProvidersPage />
              </AnimatedPage>
            } />
            <Route path="/review" element={
              <AnimatedPage>
                <ReviewPage />
              </AnimatedPage>
            } />
            <Route path="/manual-review" element={
              <AnimatedPage>
                <ManualReviewPage />
              </AnimatedPage>
            } />
            <Route path="/leaderboard" element={
              <AnimatedPage>
                <LeaderboardPage />
              </AnimatedPage>
            } />
            <Route path="/settings" element={
              <AnimatedPage>
                <SettingsPage />
              </AnimatedPage>
            } />
            <Route path="*" element={
              <AnimatedPage>
                <div className="p-6">Not found</div>
              </AnimatedPage>
            } />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </AppShell>
  );
}


