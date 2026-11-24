import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AppState,
  DashboardFilters,
  DashboardWidgetConfig,
  DashboardWidgetId,
  NavRoute,
  PlannerTask,
  StudySession,
  TopicStatus,
} from '../types/study';
import { getTodayISO } from '../data/demoData';
import {
  addDaysISO,
  calculateExamReadiness,
  calculateStudyStreak,
  computeExamCountdown,
  getRevisionQueueSummary,
  sortExamsByNearest,
} from '../utils/studyMath';

interface DashboardViewProps {
  state: AppState;
  onNavigate: (route: NavRoute) => void;
  onUpdateWidgets: (widgets: DashboardWidgetConfig[]) => void;
  onUpdateFilters: (patch: Partial<DashboardFilters>) => void;
  onResetDashboard: () => void;
  onUpdateTask: (id: string, patch: Partial<PlannerTask>) => void;
  onLogSession: (session: Omit<StudySession, 'id'>) => void;
  onLoadDemo: () => void;
}

const TOPIC_STATUSES: TopicStatus[] = [
  'Not Started',
  'Learning',
  'Completed',
  'Revision Due',
  'Weak Area',
  'Mastered',
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigate,
  onUpdateWidgets,
  onUpdateFilters,
  onResetDashboard,
  onUpdateTask,
  onLogSession,
  onLoadDemo,
}) => {
  const [customizing, setCustomizing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [quickSessionOpen, setQuickSessionOpen] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [sessionTopicId, setSessionTopicId] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = getTodayISO();
  const { filters, widgets } = state.dashboardConfig;

  const revisionSummary = useMemo(
    () => getRevisionQueueSummary(state.topics, today),
    [state.topics, today]
  );

  const sortedExams = useMemo(
    () => sortExamsByNearest(state.exams, nowMs),
    [state.exams, nowMs]
  );

  const filteredTopics = useMemo(() => {
    return state.topics.filter((t) => {
      if (filters.subjectId !== 'all' && t.subjectId !== filters.subjectId) return false;
      if (filters.examId !== 'all' && !t.examIds.includes(filters.examId)) return false;
      if (filters.topicStatus !== 'all' && t.status !== filters.topicStatus) return false;
      return true;
    });
  }, [state.topics, filters]);

  const timeRangeStart = useMemo(() => {
    if (filters.timeRange === '7d') return addDaysISO(today, -6);
    if (filters.timeRange === '30d') return addDaysISO(today, -29);
    if (filters.timeRange === '90d') return addDaysISO(today, -89);
    return '1970-01-01';
  }, [filters.timeRange, today]);

  const filteredSessions = useMemo(() => {
    return state.sessions.filter((s) => {
      if (s.date < timeRangeStart) return false;
      if (filters.subjectId !== 'all' && s.subjectId !== filters.subjectId) return false;
      if (filters.examId !== 'all' && s.examId && s.examId !== filters.examId) return false;
      return true;
    });
  }, [state.sessions, timeRangeStart, filters]);

  const filteredMocks = useMemo(() => {
    return state.mockTests.filter((m) => {
      if (filters.examId !== 'all' && m.config.examId !== filters.examId && m.config.examId !== 'all') {
        return false;
      }
      if (
        filters.subjectId !== 'all' &&
        m.config.subjectIds.length > 0 &&
        !m.config.subjectIds.includes(filters.subjectId)
      ) {
        return false;
      }
      return true;
    });
  }, [state.mockTests, filters]);

  const streak = useMemo(() => calculateStudyStreak(state.sessions, today), [state.sessions, today]);

  const overallCompletionPct = useMemo(() => {
    if (filteredTopics.length === 0) return 0;
    const done = filteredTopics.filter((t) => t.status === 'Completed' || t.status === 'Mastered').length;
    return Math.round((done / filteredTopics.length) * 100);
  }, [filteredTopics]);

  const overallMasteryPct = useMemo(() => {
    if (filteredTopics.length === 0) return 0;
    const sum = filteredTopics.reduce((acc, t) => acc + t.masteryScore, 0);
    return Math.round(sum / filteredTopics.length);
  }, [filteredTopics]);

  const totalStudyMinutes = useMemo(
    () => filteredSessions.reduce((acc, s) => acc + s.durationMinutes, 0),
    [filteredSessions]
  );

  const weeklyStudyHours = useMemo(() => {
    const weekStart = addDaysISO(today, -6);
    const mins = state.sessions
      .filter((s) => s.date >= weekStart)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
    return Number((mins / 60).toFixed(1));
  }, [state.sessions, today]);

  const activityBars = useMemo(() => {
    const dayCount = filters.timeRange === '7d' ? 7 : 14;
    const days: Array<{ date: string; label: string; minutes: number }> = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = addDaysISO(today, -i);
      const mins = filteredSessions
        .filter((s) => s.date === d)
        .reduce((acc, s) => acc + s.durationMinutes, 0);
      days.push({
        date: d,
        label: d.slice(5),
        minutes: mins,
      });
    }
    return days;
  }, [filteredSessions, filters.timeRange, today]);

  const filteredRevisionSummary = useMemo(
    () => getRevisionQueueSummary(filteredTopics, today),
    [filteredTopics, today]
  );

  const revisionQueue = useMemo(
    () => filteredRevisionSummary.allDueTopics.slice(0, 5),
    [filteredRevisionSummary]
  );

  const weakTopics = useMemo(() => {
    return filteredTopics
      .filter((t) => t.status === 'Weak Area' || (t.masteryScore > 0 && t.masteryScore < 55))
      .sort((a, b) => a.masteryScore - b.masteryScore)
      .slice(0, 5);
  }, [filteredTopics]);

  const todaysAgenda = useMemo(() => {
    return state.tasks.filter((t) => {
      if (t.date !== today) return false;
      if (filters.subjectId !== 'all' && t.subjectId !== filters.subjectId) return false;
      if (filters.examId !== 'all' && t.examId && t.examId !== filters.examId) return false;
      return true;
    });
  }, [state.tasks, today, filters]);

  const sortedWidgets = useMemo(
    () => widgets.slice().sort((a, b) => a.order - b.order),
    [widgets]
  );

  const moveWidget = (id: DashboardWidgetId, dir: 'up' | 'down') => {
    const idx = sortedWidgets.findIndex((w) => w.id === id);
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= sortedWidgets.length) return;
    const next = sortedWidgets.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onUpdateWidgets(next.map((w, i) => ({ ...w, order: i + 1 })));
  };

  const toggleWidgetVisible = (id: DashboardWidgetId) => {
    onUpdateWidgets(
      widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const toggleWidgetSpan = (id: DashboardWidgetId) => {
    onUpdateWidgets(
      widgets.map((w) => (w.id === id ? { ...w, span: w.span === 2 ? 1 : 2 } : w))
    );
  };

  const handleSavePrefs = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleQuickLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const topic = state.topics.find((t) => t.id === sessionTopicId);
    onLogSession({
      topicId: topic?.id,
      subjectId: topic?.subjectId ?? state.subjects[0]?.id,
      examId: topic?.examIds[0] ?? state.exams[0]?.id,
      date: today,
      durationMinutes: Math.max(5, Number(sessionMinutes) || 30),
      activityType: 'Study',
      notes: sessionNotes.trim() || 'Logged from Dashboard quick session.',
    });
    setSessionNotes('');
    setQuickSessionOpen(false);
  };

  // Meaningful Empty State when user has zero subjects & topics
  if (state.topics.length === 0 && state.subjects.length === 0 && state.exams.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 sm:p-12 text-center max-w-2xl mx-auto mt-8 space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/15 text-[#7C3AED] flex items-center justify-center mx-auto">
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Your command centre is ready for your syllabus
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          No study subjects, exams, or recorded sessions exist yet. Study Buddy never fabricates progress—import a syllabus, add an exam target, or load the clearly labeled Sample Demo dataset.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('syllabus')}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
          >
            Import or Create Syllabus
          </button>
          <button
            type="button"
            onClick={onLoadDemo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10"
          >
            <Sparkles className="w-4 h-4" />
            Load Sample Demo Data
          </button>
        </div>
      </div>
    );
  }

  const renderWidget = (w: DashboardWidgetConfig) => {
    switch (w.id) {
      case 'overall_completion':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Syllabus Completed</p>
                <p className="font-mono text-3xl font-bold text-slate-900 dark:text-white mt-1">
                  {overallCompletionPct}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  {filteredTopics.filter((t) => t.status === 'Completed' || t.status === 'Mastered').length}/
                  {filteredTopics.length} topics
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Verified Mastery</p>
                <p className="font-mono text-3xl font-bold text-[#06B6D4] mt-1">
                  {overallMasteryPct}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Practice & recall weighted
                </p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-[#17172F] overflow-hidden flex">
              <div
                className="bg-[#7C3AED] transition-all"
                style={{ width: `${overallCompletionPct}%` }}
              />
            </div>
          </div>
        );

      case 'exam_countdowns':
        return (
          <div className="space-y-3">
            {state.exams.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No examination targets added yet.</p>
            ) : (
              state.exams.map((exam) => {
                const diffDays = Math.ceil(
                  (new Date(`${exam.examDate}T00:00:00Z`).getTime() -
                    new Date(`${today}T00:00:00Z`).getTime()) /
                    86400000
                );
                const readiness = calculateExamReadiness(state.topics, exam.id, state.mockTests);
                return (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-[#2A2A50]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {exam.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {exam.examDate} · Target {exam.targetScore}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-[#F97316]">
                        {diffDays >= 0 ? `${diffDays}d left` : 'Past'}
                      </p>
                      <p className="font-mono text-xs text-[#22C55E]">Readiness {readiness}%</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'study_hours_activity': {
        const maxMin = Math.max(60, ...activityBars.map((b) => b.minutes));
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Logged Hours</p>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                    {(totalStudyMinutes / 60).toFixed(1)}h
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Active Streak</p>
                  <p className="font-mono text-2xl font-bold text-[#22C55E]">{streak} days</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sessions</p>
                  <p className="font-mono text-2xl font-bold text-[#06B6D4]">
                    {filteredSessions.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickSessionOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Session
              </button>
            </div>

            {quickSessionOpen && (
              <form
                onSubmit={handleQuickLogSubmit}
                className="p-3 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] grid grid-cols-1 sm:grid-cols-4 gap-2"
              >
                <select
                  value={sessionTopicId}
                  onChange={(e) => setSessionTopicId(e.target.value)}
                  aria-label="Select topic for session"
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs"
                >
                  <option value="">General Study</option>
                  {state.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  aria-label="Session duration in minutes"
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs font-mono"
                />
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Session focus notes"
                  aria-label="Session notes"
                  className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#22C55E] text-white hover:bg-[#16A34A]"
                >
                  Save Log
                </button>
              </form>
            )}

            <div className="h-32 flex items-end gap-1.5 pt-2">
              {activityBars.map((bar) => {
                const heightPct = Math.round((bar.minutes / maxMin) * 100);
                return (
                  <div key={bar.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full h-24 flex items-end justify-center">
                      <div
                        title={`${bar.date}: ${bar.minutes} mins`}
                        className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-[#7C3AED] to-[#06B6D4] transition-all"
                        style={{ height: `${Math.max(bar.minutes > 0 ? 10 : 4, heightPct)}%`, opacity: bar.minutes > 0 ? 1 : 0.2 }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'subject_completion':
        return (
          <div className="space-y-3">
            {state.subjects.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No subjects configured yet.</p>
            ) : (
              state.subjects.map((subj) => {
                const subjTopics = filteredTopics.filter((t) => t.subjectId === subj.id);
                const done = subjTopics.filter(
                  (t) => t.status === 'Completed' || t.status === 'Mastered'
                ).length;
                const pct = subjTopics.length > 0 ? Math.round((done / subjTopics.length) * 100) : 0;
                const avgMastery =
                  subjTopics.length > 0
                    ? Math.round(subjTopics.reduce((a, b) => a + b.masteryScore, 0) / subjTopics.length)
                    : 0;
                return (
                  <div key={subj.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {subj.name}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {pct}% done · {avgMastery}% mastery
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-[#17172F] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: subj.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'todays_agenda':
        return (
          <div className="space-y-2.5">
            {todaysAgenda.length === 0 ? (
              <div className="py-4 text-center space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No tasks scheduled for today ({today}).
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('planner')}
                  className="text-xs font-semibold text-[#7C3AED] hover:underline"
                >
                  Open Planner to schedule
                </button>
              </div>
            ) : (
              todaysAgenda.map((task) => {
                const isDone = task.status === 'Done';
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-[#2A2A50]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTask(task.id, { status: isDone ? 'Pending' : 'Done' })
                      }
                      aria-label={`Toggle task ${task.title}`}
                      className="flex items-center gap-2.5 min-w-0 text-left"
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          isDone
                            ? 'bg-[#22C55E] border-[#22C55E] text-white'
                            : 'border-slate-300 dark:border-[#3E3E70]'
                        }`}
                      >
                        {isDone && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={`text-sm truncate ${
                          isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">
                      {task.startTime} · {task.durationMinutes}m
                    </span>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'revision_queue':
        return (
          <div className="space-y-2.5">
            {revisionQueue.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No revisions due today. Great pacing!
              </p>
            ) : (
              revisionQueue.map((t) => {
                const overdue = t.nextRevisionAt && t.nextRevisionAt < today;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 border-slate-100 dark:border-[#2A2A50]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {t.name}
                      </p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        {overdue ? 'Overdue' : 'Due today'} · Mastery {t.masteryScore}%
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('revision')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EC4899]/15 text-[#EC4899] hover:bg-[#EC4899]/25 shrink-0"
                    >
                      Revise
                    </button>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'weak_topics':
        return (
          <div className="space-y-2.5">
            {weakTopics.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No weak areas flagged yet. Practice & mock results will surface gaps automatically.
              </p>
            ) : (
              weakTopics.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 border-slate-100 dark:border-[#2A2A50]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {t.name}
                    </p>
                    <p className="text-xs text-[#EF4444]">
                      {t.status} · Priority {t.priority}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-[#EF4444] shrink-0">
                    {t.masteryScore}%
                  </span>
                </div>
              ))
            )}
          </div>
        );

      case 'test_accuracy': {
        const latest = filteredMocks[filteredMocks.length - 1];
        const avgAccuracy =
          filteredMocks.length > 0
            ? Math.round(
                filteredMocks.reduce((acc, m) => acc + m.accuracy, 0) / filteredMocks.length
              )
            : null;
        return (
          <div className="space-y-3">
            {filteredMocks.length === 0 ? (
              <div className="py-3 space-y-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No mock tests attempted yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('mock-tests')}
                  className="text-xs font-semibold text-[#7C3AED] hover:underline"
                >
                  Configure first timed mock test
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Latest Score</p>
                    <p className="font-mono text-2xl font-bold text-[#7C3AED]">
                      {latest.percentage}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mean Accuracy</p>
                    <p className="font-mono text-2xl font-bold text-[#22C55E]">{avgAccuracy}%</p>
                  </div>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-[#2A2A50]">
                  {filteredMocks.slice(-3).map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <span className="truncate text-slate-700 dark:text-slate-300">{m.title}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {m.score}/{m.maxScore} ({m.accuracy}% acc)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      }

      case 'goals_readiness': {
        const goalPct =
          state.profile.weeklyHoursTarget > 0
            ? Math.min(100, Math.round((weeklyStudyHours / state.profile.weeklyHoursTarget) * 100))
            : 0;
        const readiness = calculateExamReadiness(
          state.topics,
          filters.examId,
          state.mockTests
        );
        return (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600 dark:text-slate-300">Weekly Study Goal</span>
                <span className="font-mono font-semibold">
                  {weeklyStudyHours}h / {state.profile.weeklyHoursTarget}h ({goalPct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-[#17172F] overflow-hidden">
                <div className="h-full bg-[#FACC15]" style={{ width: `${goalPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600 dark:text-slate-300">Exam Readiness Index</span>
                <span className="font-mono font-semibold text-[#22C55E]">{readiness}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-[#17172F] overflow-hidden">
                <div className="h-full bg-[#22C55E]" style={{ width: `${readiness}%` }} />
              </div>
            </div>
          </div>
        );
      }

      case 'recent_activity':
        return (
          <div className="space-y-2.5">
            {filteredSessions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No recorded study activity in this range.
              </p>
            ) : (
              filteredSessions.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-2 py-1.5 border-b last:border-b-0 border-slate-100 dark:border-[#2A2A50]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {s.activityType} · {s.notes}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {s.date}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#06B6D4] shrink-0">
                    {s.durationMinutes}m
                  </span>
                </div>
              ))
            )}
          </div>
        );

      case 'quick_actions':
        return (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('syllabus')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] hover:border-[#7C3AED] text-xs font-semibold text-left"
            >
              <BookOpen className="w-4 h-4 text-[#7C3AED] shrink-0" />
              <span>Import Syllabus</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('mock-tests')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] hover:border-[#06B6D4] text-xs font-semibold text-left"
            >
              <ClipboardCheck className="w-4 h-4 text-[#06B6D4] shrink-0" />
              <span>Start Mock Test</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('planner')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] hover:border-[#F97316] text-xs font-semibold text-left"
            >
              <Calendar className="w-4 h-4 text-[#F97316] shrink-0" />
              <span>Plan Week</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai-assistant')}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] hover:border-[#22C55E] text-xs font-semibold text-left"
            >
              <Clock className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span>Ask AI Tutor</span>
            </button>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Filter & Customization Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filters.examId}
            onChange={(e) => onUpdateFilters({ examId: e.target.value })}
            aria-label="Filter dashboard by exam"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-medium"
          >
            <option value="all">All Exams</option>
            {state.exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          <select
            value={filters.subjectId}
            onChange={(e) => onUpdateFilters({ subjectId: e.target.value })}
            aria-label="Filter dashboard by subject"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-medium"
          >
            <option value="all">All Subjects</option>
            {state.subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          <select
            value={filters.topicStatus}
            onChange={(e) =>
              onUpdateFilters({ topicStatus: e.target.value as DashboardFilters['topicStatus'] })
            }
            aria-label="Filter dashboard by topic status"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-medium"
          >
            <option value="all">All Topic Statuses</option>
            {TOPIC_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-md p-0.5">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => {
              const active = filters.timeRange === range;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => onUpdateFilters({ timeRange: range })}
                  className={`relative px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 whitespace-nowrap ${
                    active
                      ? 'text-white'
                      : 'text-slate-800 dark:text-slate-100 hover:bg-white/24 dark:hover:bg-white/10'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="dashboard-range-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                    />
                  )}
                  <span className="relative z-10">{range === 'all' ? 'All Time' : range.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {revisionSummary.dueTotalCount > 0 && (
            <button
              type="button"
              data-testid="dashboard-revision-reminder-badge"
              onClick={() => onNavigate('revision')}
              title={`${revisionSummary.overdueCount} overdue · ${revisionSummary.dueTodayCount} due today`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-[#EF4444]/35 bg-[#EF4444]/12 dark:bg-[#EF4444]/18 text-[#DC2626] dark:text-[#FCA5A5] hover:bg-[#EF4444]/22 transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span>Revision Reminders</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#EF4444] text-white font-mono text-[11px] font-bold tabular-nums">
                {revisionSummary.dueTotalCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
              customizing
                ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                : 'border-slate-200 dark:border-[#2E2E58] hover:border-[#7C3AED]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Customize Dashboard
          </button>
        </div>
      </div>

      {/* Widget Customization Drawer */}
      {customizing && (
        <div className="p-5 rounded-2xl border border-[#7C3AED]/40 bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Configure Modular Widgets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Show, hide, reorder, or resize dashboard widgets. Preferences are saved locally.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedNotice && (
                <span className="text-xs font-semibold text-[#22C55E]">Preferences saved</span>
              )}
              <button
                type="button"
                onClick={handleSavePrefs}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#22C55E] text-white hover:bg-[#16A34A]"
              >
                Save Preferences
              </button>
              <button
                type="button"
                onClick={onResetDashboard}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#2E2E58] hover:bg-slate-100 dark:hover:bg-[#232347]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Default
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {sortedWidgets.map((w, idx) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F]"
              >
                <span className="text-xs font-medium truncate">{w.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveWidget(w.id, 'up')}
                    disabled={idx === 0}
                    aria-label={`Move ${w.title} up`}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#2A2A50] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidget(w.id, 'down')}
                    disabled={idx === sortedWidgets.length - 1}
                    aria-label={`Move ${w.title} down`}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#2A2A50] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWidgetSpan(w.id)}
                    aria-label={`Resize ${w.title}`}
                    title={w.span === 2 ? 'Switch to 1-column' : 'Expand to 2-column'}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-[#2A2A50]"
                  >
                    {w.span === 2 ? (
                      <Minimize2 className="w-3.5 h-3.5 text-[#06B6D4]" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWidgetVisible(w.id)}
                    aria-label={w.visible ? `Hide ${w.title}` : `Show ${w.title}`}
                    className={`p-1 rounded ${
                      w.visible ? 'text-[#22C55E]' : 'text-slate-400'
                    }`}
                  >
                    {w.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dedicated Exam Countdown Cards Row */}
      <section aria-label="Exam Countdown Cards" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
              Exam Countdowns
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Individual timelines for every target exam from your Study Buddy setup
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('my-study')}
            className="text-xs font-semibold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline whitespace-nowrap"
          >
            Manage Exams
          </button>
        </div>

        {sortedExams.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No exams configured yet. Add your exam target dates to track live countdowns here.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('my-study')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9] whitespace-nowrap"
            >
              Add Exam Target
            </button>
          </div>
        ) : (
          <div
            data-testid="exam-countdown-cards-row"
            className={`grid grid-cols-1 gap-4 ${
              sortedExams.length === 1
                ? 'md:grid-cols-1 max-w-2xl'
                : sortedExams.length === 2
                  ? 'md:grid-cols-2'
                  : 'md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {sortedExams.map((exam) => {
              const metrics = computeExamCountdown(exam, nowMs);
              const readiness = calculateExamReadiness(state.topics, exam.id, state.mockTests);
              const examTopics = state.topics.filter((t) => t.examIds.includes(exam.id));
              const doneExamTopics = examTopics.filter(
                (t) => t.status === 'Completed' || t.status === 'Mastered'
              ).length;
              const isSelectedFilter = filters.examId === exam.id;

              const statusColorClass =
                metrics.status === 'urgent'
                  ? 'text-[#D97706] dark:text-[#FBBF24]'
                  : metrics.status === 'today'
                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                    : metrics.status === 'passed'
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-[#7C3AED] dark:text-[#C4B5FD]';

              const progressFillClass =
                metrics.status === 'urgent'
                  ? 'from-[#F59E0B] to-[#F97316]'
                  : metrics.status === 'today' || metrics.status === 'passed'
                    ? 'from-[#10B981] to-[#22C55E]'
                    : 'from-[#7C3AED] to-[#06B6D4]';

              return (
                <article
                  key={exam.id}
                  data-testid={`exam-countdown-card-${exam.id}`}
                  className={`rounded-2xl border bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isSelectedFilter
                      ? 'border-[#7C3AED] ring-1 ring-[#7C3AED]/40'
                      : 'border-slate-200 dark:border-[#2A2A50]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: exam.color || '#7C3AED' }}
                        />
                        <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                          {exam.name}
                        </h3>
                      </div>
                      <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                        {exam.examDate} · Target {exam.targetScore}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`font-mono text-xl font-bold tabular-nums ${statusColorClass}`}>
                        {metrics.remainingLabel}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        Attempt {exam.attemptYear}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      <span>Prep window {metrics.elapsedPercent}% elapsed</span>
                      <span>
                        Readiness <strong className="text-[#16A34A] dark:text-[#4ADE80]">{readiness}%</strong>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${exam.name} preparation window`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={metrics.elapsedPercent}
                      className="h-2 rounded-full bg-slate-200/80 dark:bg-[#13132B] overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${progressFillClass} transition-all duration-300`}
                        style={{ width: `${Math.max(4, metrics.elapsedPercent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-[#2A2A50] text-xs">
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {doneExamTopics}/{examTopics.length} topics done
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateFilters({ examId: isSelectedFilter ? 'all' : exam.id })
                      }
                      className={`font-semibold transition-colors ${
                        isSelectedFilter
                          ? 'text-[#7C3AED] dark:text-[#C4B5FD]'
                          : 'text-slate-700 dark:text-slate-200 hover:text-[#7C3AED]'
                      }`}
                    >
                      {isSelectedFilter ? 'Showing Filtered' : 'Focus Dashboard'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Modular Bento Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 grid-flow-dense gap-5">
        {sortedWidgets
          .filter((w) => w.visible)
          .map((w) => (
            <section
              key={w.id}
              data-widget-id={w.id}
              className={`rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-col justify-between ${
                w.span === 2 ? 'md:col-span-2' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                      {w.title}
                    </h2>
                    {w.id === 'revision_queue' && filteredRevisionSummary.dueTotalCount > 0 && (
                      <span
                        data-testid="widget-revision-badge"
                        className="px-2 py-0.5 rounded-md bg-[#EF4444]/15 text-[#DC2626] dark:text-[#FCA5A5] border border-[#EF4444]/30 font-mono text-[11px] font-bold tabular-nums shrink-0"
                      >
                        {filteredRevisionSummary.dueTotalCount} due
                      </span>
                    )}
                  </div>
                  {w.id === 'revision_queue' && (
                    <button
                      type="button"
                      onClick={() => onNavigate('revision')}
                      className="text-xs font-semibold text-[#7C3AED] dark:text-[#C4B5FD] hover:underline whitespace-nowrap shrink-0"
                    >
                      Open Revision
                    </button>
                  )}
                </div>
                {renderWidget(w)}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
};
