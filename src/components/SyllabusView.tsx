import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileUp,
  GitMerge,
  Globe,
  Loader2,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AppState,
  DifficultyLevel,
  ExtractedSyllabusDraft,
  Topic,
} from '../types/study';

interface SyllabusViewProps {
  state: AppState;
  onCommitDraft: (draft: ExtractedSyllabusDraft) => void;
  onAddSubject: (name: string, code: string, examIds: string[]) => void;
  onRenameSubject: (id: string, name: string) => void;
  onDeleteSubject: (id: string) => void;
  onReorderSubject: (id: string, dir: 'up' | 'down') => void;
  onMergeSubjects: (sourceId: string, targetId: string) => void;
  onAddChapter: (subjectId: string, unitId: string, name: string) => void;
  onRenameChapter: (id: string, name: string) => void;
  onDeleteChapter: (id: string) => void;
  onAddTopic: (payload: {
    subjectId: string;
    unitId: string;
    chapterId: string;
    name: string;
    difficulty?: DifficultyLevel;
    weightage?: number;
    estimatedMinutes?: number;
    examIds?: string[];
  }) => void;
  onUpdateTopic: (id: string, patch: Partial<Topic>) => void;
  onDeleteTopic: (id: string) => void;
  onSplitTopic: (id: string, names: string[]) => void;
  onMergeTopics: (sourceId: string, targetId: string) => void;
}

