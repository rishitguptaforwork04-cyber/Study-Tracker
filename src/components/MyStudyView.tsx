import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, GitMerge, Plus, Trash2 } from 'lucide-react';
import type {
  AppState,
  ExamTarget,
  PriorityLevel,
  StudySession,
  Topic,
  TopicStatus,
} from '../types/study';
import { findSyllabusOverlaps } from '../utils/studyMath';
import { getTodayISO } from '../data/demoData';

interface MyStudyViewProps {
  state: AppState;
  onUpdateTopic: (id: string, patch: Partial<Topic>) => void;
  onLogSession: (session: Omit<StudySession, 'id'>) => void;
  onAddExam: (exam: Omit<ExamTarget, 'id'>) => void;
  onDeleteExam: (id: string) => void;
}

const STATUS_OPTIONS: TopicStatus[] = [
  'Not Started',
  'Learning',
  'Completed',
  'Revision Due',
  'Weak Area',
  'Mastered',
];

const STATUS_STYLES: Record<TopicStatus, string> = {
  'Not Started': 'text-slate-500 dark:text-slate-400',
  Learning: 'text-[#06B6D4]',
  Completed: 'text-[#7C3AED]',
  'Revision Due': 'text-[#F97316]',
  'Weak Area': 'text-[#EF4444]',
  Mastered: 'text-[#22C55E]',
};

