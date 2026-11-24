import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  CloudRain,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ExamTarget, NavRoute, StudyProfile } from '../types/study';
import { computeExamCountdown, sortExamsByNearest } from '../utils/studyMath';
import { AmbientAudioPanel } from './AmbientAudioPanel';
import { ExamCountdownBar } from './ExamCountdownBar';

interface ShellLayoutProps {
  activeRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  profile: StudyProfile;
  exams: ExamTarget[];
  selectedExamId: string | null;
  onSelectExam: (examId: string) => void;
  onUpdateExam: (id: string, patch: Partial<ExamTarget>) => void;
  theme: 'dark' | 'light';
  rainVisualEnabled: boolean;
  dueRevisionCount?: number;
  onToggleRainVisual: () => void;
  onToggleTheme: () => void;
  onOpenOnboarding: () => void;
  onOpenWelcome: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: NavRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'my-study', label: 'My Study', icon: GraduationCap },
  { id: 'syllabus', label: 'Syllabus', icon: BookOpen },
  { id: 'planner', label: 'Planner', icon: CalendarDays },
  { id: 'practice', label: 'Practice Centre', icon: CheckSquare },
  { id: 'mock-tests', label: 'Mock Tests', icon: ClipboardCheck },
  { id: 'revision', label: 'Revision', icon: RefreshCw },
  { id: 'notes', label: 'Notes & Resources', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ai-assistant', label: 'AI Study Assistant', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ROUTE_TITLES: Record<NavRoute, string> = {
  dashboard: 'Dashboard',
  'my-study': 'My Study & Tracker',
  syllabus: 'Syllabus Architect',
  planner: 'Study Planner & Calendar',
  practice: 'Practice Centre & Question Bank',
  'mock-tests': 'Mock Test Engine',
  revision: 'Spaced Repetition & Revision',
  notes: 'Notes, Mistakes & Resources',
  analytics: 'Performance Analytics',
  'ai-assistant': 'Study Buddy AI Tutor',
  settings: 'Settings & Backups',
};

