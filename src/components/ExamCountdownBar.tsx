import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, Plus, Target } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ExamTarget } from '../types/study';
import { computeExamCountdown, sortExamsByNearest } from '../utils/studyMath';

interface ExamCountdownBarProps {
  exams: ExamTarget[];
  selectedExamId: string | null;
  nowMs: number;
  onSelectExam: (examId: string) => void;
  onUpdateExam: (id: string, patch: Partial<ExamTarget>) => void;
  onManageExams: () => void;
}

export const ExamCountdownBar: React.FC<ExamCountdownBarProps> = ({
  exams,
  selectedExamId,
  nowMs,
  onSelectExam,
  onUpdateExam,
  onManageExams,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const sortedExams = sortExamsByNearest(exams, nowMs);
  const activeExam = sortedExams.find((e) => e.id === selectedExamId) ?? sortedExams[0] ?? null;

  if (!activeExam) {
    return (
      <button
        type="button"
        onClick={onManageExams}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/30 dark:border-white/16 bg-white/18 dark:bg-white/[0.06] hover:bg-white/32 dark:hover:bg-white/12 backdrop-blur-md text-xs font-medium text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap"
      >
        <Target className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#67E8F9]" />
        <span>Add Exam Countdown</span>
      </button>
    );
  }

  const metrics = computeExamCountdown(activeExam, nowMs);
  const barGradient =
    metrics.status === 'urgent'
      ? 'from-[#F59E0B] to-[#F97316]'
      : metrics.status === 'today' || metrics.status === 'passed'
        ? 'from-[#10B981] to-[#22C55E]'
        : 'from-[#7C3AED] via-[#06B6D4] to-[#10B981]';

  const statusTone =
    metrics.status === 'urgent'
      ? 'text-[#C2410C] dark:text-[#FDBA74]'
      : metrics.status === 'today' || metrics.status === 'passed'
        ? 'text-[#047857] dark:text-[#6EE7B7]'
        : 'text-[#0E7490] dark:text-[#67E8F9]';

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Examination countdown: ${activeExam.name}, ${metrics.remainingLabel}`}
        className="inline-flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/32 dark:border-white/16 bg-white/22 dark:bg-white/[0.06] hover:bg-white/36 dark:hover:bg-white/12 backdrop-blur-md transition-colors max-w-full"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: activeExam.color || '#7C3AED' }}
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[90px] sm:max-w-[140px]">
          {activeExam.name}
        </span>

        {/* Inline Prep-Window Progress Track */}
        <div
          className="hidden md:block w-20 lg:w-28 h-1.5 rounded-full bg-slate-900/15 dark:bg-white/14 overflow-hidden shrink-0"
          aria-hidden="true"
        >
          <motion.div
            initial={false}
            animate={{ width: `${Math.max(4, metrics.elapsedPercent)}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={`h-full rounded-full bg-gradient-to-r ${barGradient}`}
          />
        </div>

        <span className={`font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap shrink-0 ${statusTone}`}>
          {metrics.remainingLabel}
        </span>

        <span className="hidden xl:inline font-mono text-[10px] text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
          {metrics.elapsedPercent}% prep
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed sm:absolute left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto top-16 sm:top-12 sm:w-96 rounded-2xl border border-slate-200/80 dark:border-white/20 bg-white/95 dark:bg-[#12122E]/95 backdrop-blur-2xl shadow-2xl p-4 z-50 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#7C3AED] dark:text-[#67E8F9]" />
                <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Exam Countdowns
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                {sortedExams.length} {sortedExams.length === 1 ? 'target' : 'targets'}
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {sortedExams.map((exam) => {
                const m = computeExamCountdown(exam, nowMs);
                const isSelected = exam.id === activeExam.id;
                const itemGradient =
                  m.status === 'urgent'
                    ? 'from-[#F59E0B] to-[#F97316]'
                    : m.status === 'today' || m.status === 'passed'
                      ? 'from-[#10B981] to-[#22C55E]'
                      : 'from-[#7C3AED] via-[#06B6D4] to-[#10B981]';

                return (
                  <div
                    key={exam.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-[#7C3AED]/65 bg-[#7C3AED]/15 dark:bg-[#221D4A]'
                        : 'border-slate-200/80 dark:border-white/14 bg-slate-50/90 dark:bg-[#1A1A38]/95'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectExam(exam.id);
                        setOpen(false);
                      }}
                      className="w-full text-left space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: exam.color || '#7C3AED' }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {exam.name}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold tabular-nums text-[#7C3AED] dark:text-[#67E8F9] shrink-0">
                          {m.remainingLabel}
                        </span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-900/10 dark:bg-white/12 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${itemGradient}`}
                          style={{ width: `${Math.max(4, m.elapsedPercent)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                        <span>Exam: {exam.examDate}</span>
                        <span>
                          {m.elapsedPercent}% of {m.totalWindowDays}d prep
                        </span>
                      </div>
                    </button>

                    {isSelected && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between gap-2">
                        <label
                          htmlFor={`prep-start-${exam.id}`}
                          className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap"
                        >
                          Prep started:
                        </label>
                        <input
                          id={`prep-start-${exam.id}`}
                          type="date"
                          value={exam.prepStartDate?.slice(0, 10) || ''}
                          max={exam.examDate?.slice(0, 10)}
                          onChange={(e) =>
                            onUpdateExam(exam.id, { prepStartDate: e.target.value })
                          }
                          className="px-2 py-1 rounded-lg border border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-[#17172F]/80 text-[11px] font-mono text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onManageExams();
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300/70 dark:border-white/15 bg-white/50 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/12 text-slate-800 dark:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Manage Exams &amp; Dates
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
