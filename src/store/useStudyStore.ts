import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyAppState,
  createSampleDemoState,
  DEFAULT_DASHBOARD_WIDGETS,
  getTodayISO,
} from '../data/demoData';
import type {
  AppState,
  Chapter,
  DashboardFilters,
  DashboardWidgetConfig,
  ExamTarget,
  ExtractedSyllabusDraft,
  Flashcard,
  MistakeEntry,
  MockTestAttempt,
  MockTestConfig,
  PlannerTask,
  Question,
  RevisionConfig,
  StudyProfile,
  StudySession,
  Subject,
  Topic,
  TutorMessage,
  Unit,
  UploadedResource,
} from '../types/study';
import {
  classifyRevisionPerformance,
  computeMasteryScore,
  computeNextRevision,
  generateHybridSchedule,
  gradeMockTest,
} from '../utils/studyMath';

const STORAGE_KEY = 'axiom_study_state_v1';
const THEME_KEY = 'axiom_theme';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadInitialState(): AppState {
  try {
    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.profile) {
        if (autostart && !parsed.profile.onboardingCompleted) {
          return createSampleDemoState();
        }
        return parsed;
      }
    }
    if (autostart) {
      return createSampleDemoState();
    }
  } catch {
    // Ignore storage parse failure and start clean
  }
  return createEmptyAppState();
}

