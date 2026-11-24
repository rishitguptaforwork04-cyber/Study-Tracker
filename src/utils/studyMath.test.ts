import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExamReadiness,
  calculateStudyStreak,
  classifyRevisionPerformance,
  computeExamCountdown,
  computeMasteryScore,
  computeNextRevision,
  findSyllabusOverlaps,
  generateHybridSchedule,
  getRevisionQueueSummary,
  gradeMockTest,
  sortExamsByNearest,
} from './studyMath';
import {
  materializeImportedQuestions,
  parseQuestionsAuto,
} from './questionImport';
import type { ExamTarget, MockTestConfig, Question, Subject, Topic } from '../types/study';

test('completed topic is NOT treated as automatically mastered', () => {
  const completedNoPractice = computeMasteryScore({
    status: 'Completed',
    understanding: 3,
    confidence: 3,
    practiceAttempted: 0,
    practiceCorrect: 0,
    revisionCount: 0,
  });
  assert.ok(completedNoPractice <= 68, `Expected <= 68, got ${completedNoPractice}`);

  const masteredWithEvidence = computeMasteryScore({
    status: 'Mastered',
    understanding: 5,
    confidence: 5,
    practiceAttempted: 20,
    practiceCorrect: 19,
    revisionCount: 3,
  });
  assert.ok(masteredWithEvidence >= 90, `Expected >= 90, got ${masteredWithEvidence}`);
});

test('spaced repetition schedules earlier revisions for weak performance and longer for strong', () => {
  const config = { weakIntervalDays: 1, moderateIntervalDays: 4, strongIntervalDays: 10 };
  const weakBand = classifyRevisionPerformance(40, 2, 2);
  const strongBand = classifyRevisionPerformance(90, 5, 4);

  assert.equal(weakBand, 'weak');
  assert.equal(strongBand, 'strong');

  const weakRev = computeNextRevision(weakBand, '2026-11-23', config);
  const strongRev = computeNextRevision(strongBand, '2026-11-23', config);

  assert.equal(weakRev.nextRevisionAt, '2026-11-24');
  assert.equal(strongRev.nextRevisionAt, '2026-12-03');
});

test('syllabus overlap detection identifies topics shared across multiple exams', () => {
  const exams: ExamTarget[] = [
    { id: 'cfa', name: 'CFA Level I', examDate: '2027-02-20', attemptYear: '2027', targetScore: '75%', color: '#7C3AED' },
    { id: 'frm', name: 'FRM Part I', examDate: '2027-05-15', attemptYear: '2027', targetScore: 'Q1', color: '#06B6D4' },
  ];
  const subjects: Subject[] = [
    { id: 'qm', name: 'Quantitative Methods', code: 'QM', color: '#7C3AED', order: 1, examIds: ['cfa', 'frm'] },
  ];
  const topics: Topic[] = [
    {
      id: 't1',
      chapterId: 'c1',
      unitId: 'u1',
      subjectId: 'qm',
      name: 'Hypothesis Testing & p-Values',
      subtopics: [],
      status: 'Learning',
      difficulty: 'Medium',
      weightage: 15,
      estimatedMinutes: 90,
      actualMinutes: 45,
      confidence: 3,
      understanding: 3,
      notes: '',
      formulas: '',
      definitions: '',
      importantConcepts: '',
      prerequisites: [],
      examIds: ['cfa', 'frm'],
      practiceAttempted: 5,
      practiceCorrect: 4,
      lastStudiedAt: '2026-11-22',
      nextRevisionAt: '2026-11-25',
      revisionIntervalDays: 3,
      revisionCount: 1,
      priority: 'High',
      masteryScore: 60,
      order: 1,
    },
    {
      id: 't2',
      chapterId: 'c1',
      unitId: 'u1',
      subjectId: 'qm',
      name: 'CFA Ethics Standard I',
      subtopics: [],
      status: 'Not Started',
      difficulty: 'Easy',
      weightage: 15,
      estimatedMinutes: 60,
      actualMinutes: 0,
      confidence: 1,
      understanding: 1,
      notes: '',
      formulas: '',
      definitions: '',
      importantConcepts: '',
      prerequisites: [],
      examIds: ['cfa'],
      practiceAttempted: 0,
      practiceCorrect: 0,
      lastStudiedAt: null,
      nextRevisionAt: null,
      revisionIntervalDays: 1,
      revisionCount: 0,
      priority: 'Medium',
      masteryScore: 0,
      order: 2,
    },
  ];

  const overlap = findSyllabusOverlaps(topics, subjects, exams);
  assert.equal(overlap.sharedTopics.length, 1);
  assert.equal(overlap.sharedTopics[0].topicId, 't1');
  assert.equal(overlap.subjectOverlapMatrix[0].sharedTopicCount, 1);
});

