import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AppState,
  MistakeEntry,
  MistakeType,
  Topic,
  UploadedResource,
} from '../types/study';

interface NotesViewProps {
  state: AppState;
  onUpdateTopic: (id: string, patch: Partial<Topic>) => void;
  onUpdateMistake: (id: string, patch: Partial<MistakeEntry>) => void;
  onAddResource: (res: Omit<UploadedResource, 'id' | 'uploadedAt'>) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  state,
  onUpdateTopic,
  onUpdateMistake,
  onAddResource,
}) => {
  const [tab, setTab] = useState<'workspace' | 'mistakes' | 'bookmarks' | 'resources'>(
    'workspace'
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string>(state.topics[0]?.id ?? '');

  // Resource uploader
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState<UploadedResource['type']>('Note');
  const [resContent, setResContent] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [aiSummaryOutput, setAiSummaryOutput] = useState<string | null>(null);

  const activeTopic = useMemo(
    () => state.topics.find((t) => t.id === selectedTopicId) ?? state.topics[0] ?? null,
    [state.topics, selectedTopicId]
  );

  const bookmarkedQuestions = useMemo(
    () => state.questions.filter((q) => q.bookmarked),
    [state.questions]
  );

  const handleSummarizeTopic = async () => {
    if (!activeTopic) return;
    setSummaryError(null);
    setSummarizing(true);
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'summarize',
          message: `Create a concise high-yield revision summary and key formula checklist for "${activeTopic.name}". Incorporate these notes if helpful:\n${activeTopic.notes}\n${activeTopic.formulas}\n${activeTopic.definitions}`,
          context: {
            course: state.profile.courseName,
            topic: activeTopic.name,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summary failed.');
      setAiSummaryOutput(data.reply);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Unable to summarize.');
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap rounded-xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-md p-1">
        {(
          [
            ['workspace', 'Topic Workspace'],
            ['mistakes', `Mistake Notebook (${state.mistakes.length})`],
            ['bookmarks', `Bookmarked Questions (${bookmarkedQuestions.length})`],
            ['resources', `Resources (${state.resources.length})`],
          ] as const
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                active
                  ? 'text-white'
                  : 'text-slate-800 dark:text-slate-100 hover:bg-white/24 dark:hover:bg-white/10'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="notes-tab-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'workspace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-4 space-y-2 max-h-[600px] overflow-y-auto">
            <h2 className="font-display text-sm font-bold px-2 pb-2 border-b border-slate-100 dark:border-[#2A2A50]">
              Select Topic Notebook
            </h2>
            {state.topics.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">No topics created yet.</p>
            ) : (
              state.topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTopicId(t.id);
                    setAiSummaryOutput(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors ${
                    activeTopic?.id === t.id
                      ? 'bg-[#7C3AED] text-white font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-[#232347]'
                  }`}
                >
                  <p className="truncate">{t.name}</p>
                  <p className="text-[11px] opacity-75 font-mono">
                    Revisions: {t.revisionCount} · Mastery {t.masteryScore}%
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-4">
            {!activeTopic ? (
              <p className="text-sm text-slate-500">Create a topic in Syllabus first to manage notes.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#2A2A50] pb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">{activeTopic.name}</h2>
                    <p className="text-xs font-mono text-slate-500">
                      Last studied: {activeTopic.lastStudiedAt ?? 'Never'} · Revisions:{' '}
                      {activeTopic.revisionCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={summarizing}
                    onClick={handleSummarizeTopic}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#06B6D4] hover:bg-[#0891B2] text-white disabled:opacity-50"
                  >
                    {summarizing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    AI Summary
                  </button>
                </div>

                {summaryError && (
                  <p role="alert" className="text-xs text-[#EF4444]">
                    {summaryError}
                  </p>
                )}

                {aiSummaryOutput && (
                  <div className="p-4 rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/10 text-xs space-y-1.5">
                    <p className="font-semibold text-[#06B6D4]">AI-Generated Summary</p>
                    <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100 leading-relaxed">
                      {aiSummaryOutput}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Study Notes</label>
                    <textarea
                      rows={5}
                      value={activeTopic.notes}
                      onChange={(e) => onUpdateTopic(activeTopic.id, { notes: e.target.value })}
                      placeholder="Write structured notes..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Formula Sheet</label>
                    <textarea
                      rows={5}
                      value={activeTopic.formulas}
                      onChange={(e) => onUpdateTopic(activeTopic.id, { formulas: e.target.value })}
                      placeholder="Key equations, derivations, and units..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Key Definitions</label>
                    <textarea
                      rows={4}
                      value={activeTopic.definitions}
                      onChange={(e) =>
                        onUpdateTopic(activeTopic.id, { definitions: e.target.value })
                      }
                      placeholder="Precise definitions..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Important Concepts & Traps
                    </label>
                    <textarea
                      rows={4}
                      value={activeTopic.importantConcepts}
                      onChange={(e) =>
                        onUpdateTopic(activeTopic.id, { importantConcepts: e.target.value })
                      }
                      placeholder="Exam traps, distinctions, edge cases..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'mistakes' && (
        <div className="space-y-4">
          {state.mistakes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center text-sm text-slate-500">
              No entries in your Mistake Notebook yet. Wrong answers from Mock Tests or Practice appear here.
            </div>
          ) : (
            state.mistakes.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex-1">
                    {m.questionStatement}
                  </p>
                  <button
                    type="button"
                    onClick={() => onUpdateMistake(m.id, { resolved: !m.resolved })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      m.resolved
                        ? 'bg-[#22C55E]/15 text-[#22C55E]'
                        : 'border border-slate-200 dark:border-[#2E2E58]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {m.resolved ? 'Resolved' : 'Mark Resolved'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <p className="p-2.5 rounded-xl bg-[#EF4444]/10 text-[#EF4444]">
                    Your Answer: {m.userAnswer}
                  </p>
                  <p className="p-2.5 rounded-xl bg-[#22C55E]/10 text-[#22C55E]">
                    Correct Answer: {m.correctAnswer}
                  </p>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">{m.explanation}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <select
                    value={m.mistakeType}
                    onChange={(e) =>
                      onUpdateMistake(m.id, { mistakeType: e.target.value as MistakeType })
                    }
                    aria-label="Mistake category"
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                  >
                    <option value="Conceptual Gap">Conceptual Gap</option>
                    <option value="Calculation Error">Calculation Error</option>
                    <option value="Misread Prompt">Misread Prompt</option>
                    <option value="Formula Recall">Formula Recall</option>
                    <option value="Time Pressure">Time Pressure</option>
                  </select>
                  <input
                    type="text"
                    value={m.correctiveAction}
                    onChange={(e) =>
                      onUpdateMistake(m.id, { correctiveAction: e.target.value })
                    }
                    placeholder="Corrective revision action..."
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'bookmarks' && (
        <div className="space-y-3">
          {bookmarkedQuestions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center text-sm text-slate-500">
              No bookmarked questions yet. Bookmark tricky questions in Practice Centre.
            </div>
          ) : (
            bookmarkedQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs text-[#FACC15]">
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{q.sourceLabel}</span>
                </div>
                <p className="text-sm font-medium">{q.statement}</p>
                <p className="text-xs text-[#22C55E] font-mono">Answer: {q.correctAnswer}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{q.solution}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'resources' && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!resTitle.trim()) return;
              onAddResource({
                title: resTitle.trim(),
                type: resType,
                topicId: activeTopic?.id,
                subjectId: activeTopic?.subjectId,
                contentSnippet: resContent.trim(),
              });
              setResTitle('');
              setResContent('');
            }}
            className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3"
          >
            <h3 className="font-display text-sm font-bold">Save Study Resource / Document Reference</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="Resource title or URL label"
                className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              />
              <select
                value={resType}
                onChange={(e) => setResType(e.target.value as UploadedResource['type'])}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              >
                <option value="Note">Note</option>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="URL">Website URL</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={resContent}
              onChange={(e) => setResContent(e.target.value)}
              placeholder="Paste excerpt, link, or reference summary..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Resource
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.resources.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-semibold text-[#06B6D4]">
                    <FileText className="w-3.5 h-3.5" />
                    {r.type}
                  </span>
                  <span className="font-mono">{r.uploadedAt}</span>
                </div>
                <p className="text-sm font-bold">{r.title}</p>
                {r.summary && <p className="text-xs text-slate-600 dark:text-slate-300">{r.summary}</p>}
                {r.contentSnippet && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.contentSnippet}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