export function useStudyStore() {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const loadDemoData = useCallback(() => {
    setState(createSampleDemoState());
  }, []);

  const resetToEmpty = useCallback(() => {
    setState(createEmptyAppState());
  }, []);

  const replaceFullState = useCallback((next: AppState) => {
    setState(next);
  }, []);

  const updateProfile = useCallback((patch: Partial<StudyProfile>) => {
    setState((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
    }));
  }, []);

  // Exams CRUD
  const addExam = useCallback((exam: Omit<ExamTarget, 'id'>) => {
    const newExam: ExamTarget = { ...exam, id: uid('exam') };
    setState((prev) => ({ ...prev, exams: [...prev.exams, newExam] }));
    return newExam;
  }, []);

  const updateExam = useCallback((id: string, patch: Partial<ExamTarget>) => {
    setState((prev) => ({
      ...prev,
      exams: prev.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }, []);

  const deleteExam = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      exams: prev.exams.filter((e) => e.id !== id),
      subjects: prev.subjects.map((s) => ({
        ...s,
        examIds: s.examIds.filter((eid) => eid !== id),
      })),
      topics: prev.topics.map((t) => ({
        ...t,
        examIds: t.examIds.filter((eid) => eid !== id),
      })),
    }));
  }, []);

  // Complete Onboarding
  const completeOnboarding = useCallback(
    (payload: {
      profile: Partial<StudyProfile>;
      exams: Array<Omit<ExamTarget, 'id'>>;
      subjectNames: string[];
      initialTasks?: PlannerTask[];
    }) => {
      const createdExams: ExamTarget[] = payload.exams.map((e, idx) => ({
        ...e,
        id: uid(`exam${idx}`),
      }));
      const palette = ['#7C3AED', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#FACC15'];
      const createdSubjects: Subject[] = payload.subjectNames
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          id: uid('subj'),
          name,
          code: name.slice(0, 3).toUpperCase() + '-' + String(100 + idx * 10),
          color: palette[idx % palette.length],
          order: idx + 1,
          examIds: createdExams.map((e) => e.id),
        }));

      const createdUnits: Unit[] = [];
      const createdChapters: Chapter[] = [];
      const createdTopics: Topic[] = [];

      createdSubjects.forEach((subj, sIdx) => {
        const unitId = uid('unit');
        const chapId = uid('chap');
        createdUnits.push({ id: unitId, subjectId: subj.id, name: 'Unit 1: Core Foundations', order: 1 });
        createdChapters.push({ id: chapId, unitId, subjectId: subj.id, name: 'Chapter 1: Fundamentals', order: 1 });
        const rawTopic = {
          id: uid('top'),
          chapterId: chapId,
          unitId,
          subjectId: subj.id,
          name: `${subj.name} — Core Principles`,
          subtopics: ['Key terminology', 'Core frameworks'],
          status: 'Not Started' as const,
          difficulty: 'Medium' as const,
          weightage: 15,
          estimatedMinutes: 90,
          actualMinutes: 0,
          confidence: 1,
          understanding: 1,
          notes: '',
          formulas: '',
          definitions: '',
          importantConcepts: '',
          prerequisites: [],
          examIds: subj.examIds,
          practiceAttempted: 0,
          practiceCorrect: 0,
          lastStudiedAt: null,
          nextRevisionAt: null,
          revisionIntervalDays: 1,
          revisionCount: 0,
          priority: 'High' as const,
          order: sIdx + 1,
        };
        createdTopics.push({ ...rawTopic, masteryScore: computeMasteryScore(rawTopic) });
      });

      const autoTasks =
        payload.profile.autoGeneratePlan && createdTopics.length > 0
          ? generateHybridSchedule({
              topics: createdTopics,
              exams: createdExams,
              startDateISO: getTodayISO(),
              days: 5,
              dailyMinutesBudget: (payload.profile.dailyHoursTarget || 3) * 60,
              preferredDays: payload.profile.preferredStudyDays || [],
            })
          : [];

      setState((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          ...payload.profile,
          onboardingCompleted: true,
          isDemoMode: false,
        },
        exams: [...prev.exams, ...createdExams],
        subjects: [...prev.subjects, ...createdSubjects],
        units: [...prev.units, ...createdUnits],
        chapters: [...prev.chapters, ...createdChapters],
        topics: [...prev.topics, ...createdTopics],
        tasks: payload.initialTasks
          ? [...prev.tasks, ...payload.initialTasks, ...autoTasks]
          : [...prev.tasks, ...autoTasks],
      }));
    },
    []
  );

  // Syllabus Commit from AI Draft
  const commitSyllabusDraft = useCallback((draft: ExtractedSyllabusDraft) => {
    const palette = ['#7C3AED', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#FACC15'];

    setState((prev) => {
      const examNameToId = new Map(prev.exams.map((e) => [e.name.toLowerCase(), e.id]));
      const newSubjects: Subject[] = [...prev.subjects];
      const newUnits: Unit[] = [...prev.units];
      const newChapters: Chapter[] = [...prev.chapters];
      const newTopics: Topic[] = [...prev.topics];

      draft.subjects.forEach((ds, sIdx) => {
        const mappedExamIds = (ds.examNames || [])
          .map((n) => examNameToId.get(n.toLowerCase()))
          .filter((id): id is string => Boolean(id));
        const examIds = mappedExamIds.length > 0 ? mappedExamIds : prev.exams.map((e) => e.id);

        const subjectId = uid('subj');
        newSubjects.push({
          id: subjectId,
          name: ds.name || `Subject ${newSubjects.length + 1}`,
          code: ds.code || (ds.name || 'SUB').slice(0, 3).toUpperCase() + '-' + (100 + sIdx),
          color: palette[newSubjects.length % palette.length],
          order: newSubjects.length + 1,
          examIds,
        });

        (ds.units || []).forEach((du, uIdx) => {
          const unitId = uid('unit');
          newUnits.push({
            id: unitId,
            subjectId,
            name: du.name || `Unit ${uIdx + 1}`,
            order: uIdx + 1,
          });

          (du.chapters || []).forEach((dc, cIdx) => {
            const chapterId = uid('chap');
            newChapters.push({
              id: chapterId,
              unitId,
              subjectId,
              name: dc.name || `Chapter ${cIdx + 1}`,
              order: cIdx + 1,
            });

            (dc.topics || []).forEach((dt, tIdx) => {
              const rawTopic = {
                id: uid('top'),
                chapterId,
                unitId,
                subjectId,
                name: dt.name || `Topic ${tIdx + 1}`,
                subtopics: Array.isArray(dt.subtopics) ? dt.subtopics : [],
                status: 'Not Started' as const,
                difficulty:
                  dt.difficulty === 'Easy' || dt.difficulty === 'Hard' ? dt.difficulty : ('Medium' as const),
                weightage: Math.max(5, Math.min(40, Number(dt.weightage) || 12)),
                estimatedMinutes: Math.max(15, Number(dt.estimatedMinutes) || 60),
                actualMinutes: 0,
                confidence: 1,
                understanding: 1,
                notes: '',
                formulas: '',
                definitions: '',
                importantConcepts: '',
                prerequisites: Array.isArray(dt.prerequisites) ? dt.prerequisites : [],
                examIds,
                practiceAttempted: 0,
                practiceCorrect: 0,
                lastStudiedAt: null,
                nextRevisionAt: null,
                revisionIntervalDays: 1,
                revisionCount: 0,
                priority: 'Medium' as const,
                order: newTopics.length + 1,
              };
              newTopics.push({ ...rawTopic, masteryScore: computeMasteryScore(rawTopic) });
            });
          });
        });
      });

      return {
        ...prev,
        subjects: newSubjects,
        units: newUnits,
        chapters: newChapters,
        topics: newTopics,
      };
    });
  }, []);

  // Subject CRUD + Reorder + Merge
  const addSubject = useCallback((name: string, code: string, examIds: string[]) => {
    const palette = ['#7C3AED', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#FACC15'];
    setState((prev) => {
      const subjectId = uid('subj');
      const unitId = uid('unit');
      const chapId = uid('chap');
      const newSubj: Subject = {
        id: subjectId,
        name,
        code: code || name.slice(0, 3).toUpperCase() + '-101',
        color: palette[prev.subjects.length % palette.length],
        order: prev.subjects.length + 1,
        examIds,
      };
      return {
        ...prev,
        subjects: [...prev.subjects, newSubj],
        units: [...prev.units, { id: unitId, subjectId, name: 'Unit 1: Core', order: 1 }],
        chapters: [...prev.chapters, { id: chapId, unitId, subjectId, name: 'Chapter 1: Overview', order: 1 }],
      };
    });
  }, []);

  const renameSubject = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  }, []);

  const deleteSubject = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
      units: prev.units.filter((u) => u.subjectId !== id),
      chapters: prev.chapters.filter((c) => c.subjectId !== id),
      topics: prev.topics.filter((t) => t.subjectId !== id),
    }));
  }, []);

  const reorderSubject = useCallback((id: string, direction: 'up' | 'down') => {
    setState((prev) => {
      const sorted = prev.subjects.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
      [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
      const reindexed = sorted.map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, subjects: reindexed };
    });
  }, []);

  const mergeSubjects = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== sourceId),
      units: prev.units.map((u) => (u.subjectId === sourceId ? { ...u, subjectId: targetId } : u)),
      chapters: prev.chapters.map((c) => (c.subjectId === sourceId ? { ...c, subjectId: targetId } : c)),
      topics: prev.topics.map((t) => (t.subjectId === sourceId ? { ...t, subjectId: targetId } : t)),
      questions: prev.questions.map((q) => (q.subjectId === sourceId ? { ...q, subjectId: targetId } : q)),
    }));
  }, []);

  // Chapter & Topic CRUD + Split + Merge
  const addChapter = useCallback((subjectId: string, unitId: string, name: string) => {
    const newChap: Chapter = {
      id: uid('chap'),
      subjectId,
      unitId,
      name,
      order: Date.now(),
    };
    setState((prev) => ({ ...prev, chapters: [...prev.chapters, newChap] }));
    return newChap;
  }, []);

  const renameChapter = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  }, []);

  const deleteChapter = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((c) => c.id !== id),
      topics: prev.topics.filter((t) => t.chapterId !== id),
    }));
  }, []);

  const addTopic = useCallback(
    (payload: {
      subjectId: string;
      unitId: string;
      chapterId: string;
      name: string;
      difficulty?: Topic['difficulty'];
      weightage?: number;
      estimatedMinutes?: number;
      examIds?: string[];
      subtopics?: string[];
    }) => {
      setState((prev) => {
        const rawTopic = {
          id: uid('top'),
          chapterId: payload.chapterId,
          unitId: payload.unitId,
          subjectId: payload.subjectId,
          name: payload.name,
          subtopics: payload.subtopics ?? [],
          status: 'Not Started' as const,
          difficulty: payload.difficulty ?? ('Medium' as const),
          weightage: payload.weightage ?? 10,
          estimatedMinutes: payload.estimatedMinutes ?? 60,
          actualMinutes: 0,
          confidence: 1,
          understanding: 1,
          notes: '',
          formulas: '',
          definitions: '',
          importantConcepts: '',
          prerequisites: [],
          examIds:
            payload.examIds && payload.examIds.length > 0
              ? payload.examIds
              : prev.exams.map((e) => e.id),
          practiceAttempted: 0,
          practiceCorrect: 0,
          lastStudiedAt: null,
          nextRevisionAt: null,
          revisionIntervalDays: 1,
          revisionCount: 0,
          priority: 'Medium' as const,
          order: prev.topics.length + 1,
        };
        return {
          ...prev,
          topics: [...prev.topics, { ...rawTopic, masteryScore: computeMasteryScore(rawTopic) }],
        };
      });
    },
    []
  );

  const updateTopic = useCallback((id: string, patch: Partial<Topic>) => {
    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) => {
        if (t.id !== id) return t;
        const merged = { ...t, ...patch };
        return {
          ...merged,
          masteryScore: computeMasteryScore(merged),
        };
      }),
    }));
  }, []);

  const deleteTopic = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t.id !== id),
    }));
  }, []);

  const splitTopic = useCallback((id: string, splitNames: string[]) => {
    const cleaned = splitNames.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length < 2) return;
    setState((prev) => {
      const target = prev.topics.find((t) => t.id === id);
      if (!target) return prev;
      const splitTopics: Topic[] = cleaned.map((name, idx) => {
        const base = {
          ...target,
          id: idx === 0 ? target.id : uid('top'),
          name,
          estimatedMinutes: Math.max(20, Math.round(target.estimatedMinutes / cleaned.length)),
          subtopics: idx === 0 ? target.subtopics : [],
        };
        return { ...base, masteryScore: computeMasteryScore(base) };
      });
      return {
        ...prev,
        topics: prev.topics.flatMap((t) => (t.id === id ? splitTopics : [t])),
      };
    });
  }, []);

  const mergeTopics = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setState((prev) => {
      const src = prev.topics.find((t) => t.id === sourceId);
      const tgt = prev.topics.find((t) => t.id === targetId);
      if (!src || !tgt) return prev;
      const mergedExamIds = Array.from(new Set([...tgt.examIds, ...src.examIds]));
      const mergedSubtopics = Array.from(new Set([...tgt.subtopics, src.name, ...src.subtopics]));
      const updatedTarget: Topic = {
        ...tgt,
        examIds: mergedExamIds,
        subtopics: mergedSubtopics,
        estimatedMinutes: tgt.estimatedMinutes + src.estimatedMinutes,
        actualMinutes: tgt.actualMinutes + src.actualMinutes,
        notes: [tgt.notes, src.notes].filter(Boolean).join('\n\n'),
      };
      updatedTarget.masteryScore = computeMasteryScore(updatedTarget);
      return {
        ...prev,
        topics: prev.topics
          .filter((t) => t.id !== sourceId)
          .map((t) => (t.id === targetId ? updatedTarget : t)),
      };
    });
  }, []);

  // Study Session Logging
  const logStudySession = useCallback((session: Omit<StudySession, 'id'>) => {
    const newSess: StudySession = { ...session, id: uid('sess') };
    setState((prev) => {
      const updatedTopics = session.topicId
        ? prev.topics.map((t) => {
            if (t.id !== session.topicId) return t;
            const nextStatus = t.status === 'Not Started' ? 'Learning' : t.status;
            const nextTopic = {
              ...t,
              status: nextStatus,
              actualMinutes: t.actualMinutes + session.durationMinutes,
              lastStudiedAt: session.date,
            };
            return { ...nextTopic, masteryScore: computeMasteryScore(nextTopic) };
          })
        : prev.topics;

      return {
        ...prev,
        sessions: [newSess, ...prev.sessions],
        topics: updatedTopics,
      };
    });
  }, []);

  // Spaced Repetition Revision Completion
  const completeTopicRevision = useCallback(
    (topicId: string, accuracyPct: number | null, understanding: number, confidence: number) => {
      const today = getTodayISO();
      setState((prev) => ({
        ...prev,
        topics: prev.topics.map((t) => {
          if (t.id !== topicId) return t;
          const band = classifyRevisionPerformance(accuracyPct, understanding, confidence);
          const { nextRevisionAt, intervalDays } = computeNextRevision(band, today, prev.revisionConfig);
          const nextStatus =
            band === 'weak'
              ? 'Weak Area'
              : band === 'strong' && t.practiceAttempted > 0 && understanding >= 4 && confidence >= 4
                ? 'Mastered'
                : 'Completed';
          const updated: Topic = {
            ...t,
            understanding,
            confidence,
            status: nextStatus,
            lastStudiedAt: today,
            nextRevisionAt,
            revisionIntervalDays: intervalDays,
            revisionCount: t.revisionCount + 1,
          };
          updated.masteryScore = computeMasteryScore(updated);
          return updated;
        }),
        sessions: [
          {
            id: uid('sess'),
            topicId,
            date: today,
            durationMinutes: 25,
            activityType: 'Revision',
            notes: 'Completed scheduled spaced-repetition review.',
          },
          ...prev.sessions,
        ],
      }));
    },
    []
  );

  // Planner Tasks CRUD
  const addTask = useCallback((task: Omit<PlannerTask, 'id'>) => {
    const newTask: PlannerTask = { ...task, id: uid('task') };
    setState((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  }, []);

  const addMultipleTasks = useCallback((tasksToAdd: Array<Omit<PlannerTask, 'id'>>) => {
    const created = tasksToAdd.map((t) => ({ ...t, id: uid('task') }));
    setState((prev) => ({ ...prev, tasks: [...prev.tasks, ...created] }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<PlannerTask>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  }, []);

  // Questions & Practice
  const addQuestions = useCallback((qs: Array<Omit<Question, 'id'>>) => {
    const created = qs.map((q) => ({ ...q, id: uid('q') }));
    setState((prev) => ({ ...prev, questions: [...created, ...prev.questions] }));
  }, []);

  const toggleBookmarkQuestion = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, bookmarked: !q.bookmarked } : q)),
    }));
  }, []);

  const reportQuestionIssue = useCallback((id: string, issue: string) => {
    setState((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, reportedIssue: issue } : q)),
    }));
  }, []);

  const recordPracticeAttempt = useCallback((questionId: string, isCorrect: boolean) => {
    const today = getTodayISO();
    setState((prev) => {
      const q = prev.questions.find((item) => item.id === questionId);
      if (!q || !q.topicId) return prev;
      return {
        ...prev,
        topics: prev.topics.map((t) => {
          if (t.id !== q.topicId) return t;
          const updated = {
            ...t,
            practiceAttempted: t.practiceAttempted + 1,
            practiceCorrect: t.practiceCorrect + (isCorrect ? 1 : 0),
            lastStudiedAt: today,
          };
          return { ...updated, masteryScore: computeMasteryScore(updated) };
        }),
      };
    });
  }, []);

  // Mistakes Notebook
  const addMistake = useCallback((entry: Omit<MistakeEntry, 'id' | 'createdAt'>) => {
    const created: MistakeEntry = {
      ...entry,
      id: uid('mist'),
      createdAt: getTodayISO(),
    };
    setState((prev) => ({ ...prev, mistakes: [created, ...prev.mistakes] }));
  }, []);

  const updateMistake = useCallback((id: string, patch: Partial<MistakeEntry>) => {
    setState((prev) => ({
      ...prev,
      mistakes: prev.mistakes.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }, []);

  // Mock Test Submission -> Grades + Updates Topic Mastery & Schedules Weak Revisions
  const submitMockTest = useCallback(
    (payload: {
      config: MockTestConfig;
      questions: Question[];
      answers: Record<string, string>;
      markedForReview: Record<string, boolean>;
      timeSpentMap: Record<string, number>;
      startedAt: string;
      totalTimeSeconds: number;
    }): MockTestAttempt => {
      const graded = gradeMockTest(
        payload.questions,
        payload.answers,
        payload.markedForReview,
        payload.timeSpentMap,
        payload.config
      );
      const today = getTodayISO();

      const attempt: MockTestAttempt = {
        id: uid('mock'),
        title: payload.config.title,
        config: payload.config,
        startedAt: payload.startedAt,
        completedAt: new Date().toISOString(),
        totalQuestions: payload.questions.length,
        correctCount: graded.correctCount,
        incorrectCount: graded.incorrectCount,
        unattemptedCount: graded.unattemptedCount,
        score: graded.score,
        maxScore: graded.maxScore,
        percentage: graded.percentage,
        accuracy: graded.accuracy,
        totalTimeSeconds: payload.totalTimeSeconds,
        questionResults: graded.questionResults,
      };

      setState((prev) => {
        const topicStats = new Map<string, { attempted: number; correct: number }>();
        graded.questionResults.forEach((r) => {
          if (!r.topicId || !r.isAttempted) return;
          const cur = topicStats.get(r.topicId) ?? { attempted: 0, correct: 0 };
          cur.attempted += 1;
          if (r.isCorrect) cur.correct += 1;
          topicStats.set(r.topicId, cur);
        });

        const updatedTopics = prev.topics.map((t) => {
          const stat = topicStats.get(t.id);
          if (!stat) return t;
          const isWeak = graded.weakTopicIds.includes(t.id);
          const nextRev = isWeak
            ? computeNextRevision('weak', today, prev.revisionConfig)
            : { nextRevisionAt: t.nextRevisionAt, intervalDays: t.revisionIntervalDays };

          const updated: Topic = {
            ...t,
            practiceAttempted: t.practiceAttempted + stat.attempted,
            practiceCorrect: t.practiceCorrect + stat.correct,
            status: isWeak ? 'Weak Area' : t.status === 'Not Started' ? 'Learning' : t.status,
            lastStudiedAt: today,
            nextRevisionAt: nextRev.nextRevisionAt,
            revisionIntervalDays: nextRev.intervalDays,
          };
          updated.masteryScore = computeMasteryScore(updated);
          return updated;
        });

        const newMistakes: MistakeEntry[] = [];
        graded.questionResults
          .filter((r) => r.isAttempted && !r.isCorrect)
          .forEach((r) => {
            const q = payload.questions.find((item) => item.id === r.questionId);
            if (!q) return;
            newMistakes.push({
              id: uid('mist'),
              questionId: q.id,
              questionStatement: q.statement,
              subjectId: q.subjectId,
              topicId: q.topicId,
              userAnswer: r.userAnswer ?? '',
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              mistakeType: 'Conceptual Gap',
              correctiveAction: 'Re-attempt after reviewing topic notes & formulas.',
              resolved: false,
              createdAt: today,
            });
          });

        return {
          ...prev,
          mockTests: [...prev.mockTests, attempt],
          topics: updatedTopics,
          mistakes: [...newMistakes, ...prev.mistakes],
          sessions: [
            {
              id: uid('sess'),
              subjectId: payload.config.subjectIds[0],
              examId: payload.config.examId !== 'all' ? payload.config.examId : undefined,
              date: today,
              durationMinutes: Math.max(1, Math.round(payload.totalTimeSeconds / 60)),
              activityType: 'Mock Test',
              notes: `Completed ${attempt.title} (${attempt.percentage}% accuracy ${attempt.accuracy}%).`,
            },
            ...prev.sessions,
          ],
        };
      });

      return attempt;
    },
    []
  );

  // Flashcards & Resources
  const addFlashcard = useCallback((card: Omit<Flashcard, 'id'>) => {
    setState((prev) => ({
      ...prev,
      flashcards: [{ ...card, id: uid('fc') }, ...prev.flashcards],
    }));
  }, []);

  const updateFlashcard = useCallback((id: string, patch: Partial<Flashcard>) => {
    setState((prev) => ({
      ...prev,
      flashcards: prev.flashcards.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const deleteFlashcard = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      flashcards: prev.flashcards.filter((f) => f.id !== id),
    }));
  }, []);

  const addResource = useCallback((res: Omit<UploadedResource, 'id' | 'uploadedAt'>) => {
    setState((prev) => ({
      ...prev,
      resources: [{ ...res, id: uid('res'), uploadedAt: getTodayISO() }, ...prev.resources],
    }));
  }, []);

  // Dashboard Customization
  const updateDashboardWidgets = useCallback((widgets: DashboardWidgetConfig[]) => {
    setState((prev) => ({
      ...prev,
      dashboardConfig: { ...prev.dashboardConfig, widgets },
    }));
  }, []);

  const updateDashboardFilters = useCallback((patch: Partial<DashboardFilters>) => {
    setState((prev) => ({
      ...prev,
      dashboardConfig: {
        ...prev.dashboardConfig,
        filters: { ...prev.dashboardConfig.filters, ...patch },
      },
    }));
  }, []);

  const resetDashboardConfig = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dashboardConfig: {
        widgets: DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w })),
        filters: { subjectId: 'all', examId: 'all', timeRange: '30d', topicStatus: 'all' },
      },
    }));
  }, []);

  const updateRevisionConfig = useCallback((patch: Partial<RevisionConfig>) => {
    setState((prev) => ({
      ...prev,
      revisionConfig: { ...prev.revisionConfig, ...patch },
    }));
  }, []);

  const addTutorMessages = useCallback((msgs: TutorMessage[]) => {
    setState((prev) => ({
      ...prev,
      tutorHistory: [...prev.tutorHistory, ...msgs].slice(-40),
    }));
  }, []);

  const clearTutorHistory = useCallback(() => {
    setState((prev) => ({ ...prev, tutorHistory: [] }));
  }, []);

  return {
    state,
    theme,
    toggleTheme,
    loadDemoData,
    resetToEmpty,
    replaceFullState,
    updateProfile,
    addExam,
    updateExam,
    deleteExam,
    completeOnboarding,
    commitSyllabusDraft,
    addSubject,
    renameSubject,
    deleteSubject,
    reorderSubject,
    mergeSubjects,
    addChapter,
    renameChapter,
    deleteChapter,
    addTopic,
    updateTopic,
    deleteTopic,
    splitTopic,
    mergeTopics,
    logStudySession,
    completeTopicRevision,
    addTask,
    addMultipleTasks,
    updateTask,
    deleteTask,
    addQuestions,
    toggleBookmarkQuestion,
    reportQuestionIssue,
    recordPracticeAttempt,
    addMistake,
    updateMistake,
    submitMockTest,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    addResource,
    updateDashboardWidgets,
    updateDashboardFilters,
    resetDashboardConfig,
    updateRevisionConfig,
    addTutorMessages,
    clearTutorHistory,
  };
}