test('mock test grading handles negative marking, unattempted, and weak topic detection', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      statement: 'Q1',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      solution: 'Sol',
      explanation: 'Exp',
      difficulty: 'Easy',
      subjectId: 's1',
      topicId: 't1',
      marks: 4,
      negativeMarks: 1,
      questionType: 'MCQ',
      source: 'user_uploaded',
      sourceLabel: 'User Sheet',
      bookmarked: false,
    },
    {
      id: 'q2',
      statement: 'Q2',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'B',
      solution: 'Sol',
      explanation: 'Exp',
      difficulty: 'Hard',
      subjectId: 's1',
      topicId: 't2',
      marks: 4,
      negativeMarks: 1,
      questionType: 'MCQ',
      source: 'user_uploaded',
      sourceLabel: 'User Sheet',
      bookmarked: false,
    },
    {
      id: 'q3',
      statement: 'Q3',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'C',
      solution: 'Sol',
      explanation: 'Exp',
      difficulty: 'Medium',
      subjectId: 's2',
      topicId: 't3',
      marks: 4,
      negativeMarks: 1,
      questionType: 'MCQ',
      source: 'user_uploaded',
      sourceLabel: 'User Sheet',
      bookmarked: false,
    },
  ];

  const config: MockTestConfig = {
    title: 'Sample Check',
    durationMinutes: 30,
    questionCount: 3,
    subjectIds: [],
    chapterIds: [],
    topicIds: [],
    difficulty: 'All',
    questionFormat: 'All',
    examId: 'all',
    marksPerQuestion: 4,
    negativeMarking: 1,
    randomizeQuestions: false,
    randomizeOptions: false,
  };

  const graded = gradeMockTest(
    questions,
    { q1: 'A', q2: 'C' }, // q1 correct (+4), q2 wrong (-1), q3 unattempted (0)
    { q2: true },
    { q1: 20, q2: 45, q3: 10 },
    config
  );

  assert.equal(graded.correctCount, 1);
  assert.equal(graded.incorrectCount, 1);
  assert.equal(graded.unattemptedCount, 1);
  assert.equal(graded.score, 3);
  assert.equal(graded.maxScore, 12);
  assert.equal(graded.accuracy, 50);
  assert.deepEqual(graded.weakTopicIds, ['t2']);
});

test('study streak counts consecutive days accurately', () => {
  const streak = calculateStudyStreak(
    [
      { id: '1', date: '2026-11-23', durationMinutes: 60, activityType: 'Study', notes: '' },
      { id: '2', date: '2026-11-22', durationMinutes: 45, activityType: 'Revision', notes: '' },
      { id: '3', date: '2026-11-21', durationMinutes: 30, activityType: 'Practice', notes: '' },
      { id: '4', date: '2026-11-19', durationMinutes: 90, activityType: 'Study', notes: '' },
    ],
    '2026-11-23'
  );
  assert.equal(streak, 3);
});

test('exam readiness and hybrid scheduler produce valid bounded outputs', () => {
  const topics: Topic[] = [
    {
      id: 't1',
      chapterId: 'c1',
      unitId: 'u1',
      subjectId: 's1',
      name: 'Duration & Convexity',
      subtopics: [],
      status: 'Weak Area',
      difficulty: 'Hard',
      weightage: 25,
      estimatedMinutes: 60,
      actualMinutes: 30,
      confidence: 2,
      understanding: 2,
      notes: '',
      formulas: '',
      definitions: '',
      importantConcepts: '',
      prerequisites: [],
      examIds: ['e1'],
      practiceAttempted: 4,
      practiceCorrect: 1,
      lastStudiedAt: '2026-11-20',
      nextRevisionAt: '2026-11-23',
      revisionIntervalDays: 1,
      revisionCount: 0,
      priority: 'Critical',
      masteryScore: 30,
      order: 1,
    },
  ];
  const readiness = calculateExamReadiness(topics, 'e1', []);
  assert.ok(readiness >= 0 && readiness <= 100);

  const schedule = generateHybridSchedule({
    topics,
    exams: [{ id: 'e1', name: 'Exam 1', examDate: '2027-01-10', attemptYear: '2027', targetScore: '80%', color: '#7C3AED' }],
    startDateISO: '2026-11-23',
    days: 3,
    dailyMinutesBudget: 120,
    preferredDays: ['Mon', 'Tue', 'Wed'],
  });
  assert.ok(schedule.length >= 3);
  assert.equal(schedule[0].topicId, 't1');
});