export const ShellLayout: React.FC<ShellLayoutProps> = ({
  activeRoute,
  onNavigate,
  profile,
  exams,
  selectedExamId,
  onSelectExam,
  onUpdateExam,
  theme,
  rainVisualEnabled,
  dueRevisionCount = 0,
  onToggleRainVisual,
  onToggleTheme,
  onOpenOnboarding,
  onOpenWelcome,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [audioDrawerOpen, setAudioDrawerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeExamMetrics = useMemo(() => {
    const sorted = sortExamsByNearest(exams, nowMs);
    const active = sorted.find((e) => e.id === selectedExamId) ?? sorted[0] ?? null;
    return active ? computeExamCountdown(active, nowMs) : null;
  }, [exams, selectedExamId, nowMs]);

  const handleNav = (id: NavRoute) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white/24 dark:bg-[#101028]/28 backdrop-blur-xl border-r border-white/30 dark:border-white/12">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/25 dark:border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded min-w-0"
          >
            <span className="block font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white whitespace-nowrap leading-tight">
              Study Buddy
            </span>
            <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
              Your go-to tutor
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap text-left border backdrop-blur-md transition-colors duration-200 ${
                  active
                    ? 'border-white/35 text-white'
                    : 'bg-white/10 dark:bg-white/[0.04] border-white/18 dark:border-white/8 text-slate-900 hover:bg-white/28 dark:text-slate-100 dark:hover:bg-white/12 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-xl bg-[#7C3AED]/72 border border-white/30 shadow-[0_4px_18px_rgba(124,58,237,0.3)] backdrop-blur-md"
                  />
                )}
                <Icon className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10 truncate">{item.label}</span>
                {item.id === 'revision' && dueRevisionCount > 0 && (
                  <span
                    data-testid="revision-nav-badge"
                    aria-label={`${dueRevisionCount} revisions due`}
                    className={`relative z-10 ml-auto px-1.5 py-0.5 min-w-[22px] text-center rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
                      active
                        ? 'bg-white/25 text-white border border-white/30'
                        : 'bg-[#EF4444]/16 dark:bg-[#EF4444]/25 text-[#DC2626] dark:text-[#FCA5A5] border border-[#EF4444]/35'
                    }`}
                  >
                    {dueRevisionCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/25 dark:border-white/10 shrink-0">
        {profile.isDemoMode && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#F97316]/18 border border-[#F97316]/35 text-xs text-[#9A3412] dark:text-[#FDBA74] backdrop-blur-md">
            Sample Demo Data Active
          </div>
        )}
        <div className="flex items-center gap-3">
          {!avatarFailed ? (
            <img
              src="/src/assets/images/avatar_scholar_profile_1795465322081.jpg"
              alt={profile.studentName || 'Scholar avatar'}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-9 h-9 rounded-full object-cover border border-white/40 dark:border-white/20 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#7C3AED]/25 text-[#7C3AED] dark:text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
              {(profile.studentName || 'S').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">
              {profile.studentName || 'Scholar'}
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
              {profile.courseName || 'No course configured'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const edgeGradient =
    activeExamMetrics?.status === 'urgent'
      ? 'from-[#F59E0B] to-[#F97316]'
      : activeExamMetrics?.status === 'today' || activeExamMetrics?.status === 'passed'
        ? 'from-[#10B981] to-[#22C55E]'
        : 'from-[#7C3AED] via-[#06B6D4] to-[#10B981]';

  return (
    <div className="relative z-10 min-h-screen flex text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[82vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 bg-white/28 dark:bg-[#101028]/32 backdrop-blur-xl border-b border-white/30 dark:border-white/12">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-800 hover:bg-white/35 dark:text-slate-100 dark:hover:bg-white/12"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="hidden sm:block font-display text-base lg:text-lg font-bold text-slate-950 dark:text-white truncate max-w-[170px] xl:max-w-[260px]">
              {ROUTE_TITLES[activeRoute]}
            </h1>
          </div>

          {/* Center Persistent Exam Countdown Progress Bar */}
          <div className="flex-1 flex justify-center min-w-0 px-1">
            <ExamCountdownBar
              exams={exams}
              selectedExamId={selectedExamId}
              nowMs={nowMs}
              onSelectExam={onSelectExam}
              onUpdateExam={onUpdateExam}
              onManageExams={() => handleNav('my-study')}
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
            <button
              type="button"
              onClick={onOpenWelcome}
              aria-label="Open Study Room"
              title="Study Room"
              className="p-2 rounded-lg border border-white/30 dark:border-white/15 bg-white/18 dark:bg-white/[0.06] text-slate-800 hover:text-slate-950 dark:text-slate-100 dark:hover:text-white hover:bg-white/35 dark:hover:bg-white/14 backdrop-blur-md transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleRainVisual}
              aria-label="Toggle rain animation"
              title={rainVisualEnabled ? 'Pause rain visual' : 'Show rain visual'}
              className={`hidden sm:inline-flex p-2 rounded-lg border backdrop-blur-md transition-colors ${
                rainVisualEnabled
                  ? 'border-[#06B6D4]/45 bg-[#06B6D4]/18 text-[#0369A1] dark:text-[#67E8F9]'
                  : 'border-white/30 dark:border-white/15 bg-white/18 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200'
              }`}
            >
              <CloudRain className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setAudioDrawerOpen((prev) => !prev)}
              aria-label="Open Rain & Music Studio"
              aria-expanded={audioDrawerOpen}
              className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-2 rounded-lg border text-xs font-medium backdrop-blur-md transition-colors ${
                audioDrawerOpen
                  ? 'border-[#7C3AED] bg-[#7C3AED]/28 text-[#5B21B6] dark:text-white'
                  : 'border-white/30 dark:border-white/15 bg-white/18 dark:bg-white/[0.06] text-slate-800 dark:text-slate-100 hover:bg-white/35 dark:hover:bg-white/14'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span className="hidden xl:inline">Rain &amp; Music</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg border border-white/30 dark:border-white/15 bg-white/18 dark:bg-white/[0.06] text-slate-800 hover:text-slate-950 dark:text-slate-100 dark:hover:text-white hover:bg-white/35 dark:hover:bg-white/14 backdrop-blur-md transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onOpenOnboarding}
              className="hidden sm:inline-flex px-3 py-2 rounded-lg text-xs font-semibold bg-[#7C3AED]/85 hover:bg-[#6D28D9] border border-white/25 text-white backdrop-blur-md transition-colors whitespace-nowrap shrink-0"
            >
              Study Setup
            </button>

            <AnimatePresence>
              {audioDrawerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="fixed sm:absolute right-4 sm:right-0 top-16 sm:top-12 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-white/35 dark:border-white/18 bg-white/88 dark:bg-[#14142E]/88 backdrop-blur-2xl shadow-2xl p-4 z-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Study Room Ambience
                    </span>
                    <button
                      type="button"
                      onClick={() => setAudioDrawerOpen(false)}
                      aria-label="Close ambient audio panel"
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <AmbientAudioPanel compact />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Flush Header Exam Prep Window Progress Track */}
          {activeExamMetrics && (
            <div
              role="progressbar"
              aria-label={`${activeExamMetrics.exam.name} preparation window progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={activeExamMetrics.elapsedPercent}
              className="absolute inset-x-0 bottom-0 h-[3px] bg-slate-900/10 dark:bg-white/10 overflow-hidden"
            >
              <motion.div
                initial={false}
                animate={{ width: `${Math.max(3, activeExamMetrics.elapsedPercent)}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className={`h-full bg-gradient-to-r ${edgeGradient}`}
              />
            </div>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeRoute}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