export const SyllabusView: React.FC<SyllabusViewProps> = ({
  state,
  onCommitDraft,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
  onReorderSubject,
  onMergeSubjects,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onSplitTopic,
  onMergeTopics,
}) => {
  const [importTab, setImportTab] = useState<'text' | 'file' | 'url'>('text');
  const [rawText, setRawText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mimeType: string;
    base64Data: string;
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtractedSyllabusDraft | null>(null);

  // Manual CRUD states
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newChapterBySubj, setNewChapterBySubj] = useState<Record<string, string>>({});
  const [newTopicByChap, setNewTopicByChap] = useState<Record<string, string>>({});
  const [splitTargetId, setSplitTargetId] = useState<string | null>(null);
  const [splitInput, setSplitInput] = useState('');
  const [mergeSubjSource, setMergeSubjSource] = useState('');
  const [mergeSubjTarget, setMergeSubjTarget] = useState('');
  const [mergeTopicSource, setMergeTopicSource] = useState('');
  const [mergeTopicTarget, setMergeTopicTarget] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      setSelectedFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data: res,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRunExtraction = async () => {
    setImportError(null);
    setExtracting(true);
    try {
      const payload =
        importTab === 'text'
          ? { mode: 'text', text: rawText }
          : importTab === 'url'
            ? { mode: 'url', url: importUrl }
            : {
                mode: 'file',
                fileName: selectedFile?.name,
                mimeType: selectedFile?.mimeType,
                base64Data: selectedFile?.base64Data,
              };

      const res = await fetch('/api/syllabus/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          courseName: state.profile.courseName,
          examNames: state.exams.map((e) => e.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse syllabus.');
      }
      setDraft(data.draft);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Syllabus extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const handleCommitDraft = () => {
    if (!draft) return;
    onCommitDraft(draft);
    setDraft(null);
    setRawText('');
    setImportUrl('');
    setSelectedFile(null);
  };

  const sortedSubjects = state.subjects.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* AI Multi-Format Syllabus Importer */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
              AI Syllabus Importer & Architect
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Import PDF, DOCX, XLSX, TXT, images, pasted text, or public website URLs. Review and edit the extracted hierarchy before saving.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-md p-0.5">
            {(['text', 'file', 'url'] as const).map((tab) => {
              const active = importTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setImportTab(tab)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                    active
                      ? 'text-white'
                      : 'text-slate-800 dark:text-slate-100 hover:bg-white/24 dark:hover:bg-white/10'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="syllabus-import-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                    />
                  )}
                  <span className="relative z-10">
                    {tab === 'text' ? 'Paste Text' : tab === 'file' ? 'Upload File' : 'Website URL'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {importTab === 'text' && (
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste course syllabus, exam modules, unit outlines, or chapter lists..."
            aria-label="Paste syllabus text"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
          />
        )}

        {importTab === 'file' && (
          <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] cursor-pointer hover:border-[#7C3AED]">
            <FileUp className="w-6 h-6 text-[#06B6D4]" />
            <span className="text-sm font-medium">
              {selectedFile
                ? `Selected: ${selectedFile.name}`
                : 'Choose PDF, DOCX, XLSX, TXT, PNG, or JPG'}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.txt,.md,.csv,image/*"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        )}

        {importTab === 'url' && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#06B6D4] shrink-0" />
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://example.edu/course-syllabus"
              aria-label="Public syllabus website URL"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
            />
          </div>
        )}

        {importError && (
          <div
            role="alert"
            className="px-4 py-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#EF4444]"
          >
            {importError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={extracting}
            onClick={handleRunExtraction}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#7C3AED] hover:bg-[#6D28D9] text-white disabled:opacity-50"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {extracting ? 'Extracting Hierarchy...' : 'Extract & Preview Syllabus'}
          </button>
        </div>

        {/* Editable Review Screen Before Saving */}
        {draft && (
          <div className="mt-4 p-5 rounded-xl border border-[#06B6D4]/40 bg-slate-50 dark:bg-[#17172F] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-[#06B6D4]">
                  Review Extracted Syllabus Before Saving
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rename or delete extracted subjects, chapters, and topics before committing to your workspace.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-[#2E2E58]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleCommitDraft}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#22C55E] text-white hover:bg-[#16A34A]"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save to Syllabus
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {draft.subjects.map((ds, sIdx) => (
                <div
                  key={sIdx}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ds.name}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.subjects[sIdx].name = e.target.value;
                        setDraft(next);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = structuredClone(draft);
                        next.subjects.splice(sIdx, 1);
                        setDraft(next);
                      }}
                      aria-label={`Remove extracted subject ${ds.name}`}
                      className="p-1.5 text-[#EF4444]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {ds.units.map((du, uIdx) => (
                    <div key={uIdx} className="pl-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-500">{du.name}</p>
                      {du.chapters.map((dc, cIdx) => (
                        <div key={cIdx} className="pl-3 space-y-1.5">
                          <p className="text-xs font-medium text-[#7C3AED]">{dc.name}</p>
                          {dc.topics.map((dt, tIdx) => (
                            <div key={tIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={dt.name}
                                onChange={(e) => {
                                  const next = structuredClone(draft);
                                  next.subjects[sIdx].units[uIdx].chapters[cIdx].topics[tIdx].name =
                                    e.target.value;
                                  setDraft(next);
                                }}
                                className="flex-1 px-2 py-1 rounded border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                              />
                              <span className="font-mono text-[11px] text-slate-400">
                                {dt.difficulty} · {dt.estimatedMinutes}m
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = structuredClone(draft);
                                  next.subjects[sIdx].units[uIdx].chapters[cIdx].topics.splice(
                                    tIdx,
                                    1
                                  );
                                  setDraft(next);
                                }}
                                aria-label={`Delete draft topic ${dt.name}`}
                                className="text-xs text-[#EF4444]"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Manual Syllabus Structure & Merge/Split Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Add New Subject
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Subject name (e.g. Corporate Finance)"
              aria-label="New subject name"
              className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
            />
            <input
              type="text"
              value={newSubjectCode}
              onChange={(e) => setNewSubjectCode(e.target.value)}
              placeholder="Code (CF-201)"
              aria-label="New subject code"
              className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => {
                if (!newSubjectName.trim()) return;
                onAddSubject(
                  newSubjectName.trim(),
                  newSubjectCode.trim(),
                  state.exams.map((e) => e.id)
                );
                setNewSubjectName('');
                setNewSubjectCode('');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <GitMerge className="w-4 h-4 text-[#06B6D4]" />
            Merge Subjects or Topics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={mergeSubjSource}
              onChange={(e) => setMergeSubjSource(e.target.value)}
              aria-label="Source subject to merge"
              className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="">Source subject...</option>
              {sortedSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={mergeSubjTarget}
              onChange={(e) => setMergeSubjTarget(e.target.value)}
              aria-label="Target subject to merge into"
              className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="">Into target...</option>
              {sortedSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (mergeSubjSource && mergeSubjTarget && mergeSubjSource !== mergeSubjTarget) {
                  onMergeSubjects(mergeSubjSource, mergeSubjTarget);
                  setMergeSubjSource('');
                  setMergeSubjTarget('');
                }
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10"
            >
              Merge Subjects
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={mergeTopicSource}
              onChange={(e) => setMergeTopicSource(e.target.value)}
              aria-label="Source topic to merge"
              className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="">Source topic...</option>
              {state.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={mergeTopicTarget}
              onChange={(e) => setMergeTopicTarget(e.target.value)}
              aria-label="Target topic to merge into"
              className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="">Into topic...</option>
              {state.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (mergeTopicSource && mergeTopicTarget && mergeTopicSource !== mergeTopicTarget) {
                  onMergeTopics(mergeTopicSource, mergeTopicTarget);
                  setMergeTopicSource('');
                  setMergeTopicTarget('');
                }
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-[#7C3AED]/40 text-[#7C3AED] hover:bg-[#7C3AED]/10"
            >
              Merge Topics
            </button>
          </div>
        </div>
      </div>

      {/* Hierarchical Syllabus Editor */}
      {sortedSubjects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No subjects in your syllabus yet. Import a syllabus above or add your first subject.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedSubjects.map((subj, sIdx) => {
            const subjUnits = state.units.filter((u) => u.subjectId === subj.id);
            const subjChapters = state.chapters.filter((c) => c.subjectId === subj.id);
            const defaultUnitId = subjUnits[0]?.id ?? '';

            return (
              <section
                key={subj.id}
                className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#2A2A50]">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: subj.color }}
                    />
                    <input
                      type="text"
                      value={subj.name}
                      aria-label={`Subject name ${subj.name}`}
                      onChange={(e) => onRenameSubject(subj.id, e.target.value)}
                      className="font-display text-base font-bold bg-transparent border-b border-transparent focus:border-[#7C3AED] focus:outline-none min-w-0 flex-1"
                    />
                    <span className="font-mono text-xs text-slate-400 shrink-0">{subj.code}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onReorderSubject(subj.id, 'up')}
                      disabled={sIdx === 0}
                      aria-label={`Move ${subj.name} up`}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorderSubject(subj.id, 'down')}
                      disabled={sIdx === sortedSubjects.length - 1}
                      aria-label={`Move ${subj.name} down`}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSubject(subj.id)}
                      aria-label={`Delete subject ${subj.name}`}
                      className="p-1.5 rounded-lg text-[#EF4444] hover:bg-[#EF4444]/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Chapters & Topics inside Subject */}
                <div className="space-y-4">
                  {subjChapters.map((chap) => {
                    const chapTopics = state.topics.filter((t) => t.chapterId === chap.id);
                    return (
                      <div
                        key={chap.id}
                        className="pl-4 border-l border-slate-200 dark:border-[#2E2E58] space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={chap.name}
                            aria-label={`Chapter name ${chap.name}`}
                            onChange={(e) => onRenameChapter(chap.id, e.target.value)}
                            className="text-sm font-semibold text-[#06B6D4] bg-transparent border-b border-transparent focus:border-[#06B6D4] focus:outline-none flex-1 min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => onDeleteChapter(chap.id)}
                            aria-label={`Delete chapter ${chap.name}`}
                            className="text-xs text-[#EF4444] hover:underline"
                          >
                            Delete Chapter
                          </button>
                        </div>

                        <div className="space-y-2">
                          {chapTopics.map((topic) => (
                            <div
                              key={topic.id}
                              className="p-3 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={topic.name}
                                  aria-label={`Topic name ${topic.name}`}
                                  onChange={(e) =>
                                    onUpdateTopic(topic.id, { name: e.target.value })
                                  }
                                  className="flex-1 min-w-[180px] text-sm font-medium bg-transparent border-b border-transparent focus:border-[#7C3AED] focus:outline-none"
                                />
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <select
                                    value={topic.difficulty}
                                    aria-label={`Difficulty for ${topic.name}`}
                                    onChange={(e) =>
                                      onUpdateTopic(topic.id, {
                                        difficulty: e.target.value as DifficultyLevel,
                                      })
                                    }
                                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs"
                                  >
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                  </select>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={topic.weightage}
                                    aria-label={`Weightage for ${topic.name}`}
                                    title="Weightage"
                                    onChange={(e) =>
                                      onUpdateTopic(topic.id, {
                                        weightage: Number(e.target.value),
                                      })
                                    }
                                    className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs font-mono"
                                  />
                                  <input
                                    type="number"
                                    min={10}
                                    max={600}
                                    value={topic.estimatedMinutes}
                                    aria-label={`Estimated minutes for ${topic.name}`}
                                    title="Estimated minutes"
                                    onChange={(e) =>
                                      onUpdateTopic(topic.id, {
                                        estimatedMinutes: Number(e.target.value),
                                      })
                                    }
                                    className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSplitTargetId(
                                        splitTargetId === topic.id ? null : topic.id
                                      );
                                      setSplitInput(`${topic.name} (Part A), ${topic.name} (Part B)`);
                                    }}
                                    title="Split topic"
                                    aria-label={`Split topic ${topic.name}`}
                                    className="p-1 text-slate-400 hover:text-[#06B6D4]"
                                  >
                                    <Scissors className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTopic(topic.id)}
                                    aria-label={`Delete topic ${topic.name}`}
                                    className="p-1 text-slate-400 hover:text-[#EF4444]"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Associated Exams toggles for overlap */}
                              {state.exams.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>Exams:</span>
                                  {state.exams.map((ex) => {
                                    const checked = topic.examIds.includes(ex.id);
                                    return (
                                      <label key={ex.id} className="inline-flex items-center gap-1 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            const nextIds = checked
                                              ? topic.examIds.filter((id) => id !== ex.id)
                                              : [...topic.examIds, ex.id];
                                            onUpdateTopic(topic.id, { examIds: nextIds });
                                          }}
                                          className="accent-[#7C3AED]"
                                        />
                                        <span>{ex.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}

                              {splitTargetId === topic.id && (
                                <div className="flex gap-2 pt-2">
                                  <input
                                    type="text"
                                    value={splitInput}
                                    onChange={(e) => setSplitInput(e.target.value)}
                                    placeholder="Comma-separated split topic titles"
                                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSplitTopic(topic.id, splitInput.split(','));
                                      setSplitTargetId(null);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-[#06B6D4] text-white text-xs font-semibold"
                                  >
                                    Confirm Split
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Add Topic inline */}
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={newTopicByChap[chap.id] ?? ''}
                              onChange={(e) =>
                                setNewTopicByChap((prev) => ({
                                  ...prev,
                                  [chap.id]: e.target.value,
                                }))
                              }
                              placeholder="Add topic to this chapter..."
                              aria-label={`New topic in ${chap.name}`}
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const name = (newTopicByChap[chap.id] ?? '').trim();
                                if (!name) return;
                                onAddTopic({
                                  subjectId: subj.id,
                                  unitId: chap.unitId,
                                  chapterId: chap.id,
                                  name,
                                  examIds: subj.examIds,
                                });
                                setNewTopicByChap((prev) => ({ ...prev, [chap.id]: '' }));
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold hover:bg-[#6D28D9]"
                            >
                              + Topic
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Chapter inline */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChapterBySubj[subj.id] ?? ''}
                      onChange={(e) =>
                        setNewChapterBySubj((prev) => ({ ...prev, [subj.id]: e.target.value }))
                      }
                      placeholder="Add chapter to subject..."
                      aria-label={`New chapter in ${subj.name}`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = (newChapterBySubj[subj.id] ?? '').trim();
                        if (!name || !defaultUnitId) return;
                        onAddChapter(subj.id, defaultUnitId, name);
                        setNewChapterBySubj((prev) => ({ ...prev, [subj.id]: '' }));
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#06B6D4]"
                    >
                      + Chapter
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
