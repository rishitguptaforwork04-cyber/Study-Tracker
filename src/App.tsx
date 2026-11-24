/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import type { NavRoute } from './types/study';
import { getTodayISO } from './data/demoData';
import { getRevisionQueueSummary } from './utils/studyMath';
import { useStudyStore } from './store/useStudyStore';
import { StudyBackdrop } from './components/StudyBackdrop';
import { WelcomeView } from './components/WelcomeView';
import { ShellLayout } from './components/ShellLayout';
import { OnboardingWizard } from './components/OnboardingWizard';
import { DashboardView } from './components/DashboardView';
import { MyStudyView } from './components/MyStudyView';
import { SyllabusView } from './components/SyllabusView';
import { PlannerView } from './components/PlannerView';
import { PracticeView } from './components/PracticeView';
import { MockTestView } from './components/MockTestView';
import { RevisionView } from './components/RevisionView';
import { NotesView } from './components/NotesView';
import { AnalyticsView } from './components/AnalyticsView';
import { AiAssistantView } from './components/AiAssistantView';
import { SettingsView } from './components/SettingsView';

function isAutostartFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const store = useStudyStore();
  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [rainVisualEnabled, setRainVisualEnabled] = useState<boolean>(true);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => !isAutostartFlag());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => isAutostartFlag() && !store.state.profile.onboardingCompleted
  );

  const completedTopicsCount = store.state.topics.filter(
    (t) => t.status === 'Completed' || t.status === 'Mastered'
  ).length;
  const dueRevisionCount = getRevisionQueueSummary(
    store.state.topics,
    getTodayISO()
  ).dueTotalCount;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen">
      <StudyBackdrop
        variant={showWelcome ? 'welcome' : 'workspace'}
        theme={store.theme}
        rainVisualEnabled={rainVisualEnabled}
      />

      {showWelcome ? (
        <WelcomeView
          profile={store.state.profile}
          exams={store.state.exams}
          totalTopicsCount={store.state.topics.length}
          completedTopicsCount={completedTopicsCount}
          theme={store.theme}
          rainVisualEnabled={rainVisualEnabled}
          onToggleRainVisual={() => setRainVisualEnabled((v) => !v)}
          onToggleTheme={store.toggleTheme}
          onCompleteSetup={(payload) => {
            store.completeOnboarding(payload);
            setShowWelcome(false);
            setShowOnboarding(false);
            setActiveRoute('dashboard');
          }}
          onLoadDemo={() => {
            store.loadDemoData();
            setShowWelcome(false);
            setShowOnboarding(false);
            setActiveRoute('dashboard');
          }}
          onEnterWorkspace={() => {
            setShowWelcome(false);
            if (!store.state.profile.onboardingCompleted) {
              setShowOnboarding(true);
            } else {
              setActiveRoute('dashboard');
            }
          }}
        />
      ) : showOnboarding ? (
        <div className="relative z-10">
          <OnboardingWizard
            initialProfile={store.state.profile}
            onComplete={(payload) => {
              store.completeOnboarding(payload);
              setShowOnboarding(false);
              setActiveRoute('dashboard');
            }}
            onLoadDemo={() => {
              store.loadDemoData();
              setShowOnboarding(false);
              setActiveRoute('dashboard');
            }}
            onCancel={
              store.state.profile.onboardingCompleted
                ? () => setShowOnboarding(false)
                : () => setShowWelcome(true)
            }
          />
        </div>
      ) : (
        <ShellLayout
          activeRoute={activeRoute}
          onNavigate={setActiveRoute}
          profile={store.state.profile}
          exams={store.state.exams}
          selectedExamId={selectedExamId}
          onSelectExam={setSelectedExamId}
          onUpdateExam={store.updateExam}
          theme={store.theme}
          rainVisualEnabled={rainVisualEnabled}
          dueRevisionCount={dueRevisionCount}
          onToggleRainVisual={() => setRainVisualEnabled((v) => !v)}
          onToggleTheme={store.toggleTheme}
          onOpenOnboarding={() => setShowOnboarding(true)}
          onOpenWelcome={() => setShowWelcome(true)}
        >
          {activeRoute === 'dashboard' && (
            <DashboardView
              state={store.state}
              onNavigate={setActiveRoute}
              onUpdateWidgets={store.updateDashboardWidgets}
              onUpdateFilters={store.updateDashboardFilters}
              onResetDashboard={store.resetDashboardConfig}
              onUpdateTask={store.updateTask}
              onLogSession={store.logStudySession}
              onLoadDemo={store.loadDemoData}
            />
          )}

          {activeRoute === 'my-study' && (
            <MyStudyView
              state={store.state}
              onUpdateTopic={store.updateTopic}
              onLogSession={store.logStudySession}
              onAddExam={store.addExam}
              onDeleteExam={store.deleteExam}
            />
          )}

          {activeRoute === 'syllabus' && (
            <SyllabusView
              state={store.state}
              onCommitDraft={store.commitSyllabusDraft}
              onAddSubject={store.addSubject}
              onRenameSubject={store.renameSubject}
              onDeleteSubject={store.deleteSubject}
              onReorderSubject={store.reorderSubject}
              onMergeSubjects={store.mergeSubjects}
              onAddChapter={store.addChapter}
              onRenameChapter={store.renameChapter}
              onDeleteChapter={store.deleteChapter}
              onAddTopic={store.addTopic}
              onUpdateTopic={store.updateTopic}
              onDeleteTopic={store.deleteTopic}
              onSplitTopic={store.splitTopic}
              onMergeTopics={store.mergeTopics}
            />
          )}

          {activeRoute === 'planner' && (
            <PlannerView
              state={store.state}
              onAddTask={store.addTask}
              onAddMultipleTasks={store.addMultipleTasks}
              onUpdateTask={store.updateTask}
              onDeleteTask={store.deleteTask}
            />
          )}

          {activeRoute === 'practice' && (
            <PracticeView
              state={store.state}
              onAddQuestions={store.addQuestions}
              onToggleBookmark={store.toggleBookmarkQuestion}
              onReportIssue={store.reportQuestionIssue}
              onRecordAttempt={store.recordPracticeAttempt}
              onAddMistake={store.addMistake}
            />
          )}

          {activeRoute === 'mock-tests' && (
            <MockTestView state={store.state} onSubmitMock={store.submitMockTest} />
          )}

          {activeRoute === 'revision' && (
            <RevisionView
              state={store.state}
              onCompleteRevision={store.completeTopicRevision}
              onUpdateRevisionConfig={store.updateRevisionConfig}
              onAddFlashcard={store.addFlashcard}
              onUpdateFlashcard={store.updateFlashcard}
              onDeleteFlashcard={store.deleteFlashcard}
            />
          )}

          {activeRoute === 'notes' && (
            <NotesView
              state={store.state}
              onUpdateTopic={store.updateTopic}
              onUpdateMistake={store.updateMistake}
              onAddResource={store.addResource}
            />
          )}

          {activeRoute === 'analytics' && <AnalyticsView state={store.state} />}

          {activeRoute === 'ai-assistant' && (
            <AiAssistantView
              state={store.state}
              onAddMessages={store.addTutorMessages}
              onClearHistory={store.clearTutorHistory}
            />
          )}

          {activeRoute === 'settings' && (
            <SettingsView
              state={store.state}
              theme={store.theme}
              onToggleTheme={store.toggleTheme}
              onUpdateProfile={store.updateProfile}
              onLoadDemo={store.loadDemoData}
              onResetEmpty={() => {
                store.resetToEmpty();
                setActiveRoute('dashboard');
              }}
              onImportBackup={store.replaceFullState}
              onOpenOnboarding={() => setShowOnboarding(true)}
            />
          )}
        </ShellLayout>
      )}
      </div>
    </MotionConfig>
  );
}
