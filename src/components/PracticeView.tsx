import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  FileText,
  Flag,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AppState,
  DifficultyLevel,
  MistakeEntry,
  Question,
  QuestionSource,
  QuestionType,
} from '../types/study';
import {
  materializeImportedQuestions,
  parseQuestionsAuto,
  type ParsedQuestionDraft,
} from '../utils/questionImport';

interface PracticeViewProps {
  state: AppState;
  onAddQuestions: (qs: Array<Omit<Question, 'id'>>) => void;
  onToggleBookmark: (id: string) => void;
  onReportIssue: (id: string, issue: string) => void;
  onRecordAttempt: (questionId: string, isCorrect: boolean) => void;
  onAddMistake: (entry: Omit<MistakeEntry, 'id' | 'createdAt'>) => void;
}

const SOURCE_LABELS: Record<QuestionSource, string> = {
  verified_pyq: 'Verified PYQ',
  user_uploaded: 'My Uploaded Question',
  ai_generated: 'AI-Generated Practice',
};

const SAMPLE_BULK_TEXT = `1. Which measure captures second-order interest rate sensitivity for an option-free bond?
A) Macaulay Duration
B) Modified Duration
C) Convexity
D) Current Yield
Answer: C
Explanation: Convexity adjusts the linear duration approximation for bond price curvature.

2. Under a two-tailed hypothesis test at alpha = 0.05, when is H0 rejected?
A) Whenever p-value > 0.05
B) Whenever p-value < 0.05
C) Only if sample size < 30
D) Whenever standard error = 0
Answer: B
Explanation: A p-value strictly below alpha leads to rejection of the null hypothesis.`;

