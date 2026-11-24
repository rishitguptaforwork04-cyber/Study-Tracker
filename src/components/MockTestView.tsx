import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  Maximize,
  Minimize,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AppState,
  DifficultyLevel,
  MockTestAttempt,
  MockTestConfig,
  Question,
  QuestionType,
} from '../types/study';

interface MockTestViewProps {
  state: AppState;
  onSubmitMock: (payload: {
    config: MockTestConfig;
    questions: Question[];
    answers: Record<string, string>;
    markedForReview: Record<string, boolean>;
    timeSpentMap: Record<string, number>;
    startedAt: string;
    totalTimeSeconds: number;
  }) => MockTestAttempt;
}

const DURATION_PRESETS = [30, 45, 60, 90, 120, 150, 180];

export const MockTestView: React.FC<MockTestViewProps> = ({ state, onSubmitMock }) => {
  // Builder configuration
  const [title, setTitle] = useState('Focused Mock Assessment');
  const [durationPreset, setDurationPreset] = useState<number | 'custom'>(30);
  const [customMinutes, setCustomMinutes] = useState(20);
  const [questionCount, setQuestionCount] = useState(5);
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState('all');
  const [difficulty, setDifficulty] = useState<'All' | DifficultyLevel>('All');
  const [questionFormat, setQuestionFormat] = useState<'All' | QuestionType>('All');
  const [marksPerQuestion, setMarksPerQuestion] = useState(4);
  const [negativeMarking, setNegativeMarking] = useState(1);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(false);

  // Active test runtime state
  const [phase, setPhase] = useState<'setup' | 'running' | 'report'>('setup');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [activeConfig, setActiveConfig] = useState<MockTestConfig | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [timeSpentMap, setTimeSpentMap] = useState<Record<string, number>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [startedAt, setStartedAt] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<MockTestAttempt | null>(
    state.mockTests[state.mockTests.length - 1] ?? null
  );
  const [buildError, setBuildError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const matchingPool = useMemo(() => {
    return state.questions.filter((q) => {
      if (selectedExamId !== 'all' && q.examId && q.examId !== selectedExamId) return false;
      if (selectedSubjectIds.length > 0 && !selectedSubjectIds.includes(q.subjectId)) return false;
      if (selectedTopicId !== 'all' && q.topicId !== selectedTopicId) return false;
      if (difficulty !== 'All' && q.difficulty !== difficulty) return false;
      if (questionFormat !== 'All' && q.questionType !== questionFormat) return false;
      return true;
    });
  }, [
    state.questions,
    selectedExamId,
    selectedSubjectIds,
    selectedTopicId,
    difficulty,
    questionFormat,
  ]);

  const finishAndGrade = useCallback(() => {
    if (!activeConfig) return;
    const totalBudgetSeconds = activeConfig.durationMinutes * 60;
    const elapsed = Math.max(1, totalBudgetSeconds - secondsRemaining);
    const attempt = onSubmitMock({
      config: activeConfig,
      questions: activeQuestions,
      answers,
      markedForReview,
      timeSpentMap,
      startedAt,
      totalTimeSeconds: elapsed,
    });
    setLastAttempt(attempt);
    setConfirmOpen(false);
    setPhase('report');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, [
    activeConfig,
    activeQuestions,
    answers,
    markedForReview,
    onSubmitMock,
    secondsRemaining,
    startedAt,
    timeSpentMap,
  ]);

  // Countdown timer & per-question elapsed tracker
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
      const currentQ = activeQuestions[currentIndex];
      if (currentQ) {
        setTimeSpentMap((prev) => ({
          ...prev,
          [currentQ.id]: (prev[currentQ.id] ?? 0) + 1,
        }));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, activeQuestions, currentIndex]);

  useEffect(() => {
    if (phase === 'running' && secondsRemaining === 0 && activeConfig) {
      finishAndGrade();
    }
  }, [phase, secondsRemaining, activeConfig, finishAndGrade]);

  // Keyboard navigation during test
  useEffect(() => {
    if (phase !== 'running') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        setCurrentIndex((i) => Math.min(activeQuestions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key.toLowerCase() === 'r') {
        const q = activeQuestions[currentIndex];
        if (q) {
          setMarkedForReview((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const q = activeQuestions[currentIndex];
        const idx = Number(e.key) - 1;
        if (q?.options && q.options[idx]) {
          setAnswers((prev) => ({ ...prev, [q.id]: q.options![idx] }));
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, activeQuestions, currentIndex]);

  const handleStartTest = () => {
    setBuildError(null);
    if (matchingPool.length === 0) {
      setBuildError(
        'No questions match your selected filters. Add questions in Practice Centre or broaden your selection.'
      );
      return;
    }

    const duration = durationPreset === 'custom' ? Math.max(5, customMinutes) : durationPreset;
    let pool = matchingPool.slice();
    if (randomizeQuestions) {
      pool = pool.sort(() => Math.random() - 0.5);
    }
    const chosen = pool.slice(0, Math.min(questionCount, pool.length)).map((q) => {
      if (!randomizeOptions || !q.options) return q;
      return { ...q, options: q.options.slice().sort(() => Math.random() - 0.5) };
    });

    const config: MockTestConfig = {
      title: title.trim() || 'Timed Mock Test',
      durationMinutes: duration,
      questionCount: chosen.length,
      subjectIds: selectedSubjectIds,
      chapterIds: [],
      topicIds: selectedTopicId !== 'all' ? [selectedTopicId] : [],
      difficulty,
      questionFormat,
      examId: selectedExamId,
      marksPerQuestion,
      negativeMarking,
      randomizeQuestions,
      randomizeOptions,
    };

    setActiveConfig(config);
    setActiveQuestions(chosen);
    setCurrentIndex(0);
    setAnswers({});
    setMarkedForReview({});
    setTimeSpentMap({});
    setSecondsRemaining(duration * 60);
    setStartedAt(new Date().toISOString());
    setPhase('running');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const subjectMap = useMemo(
    () => new Map(state.subjects.map((s) => [s.id, s.name])),
    [state.subjects]
  );
  const topicMap = useMemo(
    () => new Map(state.topics.map((t) => [t.id, t.name])),
    [state.topics]
  );

  // RUNNING TEST INTERFACE
  if (phase === 'running' && activeConfig) {
    const currentQ = activeQuestions[currentIndex];
    const answeredCount = activeQuestions.filter((q) => Boolean((answers[q.id] ?? '').trim())).length;
    const reviewCount = activeQuestions.filter((q) => Boolean(markedForReview[q.id])).length;

    return (
      <div
        ref={containerRef}
        className="space-y-5 bg-white/45 dark:bg-[#121228]/55 backdrop-blur-md p-2 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-white/12"
      >
        {/* Top Live Timer & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl">
          <div>
            <h2 className="font-display text-base font-bold">{activeConfig.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Shortcuts: Left/Right arrows navigate · 1–4 pick option · R marks for review
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`px-3.5 py-2 rounded-xl font-mono text-sm font-bold flex items-center gap-2 ${
                secondsRemaining < 120
                  ? 'bg-[#EF4444]/15 text-[#EF4444]'
                  : 'bg-[#7C3AED]/15 text-[#7C3AED]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#2E2E58]"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold"
            >
              Submit Test
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Question Stage */}
          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-[#06B6D4]">
                Question {currentIndex + 1} of {activeQuestions.length}
              </span>
              <span>
                +{activeConfig.marksPerQuestion} / -{activeConfig.negativeMarking} ·{' '}
                {currentQ.difficulty}
              </span>
            </div>

            <p className="text-base font-medium text-slate-900 dark:text-white leading-relaxed">
              {currentQ.statement}
            </p>

            {currentQ.options && currentQ.options.length > 0 ? (
              <div className="space-y-2.5">
                {currentQ.options.map((opt, oIdx) => {
                  const selected = answers[currentQ.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-left text-sm flex items-center gap-3 transition-colors ${
                        selected
                          ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200 dark:border-[#2E2E58] hover:border-[#7C3AED]/50'
                      }`}
                    >
                      <span className="font-mono text-xs w-6 h-6 rounded-lg border border-slate-300 dark:border-[#3E3E70] flex items-center justify-center shrink-0">
                        {oIdx + 1}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                value={answers[currentQ.id] ?? ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }))
                }
                placeholder="Enter your numerical or text response..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-[#2A2A50]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMarkedForReview((prev) => ({
                      ...prev,
                      [currentQ.id]: !prev[currentQ.id],
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
                    markedForReview[currentQ.id]
                      ? 'border-[#F97316] bg-[#F97316]/15 text-[#F97316]'
                      : 'border-slate-200 dark:border-[#2E2E58]'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {markedForReview[currentQ.id] ? 'Marked for Review' : 'Mark for Review'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => {
                      const copy = { ...prev };
                      delete copy[currentQ.id];
                      return copy;
                    })
                  }
                  className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-[#2E2E58]"
                >
                  Clear
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#2E2E58] disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentIndex === activeQuestions.length - 1}
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(activeQuestions.length - 1, i + 1))
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-30"
                >
                  Save & Next
                </button>
              </div>
            </div>
          </div>

          {/* Question Palette */}
          <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4">
            <h3 className="font-display text-sm font-bold">Question Palette</h3>
            <div className="grid grid-cols-5 gap-2">
              {activeQuestions.map((q, idx) => {
                const isAnswered = Boolean((answers[q.id] ?? '').trim());
                const isMarked = Boolean(markedForReview[q.id]);
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Jump to question ${idx + 1}`}
                    className={`h-10 rounded-xl font-mono text-xs font-bold border transition-colors ${
                      isCurrent
                        ? 'ring-2 ring-[#7C3AED] border-[#7C3AED]'
                        : 'border-slate-200 dark:border-[#2E2E58]'
                    } ${
                      isMarked
                        ? 'bg-[#F97316]/20 text-[#F97316]'
                        : isAnswered
                          ? 'bg-[#22C55E]/20 text-[#22C55E]'
                          : 'bg-slate-50 dark:bg-[#17172F]'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-200 dark:border-[#2A2A50]">
              <p>Answered: {answeredCount}</p>
              <p>Unanswered: {activeQuestions.length - answeredCount}</p>
              <p>Marked for Review: {reviewCount}</p>
            </div>
          </aside>
        </div>

        {/* Submission Confirmation Modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#F97316]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Confirm Mock Test Submission
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You answered <span className="font-mono font-bold">{answeredCount}</span> of{' '}
                <span className="font-mono font-bold">{activeQuestions.length}</span> questions (
                {activeQuestions.length - answeredCount} unanswered, {reviewCount} marked for review).
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-[#2E2E58]"
                >
                  Resume Test
                </button>
                <button
                  type="button"
                  onClick={finishAndGrade}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#22C55E] text-white hover:bg-[#16A34A]"
                >
                  Confirm & Grade
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // SETUP + REPORT TABS
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-md p-1">
          {(
            [
              ['setup', 'Configure New Mock'],
              ['report', `Test Reports (${state.mockTests.length})`],
            ] as const
          ).map(([id, label]) => {
            const active = phase === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPhase(id)}
                className={`relative px-4 py-2 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                  active
                    ? 'text-white'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-white/24 dark:hover:bg-white/10'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mock-phase-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {phase === 'setup' && (
        <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-base font-bold">Timed Mock Test Builder</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Test submissions automatically update topic mastery, mistake logs, and spaced repetition schedules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="mock-title" className="block text-xs font-medium mb-1">
                Test Title
              </label>
              <input
                id="mock-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
              />
            </div>

            <div>
              <label htmlFor="mock-exam" className="block text-xs font-medium mb-1">
                Target Exam Format
              </label>
              <select
                id="mock-exam"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
              >
                <option value="all">All Exams</option>
                {state.exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mock-count" className="block text-xs font-medium mb-1">
                Number of Questions (Pool: {matchingPool.length})
              </label>
              <input
                id="mock-count"
                type="number"
                min={1}
                max={200}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Duration (minutes)</p>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setDurationPreset(min)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                    durationPreset === min
                      ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                      : 'border-slate-200 dark:border-[#2E2E58]'
                  }`}
                >
                  {min}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDurationPreset('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  durationPreset === 'custom'
                    ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                    : 'border-slate-200 dark:border-[#2E2E58]'
                }`}
              >
                Custom
              </button>
              {durationPreset === 'custom' && (
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  aria-label="Custom duration minutes"
                  className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
                />
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Subjects (leave unselected for all)</p>
            <div className="flex flex-wrap gap-2">
              {state.subjects.map((s) => {
                const active = selectedSubjectIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSelectedSubjectIds((prev) =>
                        active ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      active
                        ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-[#06B6D4]'
                        : 'border-slate-200 dark:border-[#2E2E58]'
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              aria-label="Filter mock by topic"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="all">All Topics</option>
              {state.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'All' | DifficultyLevel)}
              aria-label="Filter mock by difficulty"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <select
              value={questionFormat}
              onChange={(e) => setQuestionFormat(e.target.value as 'All' | QuestionType)}
              aria-label="Filter mock by question format"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="All">All Formats</option>
              <option value="MCQ">MCQ</option>
              <option value="Numerical">Numerical</option>
              <option value="Conceptual">Conceptual</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Marks</label>
              <input
                type="number"
                min={1}
                max={20}
                value={marksPerQuestion}
                onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">-Neg</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.25}
                value={negativeMarking}
                onChange={(e) => setNegativeMarking(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeQuestions}
                onChange={(e) => setRandomizeQuestions(e.target.checked)}
                className="accent-[#7C3AED]"
              />
              Randomize question order
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={randomizeOptions}
                onChange={(e) => setRandomizeOptions(e.target.checked)}
                className="accent-[#7C3AED]"
              />
              Randomize MCQ options
            </label>
          </div>

          {buildError && (
            <p role="alert" className="text-xs text-[#EF4444]">
              {buildError}
            </p>
          )}

          <button
            type="button"
            onClick={handleStartTest}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold"
          >
            <Play className="w-4 h-4" />
            Start Timed Mock Test
          </button>
        </section>
      )}

      {phase === 'report' && (
        <div className="space-y-5">
          {state.mockTests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center text-sm text-slate-500">
              No mock test attempts recorded yet.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {state.mockTests
                  .slice()
                  .reverse()
                  .map((attempt) => (
                    <button
                      key={attempt.id}
                      type="button"
                      onClick={() => setLastAttempt(attempt)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                        lastAttempt?.id === attempt.id
                          ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                          : 'border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl'
                      }`}
                    >
                      {attempt.title} ({attempt.percentage}%)
                    </button>
                  ))}
              </div>

              {lastAttempt && (
                <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-[#2A2A50] pb-4">
                    <div>
                      <h2 className="font-display text-lg font-bold">{lastAttempt.title}</h2>
                      <p className="text-xs font-mono text-slate-500">
                        Completed {lastAttempt.completedAt.slice(0, 10)} · Time{' '}
                        {Math.round(lastAttempt.totalTimeSeconds / 60)}m{' '}
                        {lastAttempt.totalTimeSeconds % 60}s
                      </p>
                    </div>
                    <div className="flex items-center gap-6 font-mono">
                      <div>
                        <p className="text-[11px] text-slate-500">Score</p>
                        <p className="text-xl font-bold text-[#7C3AED]">
                          {lastAttempt.score}/{lastAttempt.maxScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Percentage</p>
                        <p className="text-xl font-bold text-[#06B6D4]">
                          {lastAttempt.percentage}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Accuracy</p>
                        <p className="text-xl font-bold text-[#22C55E]">
                          {lastAttempt.accuracy}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30">
                      <p className="text-xs text-[#22C55E]">Correct</p>
                      <p className="font-mono text-lg font-bold text-[#22C55E]">
                        {lastAttempt.correctCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30">
                      <p className="text-xs text-[#EF4444]">Incorrect</p>
                      <p className="font-mono text-lg font-bold text-[#EF4444]">
                        {lastAttempt.incorrectCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#17172F] border border-slate-200 dark:border-[#2E2E58]">
                      <p className="text-xs text-slate-500">Unattempted</p>
                      <p className="font-mono text-lg font-bold">{lastAttempt.unattemptedCount}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-bold">Question-wise Review</h3>
                    {lastAttempt.questionResults.map((qr, i) => (
                      <div
                        key={qr.questionId}
                        className="p-3 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              qr.isCorrect
                                ? 'text-[#22C55E]'
                                : qr.isAttempted
                                  ? 'text-[#EF4444]'
                                  : 'text-slate-400'
                            }`}
                          />
                          <span className="font-mono font-bold">Q{i + 1}</span>
                          <span className="text-slate-500 truncate">
                            {subjectMap.get(qr.subjectId) ?? 'Subject'}
                            {qr.topicId ? ` · ${topicMap.get(qr.topicId) ?? ''}` : ''}
                          </span>
                        </div>
                        <div className="font-mono flex items-center gap-4 shrink-0">
                          <span>Your: {qr.userAnswer ?? '—'}</span>
                          <span className="text-[#22C55E]">Key: {qr.correctAnswer}</span>
                          <span>{qr.timeSpentSeconds}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
