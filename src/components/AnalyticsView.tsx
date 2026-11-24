import React, { useMemo } from 'react';
import type { AppState } from '../types/study';
import { getTodayISO } from '../data/demoData';
import {
  addDaysISO,
  calculateExamReadiness,
  calculateStudyStreak,
} from '../utils/studyMath';

interface AnalyticsViewProps {
  state: AppState;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state }) => {
  const today = getTodayISO();

  const totalHours = useMemo(() => {
    const mins = state.sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    return Number((mins / 60).toFixed(1));
  }, [state.sessions]);

  const streak = useMemo(() => calculateStudyStreak(state.sessions, today), [state.sessions, today]);

  const consistencyPct = useMemo(() => {
    const last14 = new Set(
      state.sessions
        .filter((s) => s.date >= addDaysISO(today, -13))
        .map((s) => s.date)
    );
    return Math.round((last14.size / 14) * 100);
  }, [state.sessions, today]);

  const heatmapDays = useMemo(() => {
    return Array.from({ length: 28 }, (_, idx) => {
      const date = addDaysISO(today, idx - 27);
      const mins = state.sessions
        .filter((s) => s.date === date)
        .reduce((acc, s) => acc + s.durationMinutes, 0);
      return { date, mins };
    });
  }, [state.sessions, today]);

  const avgPracticeAccuracy = useMemo(() => {
    const attempted = state.topics.reduce((acc, t) => acc + t.practiceAttempted, 0);
    const correct = state.topics.reduce((acc, t) => acc + t.practiceCorrect, 0);
    if (attempted === 0) return null;
    return Math.round((correct / attempted) * 100);
  }, [state.topics]);

  const subjectAnalytics = useMemo(() => {
    return state.subjects.map((s) => {
      const topics = state.topics.filter((t) => t.subjectId === s.id);
      const avgMastery =
        topics.length > 0
          ? Math.round(topics.reduce((a, t) => a + t.masteryScore, 0) / topics.length)
          : 0;
      const estimatedMins = topics.reduce((a, t) => a + t.estimatedMinutes, 0);
      const actualMins = topics.reduce((a, t) => a + t.actualMinutes, 0);
      return {
        ...s,
        topicCount: topics.length,
        avgMastery,
        estimatedMins,
        actualMins,
      };
    });
  }, [state.subjects, state.topics]);

  const strongAreas = useMemo(
    () =>
      state.topics
        .filter((t) => t.masteryScore >= 70)
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .slice(0, 5),
    [state.topics]
  );

  const weakAreas = useMemo(
    () =>
      state.topics
        .filter((t) => t.status === 'Weak Area' || (t.practiceAttempted > 0 && t.masteryScore < 55))
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 5),
    [state.topics]
  );

  const overallReadiness = useMemo(
    () => calculateExamReadiness(state.topics, 'all', state.mockTests),
    [state.topics, state.mockTests]
  );

  if (state.topics.length === 0 && state.sessions.length === 0 && state.mockTests.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-10 text-center space-y-2">
        <h2 className="font-display text-lg font-bold">No Recorded Analytics Yet</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Analytics are computed exclusively from recorded study sessions, syllabus progress, practice results, and mock tests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Recorded Study Time</p>
          <p className="font-mono text-2xl font-bold mt-1">{totalHours}h</p>
          <p className="text-xs text-slate-500 mt-1 font-mono">{streak}d current streak</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">14-Day Consistency</p>
          <p className="font-mono text-2xl font-bold text-[#06B6D4] mt-1">{consistencyPct}%</p>
          <p className="text-xs text-slate-500 mt-1">Active days ratio</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Practice Accuracy</p>
          <p className="font-mono text-2xl font-bold text-[#22C55E] mt-1">
            {avgPracticeAccuracy !== null ? `${avgPracticeAccuracy}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Recorded question attempts</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Exam Readiness</p>
          <p className="font-mono text-2xl font-bold text-[#7C3AED] mt-1">{overallReadiness}%</p>
          <p className="text-xs text-slate-500 mt-1">Weighted mastery + mocks</p>
        </div>
      </div>

      {/* 28-Day Study Consistency Heatmap & Mock Score Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-bold">28-Day Study Activity Heatmap</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily logged minutes across the past 4 weeks
            </p>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmapDays.map((d) => {
              const intensity =
                d.mins === 0
                  ? 'bg-slate-100 dark:bg-[#17172F] text-slate-400'
                  : d.mins < 45
                    ? 'bg-[#7C3AED]/25 text-slate-900 dark:text-white'
                    : d.mins < 90
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-[#22C55E] text-slate-950 font-semibold';
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.mins} mins`}
                  className={`h-9 rounded-lg ${intensity} flex items-center justify-center font-mono text-[10px]`}
                >
                  {d.mins > 0 ? d.mins : ''}
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-bold">Test Score & Accuracy Progression</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Recorded mock test scores over time
            </p>
          </div>
          {state.mockTests.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Complete mock tests to plot score progression.
            </p>
          ) : (
            <div className="space-y-3">
              <svg viewBox="0 0 400 120" className="w-full h-32 overflow-visible">
                <line x1="0" y1="100" x2="400" y2="100" stroke="currentColor" strokeOpacity="0.15" />
                <line x1="0" y1="50" x2="400" y2="50" stroke="currentColor" strokeOpacity="0.1" />
                {state.mockTests.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="3"
                    points={state.mockTests
                      .map((m, idx) => {
                        const x = (idx / (state.mockTests.length - 1)) * 380 + 10;
                        const y = 100 - m.percentage * 0.9;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}
                {state.mockTests.map((m, idx) => {
                  const x =
                    state.mockTests.length === 1
                      ? 200
                      : (idx / (state.mockTests.length - 1)) * 380 + 10;
                  const y = 100 - m.percentage * 0.9;
                  return (
                    <g key={m.id}>
                      <circle cx={x} cy={y} r="5" fill="#7C3AED" />
                      <text
                        x={x}
                        y={y - 10}
                        textAnchor="middle"
                        className="fill-slate-500 dark:fill-slate-300 text-[10px] font-mono"
                      >
                        {m.percentage}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </section>
      </div>

      {/* Subject Mastery & Time Management */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4">
        <h2 className="font-display text-sm font-bold">Subject Mastery & Time Budget Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2A2A50] text-slate-500">
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 px-3 text-right">Topics</th>
                <th className="py-2 px-3 text-right">Avg Mastery</th>
                <th className="py-2 px-3 text-right">Est. Time</th>
                <th className="py-2 pl-3 text-right">Actual Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2A2A50]">
              {subjectAnalytics.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-4 font-semibold">{s.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{s.topicCount}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#06B6D4]">
                    {s.avgMastery}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{s.estimatedMins}m</td>
                  <td className="py-2.5 pl-3 text-right font-mono">{s.actualMins}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Strong vs Weak Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#22C55E]">Strongest Areas</h3>
          {strongAreas.length === 0 ? (
            <p className="text-xs text-slate-500">No topics have reached 70%+ mastery yet.</p>
          ) : (
            strongAreas.map((t) => (
              <div key={t.id} className="flex justify-between text-xs py-1">
                <span className="truncate">{t.name}</span>
                <span className="font-mono font-bold text-[#22C55E]">{t.masteryScore}%</span>
              </div>
            ))
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#EF4444]">Priority Weak Areas</h3>
          {weakAreas.length === 0 ? (
            <p className="text-xs text-slate-500">No weak areas currently flagged.</p>
          ) : (
            weakAreas.map((t) => (
              <div key={t.id} className="flex justify-between text-xs py-1">
                <span className="truncate">{t.name}</span>
                <span className="font-mono font-bold text-[#EF4444]">{t.masteryScore}%</span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
};