export const PracticeView: React.FC<PracticeViewProps> = ({
  state,
  onAddQuestions,
  onToggleBookmark,
  onReportIssue,
  onRecordAttempt,
  onAddMistake,
}) => {
  const [filterExam, setFilterExam] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTopic, setFilterTopic] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState<'all' | QuestionSource>('all');
  const [filterYear, setFilterYear] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Add single question drawer
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState<QuestionSource>('user_uploaded');
  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(state.subjects[0]?.id ?? '');
  const [newTopicId, setNewTopicId] = useState('');
  const [newExamId, setNewExamId] = useState(state.exams[0]?.id ?? '');
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>('Medium');
  const [newType, setNewType] = useState<QuestionType>('MCQ');
  const [newStatement, setNewStatement] = useState('');
  const [newOptions, setNewOptions] = useState('Option A | Option B | Option C | Option D');
  const [newCorrect, setNewCorrect] = useState('Option A');
  const [newSolution, setNewSolution] = useState('');

  // Bulk file / text import drawer
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkDrafts, setBulkDrafts] = useState<ParsedQuestionDraft[]>([]);
  const [bulkSource, setBulkSource] = useState<'user_uploaded' | 'verified_pyq'>('user_uploaded');
  const [bulkSourceLabel, setBulkSourceLabel] = useState('My Uploaded Question Set');
  const [bulkDefaultYear, setBulkDefaultYear] = useState('');
  const [bulkSubjectId, setBulkSubjectId] = useState(state.subjects[0]?.id ?? '');
  const [bulkTopicId, setBulkTopicId] = useState('');
  const [bulkExamId, setBulkExamId] = useState(state.exams[0]?.id ?? '');
  const [bulkParsingAi, setBulkParsingAi] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Question Generator
  const [aiTopicId, setAiTopicId] = useState(state.topics[0]?.id ?? '');
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyLevel>('Medium');
  const [aiCount, setAiCount] = useState(3);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map(state.subjects.map((s) => [s.id, s])),
    [state.subjects]
  );
  const topicMap = useMemo(
    () => new Map(state.topics.map((t) => [t.id, t])),
    [state.topics]
  );

  const sourceCounts = useMemo(() => {
    let userUploaded = 0;
    let verifiedPyq = 0;
    let aiGenerated = 0;
    for (const q of state.questions) {
      if (q.source === 'user_uploaded') userUploaded += 1;
      else if (q.source === 'verified_pyq') verifiedPyq += 1;
      else if (q.source === 'ai_generated') aiGenerated += 1;
    }
    return {
      all: state.questions.length,
      user_uploaded: userUploaded,
      verified_pyq: verifiedPyq,
      ai_generated: aiGenerated,
    };
  }, [state.questions]);

  const filteredQuestions = useMemo(() => {
    return state.questions.filter((q) => {
      if (filterExam !== 'all' && q.examId !== filterExam) return false;
      if (filterSubject !== 'all' && q.subjectId !== filterSubject) return false;
      if (filterTopic !== 'all' && q.topicId !== filterTopic) return false;
      if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
      if (filterType !== 'all' && q.questionType !== filterType) return false;
      if (filterSource !== 'all' && q.source !== filterSource) return false;
      if (filterYear.trim() && (q.year || '') !== filterYear.trim()) return false;
      if (bookmarkedOnly && !q.bookmarked) return false;
      return true;
    });
  }, [
    state.questions,
    filterExam,
    filterSubject,
    filterTopic,
    filterDifficulty,
    filterType,
    filterSource,
    filterYear,
    bookmarkedOnly,
  ]);

  const handleCheckAnswer = (q: Question) => {
    const ans = (selectedAnswers[q.id] ?? '').trim();
    if (!ans) return;
    const isCorrect = ans.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    setCheckedIds((prev) => ({ ...prev, [q.id]: true }));
    onRecordAttempt(q.id, isCorrect);
  };

  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatement.trim() || !newCorrect.trim()) return;
    const opts =
      newType === 'MCQ'
        ? newOptions
            .split('|')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    onAddQuestions([
      {
        statement: newStatement.trim(),
        options: opts,
        correctAnswer: newCorrect.trim(),
        solution: newSolution.trim() || `Correct answer: ${newCorrect.trim()}`,
        explanation: newSolution.trim() || 'Added by user.',
        difficulty: newDifficulty,
        subjectId: newSubjectId || state.subjects[0]?.id || 'general',
        topicId: newTopicId || undefined,
        examId: newExamId || undefined,
        year: newSource === 'verified_pyq' ? newYear.trim() || undefined : undefined,
        marks: 4,
        negativeMarks: 1,
        questionType: newType,
        source: newSource,
        sourceLabel:
          newSourceLabel.trim() ||
          (newSource === 'verified_pyq'
            ? `User-Verified PYQ (${newYear.trim() || 'Paper'})`
            : 'User Uploaded Question'),
        bookmarked: false,
      },
    ]);
    setNewStatement('');
    setNewSolution('');
    setShowAddForm(false);
    setImportNotice('Added 1 question to your Practice Centre bank.');
  };

  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkError(null);
    try {
      const content = await file.text();
      setBulkFileName(file.name);
      setBulkText(content);
      const { drafts } = parseQuestionsAuto(content, file.name);
      setBulkDrafts(drafts);
      if (drafts.length === 0) {
        setBulkError(
          'No structured Q&A rows matched automatically. Try "Smart Extract with AI" for unstructured notes or check format.'
        );
      }
    } catch {
      setBulkError('Could not read the selected file.');
    }
    e.target.value = '';
  };

  const handleParseBulkText = () => {
    setBulkError(null);
    if (!bulkText.trim()) {
      setBulkError('Paste question text or upload a .txt, .csv, or .json file first.');
      return;
    }
    const { drafts } = parseQuestionsAuto(bulkText, bulkFileName);
    setBulkDrafts(drafts);
    if (drafts.length === 0) {
      setBulkError(
        'Could not detect numbered MCQs/CSV/JSON rows cleanly. Try "Smart Extract with AI" below.'
      );
    }
  };

  const handleAiParseBulkText = async () => {
    setBulkError(null);
    if (!bulkText.trim()) {
      setBulkError('Paste raw questions or notes before extracting.');
      return;
    }
    setBulkParsingAi(true);
    try {
      const subject = state.subjects.find((s) => s.id === bulkSubjectId);
      const topic = state.topics.find((t) => t.id === bulkTopicId);
      const res = await fetch('/api/questions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: bulkText,
          subjectName: subject?.name,
          topicName: topic?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI parsing failed.');

      const extracted: ParsedQuestionDraft[] = (data.questions || [])
        .map((item: Record<string, unknown>, idx: number): ParsedQuestionDraft | null => {
          const statement = String(item.statement || '').trim();
          if (!statement) return null;
          const options = Array.isArray(item.options)
            ? item.options.map((o) => String(o).trim()).filter(Boolean)
            : [];
          const correctAnswer = String(item.correctAnswer || options[0] || '').trim();
          const diff =
            item.difficulty === 'Easy' || item.difficulty === 'Hard'
              ? item.difficulty
              : 'Medium';
          const qType =
            item.questionType === 'Numerical' ||
            item.questionType === 'Conceptual' ||
            item.questionType === 'Descriptive' ||
            item.questionType === 'MCQ'
              ? item.questionType
              : options.length >= 2
                ? 'MCQ'
                : 'Conceptual';

          return {
            tempId: `ai-imp-${Date.now().toString(36)}-${idx}`,
            selected: true,
            statement,
            options,
            correctAnswer,
            solution: String(item.solution || item.explanation || ''),
            explanation: String(item.explanation || item.solution || 'Extracted from uploaded notes.'),
            difficulty: diff,
            questionType: qType,
            year: item.year ? String(item.year).trim() : undefined,
          };
        })
        .filter((d: ParsedQuestionDraft | null): d is ParsedQuestionDraft => Boolean(d));

      if (extracted.length === 0) {
        setBulkError('No clear questions were found in the pasted text.');
      } else {
        setBulkDrafts(extracted);
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Smart AI extraction failed.');
    } finally {
      setBulkParsingAi(false);
    }
  };

  const handleCommitBulkDrafts = () => {
    const materialized = materializeImportedQuestions({
      drafts: bulkDrafts,
      subjectId: bulkSubjectId || state.subjects[0]?.id || 'general',
      topicId: bulkTopicId || undefined,
      examId: bulkExamId || undefined,
      source: bulkSource,
      sourceLabel: bulkSourceLabel,
      defaultYear: bulkDefaultYear,
    });
    if (materialized.length === 0) {
      setBulkError('Select at least one valid question with both statement and answer.');
      return;
    }
    onAddQuestions(materialized);
    setBulkDrafts([]);
    setBulkText('');
    setBulkFileName('');
    setShowBulkImport(false);
    setFilterSource(bulkSource);
    setImportNotice(
      `Imported ${materialized.length} ${
        materialized.length === 1 ? 'question' : 'questions'
      } into "${bulkSource === 'verified_pyq' ? 'Verified PYQs' : 'My Uploaded'}".`
    );
  };

  const handleGenerateAiQuestions = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const topic = state.topics.find((t) => t.id === aiTopicId);
      const subject = state.subjects.find(
        (s) => s.id === (topic?.subjectId || state.subjects[0]?.id)
      );
      const exam = state.exams.find((e) => e.id === (topic?.examIds[0] || state.exams[0]?.id));

      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: state.profile.courseName,
          examName: exam?.name,
          subjectName: subject?.name,
          topicName: topic?.name,
          difficulty: aiDifficulty,
          questionType: 'MCQ',
          count: aiCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions.');

      const created: Array<Omit<Question, 'id'>> = (data.questions || []).map(
        (item: Record<string, unknown>) => ({
          statement: String(item.statement || ''),
          options: Array.isArray(item.options) ? item.options.map(String) : undefined,
          correctAnswer: String(item.correctAnswer || ''),
          solution: String(item.solution || ''),
          explanation: String(item.explanation || ''),
          difficulty:
            item.difficulty === 'Easy' || item.difficulty === 'Hard'
              ? item.difficulty
              : aiDifficulty,
          subjectId: subject?.id || state.subjects[0]?.id || 'general',
          topicId: topic?.id,
          examId: exam?.id,
          marks: Number(item.marks) || 4,
          negativeMarks: 1,
          questionType: 'MCQ',
          source: 'ai_generated',
          sourceLabel: 'AI-Generated Practice (Not a PYQ)',
          bookmarked: false,
        })
      );
      if (created.length > 0) {
        onAddQuestions(created);
        setFilterSource('ai_generated');
        setImportNotice(
          `Added ${created.length} AI-Generated Practice questions (clearly labeled Not a PYQ).`
        );
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Question generation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const selectedBulkCount = bulkDrafts.filter(
    (d) => d.selected && d.statement.trim() && d.correctAnswer.trim()
  ).length;

  return (
    <div className="space-y-6">
      {/* Honest Attribution & Upload Action Banner */}
      <div className="p-4 rounded-2xl border border-[#FACC15]/35 bg-[#FACC15]/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <AlertTriangle className="w-5 h-5 text-[#D97706] dark:text-[#FACC15] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
              Practice Question Bank · {sourceCounts.user_uploaded} My Uploaded ·{' '}
              {sourceCounts.verified_pyq} Verified PYQs · {sourceCounts.ai_generated} AI Practice
            </p>
            <p className="text-slate-700 dark:text-slate-300">
              Your uploaded questions and verified exam papers stay clearly separated from AI-generated practice drills. Study Buddy never fabricates historical exam years.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="open-bulk-import-btn"
            onClick={() => {
              setShowBulkImport((v) => !v);
              setShowAddForm(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              showBulkImport
                ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                : 'border-[#7C3AED]/45 bg-[#7C3AED]/15 text-[#5B21B6] dark:text-[#DDD6FE] hover:bg-[#7C3AED]/25'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk File / Text Import
          </button>

          <button
            type="button"
            data-testid="open-manual-question-btn"
            onClick={() => {
              setNewSource('user_uploaded');
              setShowAddForm((v) => !v);
              setShowBulkImport(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Single Question
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="px-4 py-3 rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/12 flex items-center justify-between gap-2 text-xs text-[#15803D] dark:text-[#4ADE80]">
          <span className="font-semibold inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {importNotice}
          </span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded hover:bg-[#22C55E]/15"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bulk File / Text Importer Drawer */}
      {showBulkImport && (
        <section
          data-testid="bulk-question-importer"
          className="rounded-2xl border border-[#7C3AED]/45 bg-white/80 dark:bg-[#1A1A36]/78 backdrop-blur-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#7C3AED]" />
                Bulk Import Your Questions (.txt, .csv, .json or pasted list)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Upload a sheet or paste questions below, inspect extracted drafts, and save them into My Uploaded or Verified PYQs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkImport(false)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.json,.md"
              onChange={handleBulkFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-semibold hover:border-[#7C3AED]"
            >
              <Upload className="w-3.5 h-3.5" />
              Choose File (.txt, .csv, .json)
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkFileName('sample_questions.txt');
                setBulkText(SAMPLE_BULK_TEXT);
                setBulkDrafts(parseQuestionsAuto(SAMPLE_BULK_TEXT, 'sample_questions.txt').drafts);
                setBulkError(null);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-medium hover:border-[#06B6D4]"
            >
              Load Example Format
            </button>
            {bulkFileName && (
              <span className="text-xs font-mono text-[#06B6D4]">Loaded: {bulkFileName}</span>
            )}
          </div>

          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Paste numbered MCQs (e.g.\n1. Question text?\nA) Choice 1\nB) Choice 2\nC) Choice 3\nD) Choice 4\nAnswer: B\n), CSV rows, or JSON...`}
            aria-label="Bulk questions text input"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              data-testid="parse-bulk-text-btn"
              onClick={handleParseBulkText}
              className="px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold"
            >
              Parse Structured Text / File
            </button>
            <button
              type="button"
              disabled={bulkParsingAi || !bulkText.trim()}
              onClick={handleAiParseBulkText}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#06B6D4]/45 bg-[#06B6D4]/12 text-[#0891B2] dark:text-[#67E8F9] hover:bg-[#06B6D4]/20 text-xs font-semibold disabled:opacity-45"
            >
              {bulkParsingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Smart Extract with AI
            </button>
          </div>

          {bulkError && (
            <p role="alert" className="text-xs text-[#EF4444]">
              {bulkError}
            </p>
          )}

          {bulkDrafts.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-[#2E2E58] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <select
                  value={bulkSource}
                  onChange={(e) =>
                    setBulkSource(e.target.value as 'user_uploaded' | 'verified_pyq')
                  }
                  aria-label="Batch question source"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                >
                  <option value="user_uploaded">My Uploaded Questions</option>
                  <option value="verified_pyq">Verified PYQ Paper</option>
                </select>
                <input
                  type="text"
                  value={bulkSourceLabel}
                  onChange={(e) => setBulkSourceLabel(e.target.value)}
                  placeholder="Source label (e.g. Coaching Sheet 2)"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                />
                {bulkSource === 'verified_pyq' && (
                  <input
                    type="text"
                    value={bulkDefaultYear}
                    onChange={(e) => setBulkDefaultYear(e.target.value)}
                    placeholder="PYQ Year"
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
                  />
                )}
                <select
                  value={bulkSubjectId}
                  onChange={(e) => setBulkSubjectId(e.target.value)}
                  aria-label="Batch subject"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                >
                  {state.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bulkTopicId}
                  onChange={(e) => setBulkTopicId(e.target.value)}
                  aria-label="Batch topic"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                >
                  <option value="">Any Topic...</option>
                  {state.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bulkExamId}
                  onChange={(e) => setBulkExamId(e.target.value)}
                  aria-label="Batch exam"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                >
                  <option value="">Any Exam</option>
                  {state.exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {bulkDrafts.map((draft, idx) => (
                  <div
                    key={draft.tempId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] space-y-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setBulkDrafts((prev) =>
                            prev.map((d) =>
                              d.tempId === draft.tempId ? { ...d, selected: !d.selected } : d
                            )
                          )
                        }
                        aria-label={`Include parsed question ${idx + 1}`}
                        className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          draft.selected
                            ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                            : 'border-slate-400'
                        }`}
                      >
                        {draft.selected && <Check className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0 space-y-2">
                        <input
                          type="text"
                          value={draft.statement}
                          onChange={(e) =>
                            setBulkDrafts((prev) =>
                              prev.map((d) =>
                                d.tempId === draft.tempId
                                  ? { ...d, statement: e.target.value }
                                  : d
                              )
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#13132B] text-xs font-medium"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-mono text-slate-500">
                            {draft.questionType} · {draft.difficulty}
                          </span>
                          {draft.options.length > 0 && (
                            <span className="text-slate-600 dark:text-slate-300 truncate">
                              Options: {draft.options.join(' | ')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-[11px] font-semibold text-slate-500">
                            Answer:
                          </label>
                          <input
                            type="text"
                            value={draft.correctAnswer}
                            onChange={(e) =>
                              setBulkDrafts((prev) =>
                                prev.map((d) =>
                                  d.tempId === draft.tempId
                                    ? { ...d, correctAnswer: e.target.value }
                                    : d
                                )
                              )
                            }
                            className="flex-1 min-w-[160px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#13132B] text-xs font-mono text-[#16A34A] dark:text-[#4ADE80]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {selectedBulkCount} of {bulkDrafts.length} parsed questions ready to save
                </p>
                <button
                  type="button"
                  data-testid="commit-bulk-import-btn"
                  disabled={selectedBulkCount === 0}
                  onClick={handleCommitBulkDrafts}
                  className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-45 text-white text-xs font-semibold"
                >
                  Import {selectedBulkCount} Selected Questions
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Manual Single Question Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddCustomQuestion}
          className="rounded-2xl border border-[#7C3AED]/40 bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">Add Single Question to Bank</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              value={newSource}
              onChange={(e) => setNewSource(e.target.value as QuestionSource)}
              aria-label="Question source"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="user_uploaded">My Uploaded Question</option>
              <option value="verified_pyq">Verified Previous Year Question (PYQ)</option>
            </select>
            <input
              type="text"
              value={newSourceLabel}
              onChange={(e) => setNewSourceLabel(e.target.value)}
              placeholder="Source citation (e.g. GATE CS Paper 1)"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            />
            <input
              type="text"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="Exam Year (only if verified PYQ)"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
            />
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={newTopicId}
              onChange={(e) => setNewTopicId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="">Optional topic...</option>
              {state.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={newExamId}
              onChange={(e) => setNewExamId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="">Any Exam</option>
              {state.exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={newDifficulty}
              onChange={(e) => setNewDifficulty(e.target.value as DifficultyLevel)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as QuestionType)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            >
              <option value="MCQ">MCQ</option>
              <option value="Numerical">Numerical</option>
              <option value="Conceptual">Conceptual</option>
              <option value="Descriptive">Descriptive</option>
            </select>
          </div>
          <textarea
            rows={2}
            value={newStatement}
            onChange={(e) => setNewStatement(e.target.value)}
            placeholder="Question statement..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
          />
          {newType === 'MCQ' && (
            <input
              type="text"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options separated by | (pipe)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={newCorrect}
              onChange={(e) => setNewCorrect(e.target.value)}
              placeholder="Exact correct answer"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            />
            <input
              type="text"
              value={newSolution}
              onChange={(e) => setNewSolution(e.target.value)}
              placeholder="Step-by-step solution & explanation"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#22C55E] text-white text-xs font-semibold hover:bg-[#16A34A]"
          >
            Save Question
          </button>
        </form>
      )}

      {/* AI Practice Question Generator */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#06B6D4]" />
              Generate Topic Practice Questions (Clearly Labeled AI Practice)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Creates original conceptual and numerical practice questions tagged explicitly as AI-Generated Practice (Not a PYQ).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <select
            value={aiTopicId}
            onChange={(e) => setAiTopicId(e.target.value)}
            aria-label="Topic for AI practice questions"
            className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="">General Subject Practice</option>
            {state.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={aiDifficulty}
            onChange={(e) => setAiDifficulty(e.target.value as DifficultyLevel)}
            aria-label="Difficulty for AI practice questions"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={6}
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
              aria-label="Number of questions to generate"
              className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono tabular-nums"
            />
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleGenerateAiQuestions}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#06B6D4] hover:bg-[#0891B2] text-white disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Generate AI Drill
            </button>
          </div>
        </div>
        {aiError && (
          <p role="alert" className="text-xs text-[#EF4444]">
            {aiError}
          </p>
        )}
      </section>

      {/* Source Filter Tabs + Multi-Facet Filter Bar */}
      <div className="space-y-3">
        <div
          role="tablist"
          aria-label="Question source filter tabs"
          data-testid="practice-source-tabs"
          className="inline-flex flex-wrap rounded-2xl border border-white/35 dark:border-white/14 bg-white/24 dark:bg-white/[0.05] backdrop-blur-md p-1 gap-1"
        >
          {(
            [
              { id: 'all', label: 'All Questions', count: sourceCounts.all },
              { id: 'user_uploaded', label: 'My Uploaded', count: sourceCounts.user_uploaded },
              { id: 'verified_pyq', label: 'Verified PYQs', count: sourceCounts.verified_pyq },
              {
                id: 'ai_generated',
                label: 'AI Practice (Labeled)',
                count: sourceCounts.ai_generated,
              },
            ] as const
          ).map((tab) => {
            const active = filterSource === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setFilterSource(tab.id)}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 whitespace-nowrap ${
                  active
                    ? 'text-white'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-white/28 dark:hover:bg-white/10'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="practice-source-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-[#7C3AED]/80 border border-white/30 shadow-sm backdrop-blur-md"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-mono text-[10px] tabular-nums ${
                      active
                        ? 'bg-white/25 text-white'
                        : 'bg-slate-900/10 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl flex flex-wrap items-center gap-2.5">
          <select
            value={filterExam}
            onChange={(e) => setFilterExam(e.target.value)}
            aria-label="Filter by exam"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="all">All Exams</option>
            {state.exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            aria-label="Filter by subject"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="all">All Subjects</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            aria-label="Filter by topic"
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
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            aria-label="Filter by difficulty"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="all">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by question type"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
          >
            <option value="all">All Types</option>
            <option value="MCQ">MCQ</option>
            <option value="Numerical">Numerical</option>
            <option value="Conceptual">Conceptual</option>
            <option value="Descriptive">Descriptive</option>
          </select>
          <input
            type="text"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            placeholder="Year"
            aria-label="Filter by exam year"
            className="w-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => setBookmarkedOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
              bookmarkedOnly
                ? 'bg-[#FACC15]/15 border-[#FACC15] text-[#B45309] dark:text-[#FACC15]'
                : 'border-slate-200 dark:border-[#2E2E58]'
            }`}
          >
            Bookmarked
          </button>
        </div>
      </div>

      {/* Question Cards */}
      {filteredQuestions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {filterSource === 'verified_pyq'
              ? 'No verified PYQ papers are currently stored for these filters.'
              : filterSource === 'user_uploaded'
                ? 'No uploaded personal questions match these filters yet.'
                : filterSource === 'ai_generated'
                  ? 'No AI-generated practice questions match these filters yet.'
                  : 'No practice questions match your current filters.'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use Bulk File / Text Import, Add Single Question, or Generate AI Drill above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => {
            const userAns = selectedAnswers[q.id] ?? '';
            const isChecked = Boolean(checkedIds[q.id]);
            const isCorrect =
              isChecked && userAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            const subjName = subjectMap.get(q.subjectId)?.name ?? 'General';
            const topName = q.topicId ? topicMap.get(q.topicId)?.name : undefined;

            return (
              <article
                key={q.id}
                className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[#7C3AED] tabular-nums">
                      Q{idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{subjName}</span>
                    {topName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{topName}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{q.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold border ${
                        q.source === 'ai_generated'
                          ? 'bg-[#06B6D4]/12 border-[#06B6D4]/35 text-[#0891B2] dark:text-[#67E8F9]'
                          : q.source === 'verified_pyq'
                            ? 'bg-[#22C55E]/12 border-[#22C55E]/35 text-[#15803D] dark:text-[#4ADE80]'
                            : 'bg-[#7C3AED]/12 border-[#7C3AED]/35 text-[#5B21B6] dark:text-[#C4B5FD]'
                      }`}
                    >
                      {SOURCE_LABELS[q.source]} · {q.sourceLabel}
                      {q.year ? ` (${q.year})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(q.id)}
                      aria-label={`Bookmark question ${idx + 1}`}
                      className={`p-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] ${
                        q.bookmarked ? 'text-[#FACC15]' : 'text-slate-400'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTargetId(reportTargetId === q.id ? null : q.id)}
                      aria-label={`Report issue on question ${idx + 1}`}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] text-slate-400 hover:text-[#EF4444]"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-white leading-relaxed">
                  {q.statement}
                </p>

                {q.options && q.options.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt) => {
                      const selected = userAns === opt;
                      const showRight = isChecked && opt === q.correctAnswer;
                      const showWrong = isChecked && selected && opt !== q.correctAnswer;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }))
                          }
                          className={`px-4 py-2.5 rounded-xl border text-left text-sm transition-colors ${
                            showRight
                              ? 'border-[#22C55E] bg-[#22C55E]/15 text-[#15803D] dark:text-[#4ADE80] font-semibold'
                              : showWrong
                                ? 'border-[#EF4444] bg-[#EF4444]/15 text-[#DC2626] dark:text-[#FCA5A5]'
                                : selected
                                  ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-slate-900 dark:text-white font-medium'
                                  : 'border-slate-200 dark:border-[#2E2E58] hover:border-[#7C3AED]/50'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={userAns}
                    onChange={(e) =>
                      setSelectedAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Type your answer..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
                  />
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCheckAnswer(q)}
                    disabled={!userAns}
                    className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold disabled:opacity-40"
                  >
                    Check Answer
                  </button>

                  {isChecked && !isCorrect && (
                    <button
                      type="button"
                      onClick={() =>
                        onAddMistake({
                          questionId: q.id,
                          questionStatement: q.statement,
                          subjectId: q.subjectId,
                          topicId: q.topicId,
                          userAnswer: userAns,
                          correctAnswer: q.correctAnswer,
                          explanation: q.explanation,
                          mistakeType: 'Conceptual Gap',
                          correctiveAction: 'Review topic concepts and re-attempt.',
                          resolved: false,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl border border-[#EC4899]/40 text-[#EC4899] text-xs font-semibold hover:bg-[#EC4899]/10"
                    >
                      Add to Mistake Notebook
                    </button>
                  )}
                </div>

                {isChecked && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] space-y-1.5 text-xs">
                    <p
                      className={`font-semibold flex items-center gap-1.5 ${
                        isCorrect ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isCorrect
                        ? 'Correct!'
                        : `Incorrect — Correct Answer: ${q.correctAnswer}`}
                    </p>
                    <p className="text-slate-700 dark:text-slate-200">
                      <span className="font-semibold">Solution:</span> {q.solution}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">{q.explanation}</p>
                  </div>
                )}

                {reportTargetId === q.id && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reportText}
                      onChange={(e) => setReportText(e.target.value)}
                      placeholder="Describe issue (typo, wrong key, unclear wording)..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (reportText.trim()) {
                          onReportIssue(q.id, reportText.trim());
                          setReportText('');
                          setReportTargetId(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#EF4444] text-white text-xs font-semibold"
                    >
                      Submit Report
                    </button>
                  </div>
                )}

                {q.reportedIssue && (
                  <p className="text-[11px] text-[#F97316]">
                    Reported issue logged: {q.reportedIssue}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