test('exam countdown sorts nearest upcoming exam first and calculates prep-window progress', () => {
  const nowMs = Date.parse('2026-11-23T09:00:00Z');
  const exams: ExamTarget[] = [
    {
      id: 'far',
      name: 'FRM Part I',
      examDate: '2027-02-21',
      prepStartDate: '2026-10-24',
      attemptYear: '2027',
      targetScore: 'Q1',
      color: '#06B6D4',
    },
    {
      id: 'past',
      name: 'Mock Qualifier',
      examDate: '2026-11-10',
      attemptYear: '2026',
      targetScore: 'Pass',
      color: '#F97316',
    },
    {
      id: 'near',
      name: 'CFA Level I',
      examDate: '2026-12-03',
      prepStartDate: '2026-10-04',
      attemptYear: '2026',
      targetScore: '75%',
      color: '#7C3AED',
    },
  ];

  const sorted = sortExamsByNearest(exams, nowMs);
  assert.equal(sorted[0].id, 'near');
  assert.equal(sorted[1].id, 'far');
  assert.equal(sorted[2].id, 'past');

  const nearMetrics = computeExamCountdown(sorted[0], nowMs);
  assert.equal(nearMetrics.daysRemaining, 10);
  assert.equal(nearMetrics.status, 'urgent');
  assert.ok(nearMetrics.elapsedPercent >= 80 && nearMetrics.elapsedPercent < 90);

  const todayMetrics = computeExamCountdown(
    { id: 'td', name: 'Today Test', examDate: '2026-11-23', attemptYear: '2026', targetScore: '80%', color: '#7C3AED' },
    nowMs
  );
  assert.equal(todayMetrics.status, 'today');
  assert.equal(todayMetrics.elapsedPercent, 100);
  assert.equal(todayMetrics.remainingLabel, 'Exam Day');

  const passedMetrics = computeExamCountdown(sorted[2], nowMs);
  assert.equal(passedMetrics.status, 'passed');
  assert.equal(passedMetrics.elapsedPercent, 100);
});

test('revision queue summary counts due today and overdue topics without double counting', () => {
  const baseTopic: Topic = {
    id: 'base',
    chapterId: 'c1',
    unitId: 'u1',
    subjectId: 's1',
    name: 'Topic',
    subtopics: [],
    status: 'Completed',
    difficulty: 'Medium',
    weightage: 10,
    estimatedMinutes: 45,
    actualMinutes: 45,
    confidence: 3,
    understanding: 3,
    notes: '',
    formulas: '',
    definitions: '',
    importantConcepts: '',
    prerequisites: [],
    examIds: ['e1'],
    practiceAttempted: 0,
    practiceCorrect: 0,
    lastStudiedAt: '2026-11-20',
    nextRevisionAt: null,
    revisionIntervalDays: 1,
    revisionCount: 1,
    priority: 'Medium',
    masteryScore: 50,
    order: 1,
  };

  const summary = getRevisionQueueSummary(
    [
      // Overdue AND Weak Area -> counted once under overdueTopics
      { ...baseTopic, id: 't-overdue-weak', status: 'Weak Area', nextRevisionAt: '2026-11-21' },
      // Due today by date
      { ...baseTopic, id: 't-today-date', status: 'Completed', nextRevisionAt: '2026-11-23' },
      // Due today by status without date
      { ...baseTopic, id: 't-status-due', status: 'Revision Due', nextRevisionAt: null },
      // Future revision -> excluded
      { ...baseTopic, id: 't-future', status: 'Mastered', nextRevisionAt: '2026-11-29' },
    ],
    '2026-11-23'
  );

  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.dueTodayCount, 2);
  assert.equal(summary.dueTotalCount, 3);
  assert.deepEqual(
    summary.allDueTopics.map((t) => t.id),
    ['t-overdue-weak', 't-today-date', 't-status-due']
  );
});

test('question bulk parser handles CSV, JSON, and numbered MCQ text blocks accurately', () => {
  const csvSample = `statement,optionA,optionB,optionC,optionD,correctAnswer,explanation,difficulty
"What is Macaulay duration of a zero-coupon bond maturing in 5 years?","0 years","2.5 years","5 years","10 years","C","A zero-coupon bond pays all cash at maturity.",Easy`;
  const csvParsed = parseQuestionsAuto(csvSample, 'bond_questions.csv');
  assert.equal(csvParsed.formatDetected, 'csv');
  assert.equal(csvParsed.drafts.length, 1);
  assert.equal(csvParsed.drafts[0].correctAnswer, '5 years');
  assert.equal(csvParsed.drafts[0].difficulty, 'Easy');

  const textSample = `1. Which test statistic checks variance equality across two normal populations?
A) z-test
B) F-test
C) Chi-square goodness-of-fit
D) Durbin-Watson
Answer: B
Explanation: Variance ratio tests rely on the F-distribution.

2. Define Type I error.
Answer: Rejecting a true null hypothesis`;

  const textParsed = parseQuestionsAuto(textSample, 'stats.txt');
  assert.equal(textParsed.formatDetected, 'text');
  assert.equal(textParsed.drafts.length, 2);
  assert.equal(textParsed.drafts[0].correctAnswer, 'F-test');
  assert.equal(textParsed.drafts[0].questionType, 'MCQ');
  assert.equal(textParsed.drafts[1].questionType, 'Conceptual');

  const materialized = materializeImportedQuestions({
    drafts: textParsed.drafts,
    subjectId: 'subj-qm',
    topicId: 'top-2',
    examId: 'exam-cfa-1',
    source: 'user_uploaded',
    sourceLabel: 'Personal Class Notes',
  });
  assert.equal(materialized.length, 2);
  assert.equal(materialized[0].source, 'user_uploaded');
  assert.equal(materialized[0].topicId, 'top-2');
});