export const MyStudyView: React.FC<MyStudyViewProps> = ({
  state,
  onUpdateTopic,
  onLogSession,
  onAddExam,
  onDeleteExam,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopicId, setActiveTopicId] = useState<string | null>(
    state.topics[0]?.id ?? null
  );

  // Add exam inline form
  const [newExamName, setNewExamName] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamTarget, setNewExamTarget] = useState('');

  // Quick session log state
  const [sessionMins, setSessionMins] = useState(45);
  const [sessionType, setSessionType] = useState<StudySession['activityType']>('Study');
  const [sessionNotes, setSessionNotes] = useState('');
  const [practiceIncTotal, setPracticeIncTotal] = useState(5);
  const [practiceIncCorrect, setPracticeIncCorrect] = useState(4);

  const overlapSummary = useMemo(
    () => findSyllabusOverlaps(state.topics, state.subjects, state.exams),
    [state.topics, state.subjects, state.exams]
  );

  const filteredTopics = useMemo(() => {
    return state.topics.filter((t) => {
      if (selectedSubjectId !== 'all' && t.subjectId !== selectedSubjectId) return false;
      if (selectedExamId !== 'all' && !t.examIds.includes(selectedExamId)) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!t.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [state.topics, selectedSubjectId, selectedExamId, statusFilter, searchQuery]);

  const activeTopic = useMemo(
    () => state.topics.find((t) => t.id === activeTopicId) ?? filteredTopics[0] ?? null,
    [state.topics, activeTopicId, filteredTopics]
  );

  const subjectMap = useMemo(
    () => new Map(state.subjects.map((s) => [s.id, s])),
    [state.subjects]
  );
  const chapterMap = useMemo(
    () => new Map(state.chapters.map((c) => [c.id, c])),
    [state.chapters]
  );

  const handleAddExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamName.trim()) return;
    const colors = ['#7C3AED', '#06B6D4', '#F97316', '#EC4899', '#22C55E'];
    onAddExam({
      name: newExamName.trim(),
      examDate: newExamDate || getTodayISO(),
      prepStartDate: getTodayISO(),
      attemptYear: (newExamDate || getTodayISO()).slice(0, 4),
      targetScore: newExamTarget.trim() || 'Target Score',
      color: colors[state.exams.length % colors.length],
    });
    setNewExamName('');
    setNewExamDate('');
    setNewExamTarget('');
  };

  return (
    <div className="space-y-6">
      {/* Multi-Exam Targets & Syllabus Overlap Detector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Target Examinations
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Course: {state.profile.courseName || 'Not set'} · {state.profile.preparationLevel}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {state.exams.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No exam targets added yet.</p>
            ) : (
              state.exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {exam.name}
                    </p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {exam.examDate} · Goal {exam.targetScore}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteExam(exam.id)}
                    aria-label={`Delete exam ${exam.name}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#EF4444]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddExamSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <input
              type="text"
              value={newExamName}
              onChange={(e) => setNewExamName(e.target.value)}
              placeholder="Exam name"
              aria-label="New exam name"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            />
            <input
              type="date"
              value={newExamDate}
              onChange={(e) => setNewExamDate(e.target.value)}
              aria-label="New exam date"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newExamTarget}
                onChange={(e) => setNewExamTarget(e.target.value)}
                placeholder="Target score"
                aria-label="New exam target score"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              />
              <button
                type="submit"
                aria-label="Add target exam"
                className="px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9] shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>
        </section>

        {/* Cross-Exam Syllabus Overlap Detector */}
        <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-[#06B6D4]" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Cross-Exam Syllabus Overlap
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Topics mapped to two or more examinations count once toward shared preparation efficiency.
          </p>

          {overlapSummary.sharedTopics.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
              No overlapping topics detected across multiple exams yet. Map multiple exam IDs to shared topics in the Syllabus view.
            </p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {overlapSummary.sharedTopics.map((item) => (
                <div
                  key={item.topicId}
                  className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-[#2A2A50]"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {item.topicName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.subjectName} · Shared across {item.examNames.join(' & ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Topic Tracker Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics..."
          aria-label="Search tracked topics"
          className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
        />
        <select
          value={selectedSubjectId}
          onChange={(e) => setSelectedSubjectId(e.target.value)}
          aria-label="Filter tracker by subject"
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-medium"
        >
          <option value="all">All Subjects</option>
          {state.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          aria-label="Filter tracker by exam"
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter tracker by status"
          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-medium"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Master-Detail Interactive Topic Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2A2A50] flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Topic Progress Tracker ({filteredTopics.length})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Completed status requires practice & recall for Mastery
            </span>
          </div>

          {filteredTopics.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No topics match your current filters. Add topics in Syllabus Architect.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#2A2A50]">
              {filteredTopics.map((topic) => {
                const subj = subjectMap.get(topic.subjectId);
                const chap = chapterMap.get(topic.chapterId);
                const isActive = activeTopic?.id === topic.id;
                return (
                  <div
                    key={topic.id}
                    className={`p-4 transition-colors ${
                      isActive
                        ? 'bg-[#7C3AED]/10 dark:bg-[#7C3AED]/15'
                        : 'hover:bg-slate-50 dark:hover:bg-[#232347]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTopicId(topic.id)}
                        className="text-left min-w-0 flex-1"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {topic.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {subj?.name ?? 'Subject'} · {chap?.name ?? 'Chapter'} · Priority{' '}
                          {topic.priority}
                        </p>
                      </button>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <select
                          value={topic.status}
                          onChange={(e) =>
                            onUpdateTopic(topic.id, {
                              status: e.target.value as TopicStatus,
                              lastStudiedAt: getTodayISO(),
                            })
                          }
                          aria-label={`Status for ${topic.name}`}
                          className={`px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#17172F] text-xs font-semibold ${STATUS_STYLES[topic.status]}`}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-xs font-bold w-10 text-right text-slate-700 dark:text-slate-200">
                          {topic.masteryScore}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-[#17172F] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${topic.masteryScore}%`,
                            backgroundColor:
                              topic.masteryScore >= 80
                                ? '#22C55E'
                                : topic.masteryScore >= 50
                                  ? '#06B6D4'
                                  : '#EF4444',
                          }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        {topic.actualMinutes}/{topic.estimatedMinutes}m
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Topic Inspector & Session / Rating Logger */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-5">
          {!activeTopic ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a topic from the tracker to inspect ratings, notes, and log sessions.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-[#2A2A50] pb-4">
                <div>
                  <p className="text-xs font-medium text-[#06B6D4]">
                    {subjectMap.get(activeTopic.subjectId)?.name}
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeTopic.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                    Status: {activeTopic.status} · Mastery: {activeTopic.masteryScore}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTopic(activeTopic.id, {
                      status: 'Completed',
                      lastStudiedAt: getTodayISO(),
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9] shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Complete
                </button>
              </div>

              {/* Understanding, Confidence & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Understanding (1–5)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={activeTopic.understanding}
                    aria-label="Understanding rating"
                    onChange={(e) =>
                      onUpdateTopic(activeTopic.id, { understanding: Number(e.target.value) })
                    }
                    className="w-full accent-[#7C3AED]"
                  />
                  <span className="font-mono text-xs">{activeTopic.understanding}/5</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Confidence (1–5)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={activeTopic.confidence}
                    aria-label="Confidence rating"
                    onChange={(e) =>
                      onUpdateTopic(activeTopic.id, { confidence: Number(e.target.value) })
                    }
                    className="w-full accent-[#06B6D4]"
                  />
                  <span className="font-mono text-xs">{activeTopic.confidence}/5</span>
                </div>

                <div>
                  <label
                    htmlFor="topic-priority-sel"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Priority
                  </label>
                  <select
                    id="topic-priority-sel"
                    value={activeTopic.priority}
                    onChange={(e) =>
                      onUpdateTopic(activeTopic.id, {
                        priority: e.target.value as PriorityLevel,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Next Revision Schedule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="topic-next-rev"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Next Revision Date
                  </label>
                  <input
                    id="topic-next-rev"
                    type="date"
                    value={activeTopic.nextRevisionAt ?? ''}
                    onChange={(e) =>
                      onUpdateTopic(activeTopic.id, { nextRevisionAt: e.target.value || null })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Practice Accuracy
                  </p>
                  <p className="font-mono text-sm font-semibold py-1.5">
                    {activeTopic.practiceAttempted > 0
                      ? `${Math.round((activeTopic.practiceCorrect / activeTopic.practiceAttempted) * 100)}% (${activeTopic.practiceCorrect}/${activeTopic.practiceAttempted})`
                      : 'No practice logged'}
                  </p>
                </div>
              </div>

              {/* Quick Study Notes */}
              <div>
                <label
                  htmlFor="tracker-topic-notes"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Topic Study Notes
                </label>
                <textarea
                  id="tracker-topic-notes"
                  rows={3}
                  value={activeTopic.notes}
                  onChange={(e) => onUpdateTopic(activeTopic.id, { notes: e.target.value })}
                  placeholder="Record key takeaways, pitfalls, or memory hooks..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                />
              </div>

              {/* Log Study Session & Practice Result */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#2A2A50] space-y-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#06B6D4]" />
                  Log Study Session for this Topic
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={sessionMins}
                    onChange={(e) => setSessionMins(Number(e.target.value))}
                    aria-label="Session duration minutes"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
                  />
                  <select
                    value={sessionType}
                    onChange={(e) =>
                      setSessionType(e.target.value as StudySession['activityType'])
                    }
                    aria-label="Activity type"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                  >
                    <option value="Study">Study</option>
                    <option value="Revision">Revision</option>
                    <option value="Practice">Practice</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      onLogSession({
                        topicId: activeTopic.id,
                        subjectId: activeTopic.subjectId,
                        examId: activeTopic.examIds[0],
                        date: getTodayISO(),
                        durationMinutes: Math.max(5, sessionMins),
                        activityType: sessionType,
                        notes: sessionNotes.trim() || `Studied ${activeTopic.name}`,
                      });
                      setSessionNotes('');
                    }}
                    className="px-3 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold"
                  >
                    Log Time
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={practiceIncTotal}
                    onChange={(e) => setPracticeIncTotal(Number(e.target.value))}
                    aria-label="Questions attempted"
                    placeholder="Attempted"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    max={practiceIncTotal}
                    value={practiceIncCorrect}
                    onChange={(e) => setPracticeIncCorrect(Number(e.target.value))}
                    aria-label="Questions correct"
                    placeholder="Correct"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTopic(activeTopic.id, {
                        practiceAttempted:
                          activeTopic.practiceAttempted + Math.max(1, practiceIncTotal),
                        practiceCorrect:
                          activeTopic.practiceCorrect +
                          Math.min(Math.max(0, practiceIncCorrect), Math.max(1, practiceIncTotal)),
                        lastStudiedAt: getTodayISO(),
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white text-xs font-semibold"
                  >
                    Add Practice
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
