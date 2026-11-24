import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { AppState, PlannerTask } from '../types/study';
import { getTodayISO } from '../data/demoData';
import { addDaysISO, generateHybridSchedule } from '../utils/studyMath';

interface PlannerViewProps {
  state: AppState;
  onAddTask: (task: Omit<PlannerTask, 'id'>) => void;
  onAddMultipleTasks: (tasks: Array<Omit<PlannerTask, 'id'>>) => void;
  onUpdateTask: (id: string, patch: Partial<PlannerTask>) => void;
  onDeleteTask: (id: string) => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  state,
  onAddTask,
  onAddMultipleTasks,
  onUpdateTask,
  onDeleteTask,
}) => {
  const today = getTodayISO();
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [anchorDate, setAnchorDate] = useState(today);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRationale, setAiRationale] = useState<string | null>(null);

  // Manual task creation
  const [title, setTitle] = useState('');
  const [taskDate, setTaskDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [taskType, setTaskType] = useState<PlannerTask['taskType']>('Study');
  const [topicId, setTopicId] = useState('');

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysISO(anchorDate, i));
  }, [anchorDate]);

  const monthDates = useMemo(() => {
    const d = new Date(`${anchorDate.slice(0, 7)}-01T00:00:00Z`);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${year}-${String(month + 1).padStart(2, '0')}-${day}`;
    });
  }, [anchorDate]);

  const dailyPlannedMinutes = useMemo(() => {
    return state.tasks
      .filter((t) => t.date === anchorDate && t.status !== 'Postponed')
      .reduce((acc, t) => acc + t.durationMinutes, 0);
  }, [state.tasks, anchorDate]);

  const weeklyPlannedMinutes = useMemo(() => {
    const set = new Set(weekDates);
    return state.tasks
      .filter((t) => set.has(t.date) && t.status !== 'Postponed')
      .reduce((acc, t) => acc + t.durationMinutes, 0);
  }, [state.tasks, weekDates]);

  const examByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    state.exams.forEach((ex) => {
      const arr = map.get(ex.examDate) ?? [];
      arr.push(ex.name);
      map.set(ex.examDate, arr);
    });
    return map;
  }, [state.exams]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const topic = state.topics.find((t) => t.id === topicId);
    onAddTask({
      title: title.trim(),
      date: taskDate,
      startTime,
      durationMinutes: Math.max(15, Number(durationMinutes) || 45),
      topicId: topic?.id,
      subjectId: topic?.subjectId,
      examId: topic?.examIds[0],
      taskType,
      status: 'Pending',
      source: 'manual',
    });
    setTitle('');
  };

  const handleHybridPlan = () => {
    const generated = generateHybridSchedule({
      topics: state.topics,
      exams: state.exams,
      startDateISO: anchorDate,
      days: 7,
      dailyMinutesBudget: Math.round((state.profile.dailyHoursTarget || 3) * 60),
      preferredDays: state.profile.preferredStudyDays,
    });
    if (generated.length > 0) {
      onAddMultipleTasks(
        generated.map(({ id: _omit, ...rest }) => rest)
      );
      setAiRationale(
        `Generated ${generated.length} hybrid blocks across 7 days prioritized by exam proximity, topic weightage, weak areas, and overdue revisions.`
      );
    }
  };

  const handleAiPlan = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: state.profile,
          exams: state.exams,
          topics: state.topics,
          startDateISO: anchorDate,
          days: 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI planner failed.');
      const tasksToAdd: Array<Omit<PlannerTask, 'id'>> = (data.tasks || []).map(
        (t: Record<string, unknown>) => ({
          title: String(t.title || 'AI Study Block'),
          date: String(t.date || anchorDate),
          startTime: String(t.startTime || '09:00'),
          durationMinutes: Math.max(15, Number(t.durationMinutes) || 60),
          topicId: typeof t.topicId === 'string' ? t.topicId : undefined,
          subjectId: typeof t.subjectId === 'string' ? t.subjectId : undefined,
          taskType:
            t.taskType === 'Revision' || t.taskType === 'Practice' || t.taskType === 'Mock'
              ? t.taskType
              : 'Study',
          status: 'Pending',
          source: 'ai_generated',
        })
      );
      if (tasksToAdd.length > 0) {
        onAddMultipleTasks(tasksToAdd);
      }
      setAiRationale(data.rationale || 'AI schedule added to your calendar.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI schedule.');
    } finally {
      setAiLoading(false);
    }
  };

  const renderTaskPill = (task: PlannerTask) => {
    const isDone = task.status === 'Done';
    return (
      <div
        key={task.id}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
        className={`p-2.5 rounded-xl border text-xs space-y-1.5 cursor-grab active:cursor-grabbing ${
          isDone
            ? 'border-[#22C55E]/30 bg-[#22C55E]/10'
            : task.source === 'ai_generated'
              ? 'border-[#7C3AED]/40 bg-[#7C3AED]/10'
              : 'border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onUpdateTask(task.id, { status: isDone ? 'Pending' : 'Done' })}
            className="flex items-start gap-2 text-left min-w-0 flex-1"
          >
            <span
              className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                isDone
                  ? 'bg-[#22C55E] border-[#22C55E] text-white'
                  : 'border-slate-400 dark:border-[#4A4A7A]'
              }`}
            >
              {isDone && <Check className="w-2.5 h-2.5" />}
            </span>
            <span className={`font-medium leading-snug ${isDone ? 'line-through text-slate-400' : ''}`}>
              {task.title}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            aria-label={`Delete task ${task.title}`}
            className="text-slate-400 hover:text-[#EF4444] shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>
            {task.startTime} · {task.durationMinutes}m · {task.taskType}
          </span>
          <button
            type="button"
            onClick={() =>
              onUpdateTask(task.id, {
                date: addDaysISO(task.date, 1),
                status: 'Pending',
              })
            }
            className="text-[#06B6D4] hover:underline font-sans"
          >
            +1d
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Planner Controls & Goal Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-md p-0.5">
              {(['daily', 'weekly', 'monthly'] as const).map((m) => {
                const active = viewMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors duration-200 ${
                      active
                        ? 'text-white'
                        : 'text-slate-800 dark:text-slate-100 hover:bg-white/24 dark:hover:bg-white/10'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="planner-mode-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                      />
                    )}
                    <span className="relative z-10">{m}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous period"
                onClick={() =>
                  setAnchorDate((d) => addDaysISO(d, viewMode === 'daily' ? -1 : -7))
                }
                className="p-2 rounded-lg border border-slate-200 dark:border-[#2E2E58]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value || today)}
                aria-label="Calendar anchor date"
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
              />
              <button
                type="button"
                aria-label="Next period"
                onClick={() =>
                  setAnchorDate((d) => addDaysISO(d, viewMode === 'daily' ? 1 : 7))
                }
                className="p-2 rounded-lg border border-slate-200 dark:border-[#2E2E58]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleHybridPlan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto-Fill Hybrid Week
            </button>
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleAiPlan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#7C3AED] hover:bg-[#6D28D9] text-white disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? 'Generating AI Plan...' : 'AI Study Schedule'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-col justify-center space-y-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Day Allocation ({anchorDate})</span>
            <span className="font-mono font-semibold">
              {(dailyPlannedMinutes / 60).toFixed(1)}h / {state.profile.dailyHoursTarget}h
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">7-Day Planned Load</span>
            <span className="font-mono font-semibold text-[#06B6D4]">
              {(weeklyPlannedMinutes / 60).toFixed(1)}h / {state.profile.weeklyHoursTarget}h
            </span>
          </div>
        </div>
      </div>

      {aiError && (
        <div role="alert" className="px-4 py-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#EF4444]">
          {aiError}
        </div>
      )}
      {aiRationale && (
        <div className="px-4 py-3 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-xs text-[#06B6D4]">
          {aiRationale}
        </div>
      )}

      {/* Manual Task Composer */}
      <form
        onSubmit={handleManualSubmit}
        className="p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add study task or goal..."
          aria-label="Task title"
          className="lg:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
        />
        <select
          value={topicId}
          onChange={(e) => {
            setTopicId(e.target.value);
            const found = state.topics.find((t) => t.id === e.target.value);
            if (found && !title) setTitle(`Study: ${found.name}`);
          }}
          aria-label="Link topic"
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
        >
          <option value="">Optional topic link...</option>
          {state.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={taskDate}
          onChange={(e) => setTaskDate(e.target.value)}
          aria-label="Task date"
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
        />
        <div className="flex gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-label="Start time"
            className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
          />
          <input
            type="number"
            min={15}
            max={360}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            aria-label="Duration minutes"
            className="w-20 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as PlannerTask['taskType'])}
            aria-label="Task type"
            className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="Study">Study</option>
            <option value="Revision">Revision</option>
            <option value="Practice">Practice</option>
            <option value="Mock">Mock</option>
            <option value="Goal">Goal</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </form>

      {/* Daily / Weekly / Monthly Calendar Grid (Drag-and-Drop enabled) */}
      {viewMode === 'daily' && (
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#7C3AED]" />
              Daily Plan for {anchorDate}
            </h2>
            {examByDate.get(anchorDate) && (
              <span className="text-xs font-semibold text-[#F97316]">
                Exam Day: {examByDate.get(anchorDate)?.join(', ')}
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {state.tasks.filter((t) => t.date === anchorDate).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No blocks scheduled on {anchorDate}. Add a task above or generate a hybrid schedule.
              </p>
            ) : (
              state.tasks
                .filter((t) => t.date === anchorDate)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(renderTaskPill)
            )}
          </div>
        </div>
      )}

      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDates.map((dateISO) => {
            const dayTasks = state.tasks
              .filter((t) => t.date === dateISO)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const examsToday = examByDate.get(dateISO);
            const isToday = dateISO === today;
            return (
              <div
                key={dateISO}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedTaskId) {
                    onUpdateTask(draggedTaskId, { date: dateISO });
                    setDraggedTaskId(null);
                  }
                }}
                className={`rounded-2xl border p-3.5 min-h-[260px] flex flex-col gap-2.5 ${
                  isToday
                    ? 'border-[#7C3AED] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl'
                    : 'border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2A2A50]">
                  <span className={`font-mono text-xs font-bold ${isToday ? 'text-[#7C3AED]' : ''}`}>
                    {dateISO.slice(5)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dayTasks.reduce((a, b) => a + b.durationMinutes, 0)}m
                  </span>
                </div>
                {examsToday && (
                  <p className="text-[11px] font-semibold text-[#F97316]">
                    Exam: {examsToday.join(', ')}
                  </p>
                )}
                <div className="space-y-2 flex-1">
                  {dayTasks.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic pt-4 text-center">
                      Drop tasks here
                    </p>
                  ) : (
                    dayTasks.map(renderTaskPill)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-4">
          <h2 className="font-display text-sm font-bold mb-4">
            Month Overview ({anchorDate.slice(0, 7)}) — Drag tasks across days
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {monthDates.map((dateISO) => {
              const dayTasks = state.tasks.filter((t) => t.date === dateISO);
              const examsToday = examByDate.get(dateISO);
              return (
                <div
                  key={dateISO}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedTaskId) {
                      onUpdateTask(draggedTaskId, { date: dateISO });
                      setDraggedTaskId(null);
                    }
                  }}
                  className={`p-2 rounded-xl border min-h-[96px] flex flex-col gap-1 ${
                    dateISO === today
                      ? 'border-[#7C3AED] bg-[#7C3AED]/5'
                      : 'border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F]'
                  }`}
                >
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="font-bold">{dateISO.slice(8)}</span>
                    {dayTasks.length > 0 && (
                      <span className="text-[#06B6D4]">{dayTasks.length}t</span>
                    )}
                  </div>
                  {examsToday && (
                    <p className="text-[10px] font-semibold text-[#F97316] truncate">
                      {examsToday[0]}
                    </p>
                  )}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setDraggedTaskId(t.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl truncate cursor-grab"
                      >
                        {t.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
