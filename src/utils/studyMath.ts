import type {
  DifficultyLevel,
  ExamTarget,
  MockTestAttempt,
  MockTestConfig,
  PlannerTask,
  Question,
  QuestionAttemptResult,
  RevisionConfig,
  StudySession,
  Subject,
  Topic,
} from '../types/study';

/**
 * Computes mastery score (0-100).
 * Explicitly enforces that marking a topic 'Completed' does NOT grant mastery:
 * mastery requires understanding, confidence, practice accuracy, and revision evidence.
 */
export function computeMasteryScore(topic: Pick<
  Topic,
  | 'status'
  | 'understanding'
  | 'confidence'
  | 'practiceAttempted'
  | 'practiceCorrect'
  | 'revisionCount'
>): number {
  if (topic.status === 'Not Started' && topic.practiceAttempted === 0) {
    return 0;
  }

  const understandingPct = (Math.max(1, Math.min(5, topic.understanding)) - 1) / 4; // 0..1
  const confidencePct = (Math.max(1, Math.min(5, topic.confidence)) - 1) / 4; // 0..1

  const practiceFactor =
    topic.practiceAttempted > 0
      ? Math.min(1, topic.practiceCorrect / topic.practiceAttempted)
      : 0.35; // Unpracticed topics cannot score full practice weight

  const revisionBonus = Math.min(1, topic.revisionCount / 3); // up to 3 revisions for full bonus

  let statusBase = 0.1;
  if (topic.status === 'Learning') statusBase = 0.25;
  else if (topic.status === 'Weak Area') statusBase = 0.15;
  else if (topic.status === 'Revision Due') statusBase = 0.55;
  else if (topic.status === 'Completed') statusBase = 0.55;
  else if (topic.status === 'Mastered') statusBase = 0.85;

  const raw =
    statusBase * 20 +
    understandingPct * 28 +
    confidencePct * 22 +
    practiceFactor * 20 +
    revisionBonus * 10;

  let score = Math.round(Math.max(0, Math.min(100, raw)));

  // Guardrail: Completed without practice/strong ratings cannot masquerade as mastered
  if (topic.status === 'Completed' && (topic.practiceAttempted === 0 || topic.understanding < 4)) {
    score = Math.min(score, 68);
  }
  if (topic.status === 'Weak Area') {
    score = Math.min(score, 48);
  }

  return score;
}

export type PerformanceBand = 'weak' | 'moderate' | 'strong';

export function classifyRevisionPerformance(
  accuracyPct: number | null,
  understanding: number,
  confidence: number
): PerformanceBand {
  const avgRating = (understanding + confidence) / 2;
  if ((accuracyPct !== null && accuracyPct < 55) || avgRating < 2.6) {
    return 'weak';
  }
  if ((accuracyPct !== null && accuracyPct >= 80) && avgRating >= 4) {
    return 'strong';
  }
  if (accuracyPct === null && avgRating >= 4.2) {
    return 'strong';
  }
  return 'moderate';
}

export function addDaysISO(dateISO: string, days: number): string {
  const base = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function computeNextRevision(
  band: PerformanceBand,
  fromDateISO: string,
  config: RevisionConfig
): { nextRevisionAt: string; intervalDays: number } {
  const intervalDays =
    band === 'weak'
      ? Math.max(1, config.weakIntervalDays)
      : band === 'moderate'
        ? Math.max(2, config.moderateIntervalDays)
        : Math.max(4, config.strongIntervalDays);

  return {
    nextRevisionAt: addDaysISO(fromDateISO, intervalDays),
    intervalDays,
  };
}

export interface OverlapSummary {
  sharedTopics: Array<{
    topicId: string;
    topicName: string;
    subjectName: string;
    examIds: string[];
    examNames: string[];
  }>;
  subjectOverlapMatrix: Array<{
    subjectId: string;
    subjectName: string;
    examCount: number;
    sharedTopicCount: number;
    totalTopicCount: number;
  }>;
}

export function findSyllabusOverlaps(
  topics: Topic[],
  subjects: Subject[],
  exams: ExamTarget[]
): OverlapSummary {
  const examMap = new Map(exams.map((e) => [e.id, e.name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const sharedTopics = topics
    .filter((t) => t.examIds.length >= 2)
    .map((t) => ({
      topicId: t.id,
      topicName: t.name,
      subjectName: subjectMap.get(t.subjectId)?.name ?? 'Unknown Subject',
      examIds: t.examIds,
      examNames: t.examIds.map((id) => examMap.get(id) ?? id),
    }));

  const subjectOverlapMatrix = subjects.map((subj) => {
    const subjTopics = topics.filter((t) => t.subjectId === subj.id);
    const sharedCount = subjTopics.filter((t) => t.examIds.length >= 2).length;
    const distinctExams = new Set<string>(subj.examIds);
    subjTopics.forEach((t) => t.examIds.forEach((id) => distinctExams.add(id)));

    return {
      subjectId: subj.id,
      subjectName: subj.name,
      examCount: distinctExams.size,
      sharedTopicCount: sharedCount,
      totalTopicCount: subjTopics.length,
    };
  });

  return { sharedTopics, subjectOverlapMatrix };
}

export function calculateExamReadiness(
  topics: Topic[],
  examId: string,
  mockTests: MockTestAttempt[]
): number {
  const relevantTopics =
    examId === 'all' ? topics : topics.filter((t) => t.examIds.includes(examId));

  if (relevantTopics.length === 0) return 0;

  let totalWeight = 0;
  let weightedMastery = 0;
  for (const t of relevantTopics) {
    const w = Math.max(1, t.weightage || 10);
    totalWeight += w;
    weightedMastery += w * t.masteryScore;
  }

  const syllabusMastery = totalWeight > 0 ? weightedMastery / totalWeight : 0;

  const relevantMocks =
    examId === 'all'
      ? mockTests
      : mockTests.filter((m) => m.config.examId === examId || m.config.examId === 'all');

  if (relevantMocks.length === 0) {
    return Math.round(syllabusMastery * 0.85);
  }

  const recentMocks = relevantMocks.slice(-3);
  const avgMockPct =
    recentMocks.reduce((acc, m) => acc + m.percentage, 0) / recentMocks.length;

  return Math.round(Math.min(100, syllabusMastery * 0.65 + avgMockPct * 0.35));
}

export function calculateStudyStreak(sessions: StudySession[], todayISO: string): number {
  if (sessions.length === 0) return 0;
  const activeDates = new Set(
    sessions.filter((s) => s.durationMinutes > 0).map((s) => s.date.slice(0, 10))
  );

  if (activeDates.size === 0) return 0;

  let cursor = todayISO.slice(0, 10);
  if (!activeDates.has(cursor)) {
    const yesterday = addDaysISO(cursor, -1);
    if (!activeDates.has(yesterday)) {
      return 0;
    }
    cursor = yesterday;
  }

  let streak = 0;
  while (activeDates.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

export interface GradedMockSummary {
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  questionResults: QuestionAttemptResult[];
  subjectBreakdown: Array<{
    subjectId: string;
    correct: number;
    total: number;
    accuracy: number;
  }>;
  difficultyBreakdown: Record<DifficultyLevel, { correct: number; total: number }>;
  weakTopicIds: string[];
}

export function gradeMockTest(
  questions: Question[],
  answers: Record<string, string>,
  markedForReview: Record<string, boolean>,
  timeSpentMap: Record<string, number>,
  config: MockTestConfig
): GradedMockSummary {
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let score = 0;
  const maxScore = questions.length * config.marksPerQuestion;

  const subjectMap = new Map<string, { correct: number; total: number }>();
  const topicMap = new Map<string, { correct: number; attempted: number; total: number }>();
  const difficultyBreakdown: Record<DifficultyLevel, { correct: number; total: number }> = {
    Easy: { correct: 0, total: 0 },
    Medium: { correct: 0, total: 0 },
    Hard: { correct: 0, total: 0 },
  };

  const questionResults: QuestionAttemptResult[] = questions.map((q) => {
    const rawAns = (answers[q.id] ?? '').trim();
    const isAttempted = rawAns.length > 0;
    const isCorrect =
      isAttempted && rawAns.toLowerCase() === q.correctAnswer.trim().toLowerCase();

    let marksAwarded = 0;
    if (!isAttempted) {
      unattemptedCount += 1;
    } else if (isCorrect) {
      correctCount += 1;
      marksAwarded = config.marksPerQuestion;
      score += marksAwarded;
    } else {
      incorrectCount += 1;
      marksAwarded = -Math.abs(config.negativeMarking);
      score += marksAwarded;
    }

    const subjStat = subjectMap.get(q.subjectId) ?? { correct: 0, total: 0 };
    subjStat.total += 1;
    if (isCorrect) subjStat.correct += 1;
    subjectMap.set(q.subjectId, subjStat);

    if (q.topicId) {
      const topStat = topicMap.get(q.topicId) ?? { correct: 0, attempted: 0, total: 0 };
      topStat.total += 1;
      if (isAttempted) topStat.attempted += 1;
      if (isCorrect) topStat.correct += 1;
      topicMap.set(q.topicId, topStat);
    }

    difficultyBreakdown[q.difficulty].total += 1;
    if (isCorrect) difficultyBreakdown[q.difficulty].correct += 1;

    return {
      questionId: q.id,
      userAnswer: isAttempted ? rawAns : null,
      correctAnswer: q.correctAnswer,
      isCorrect,
      isAttempted,
      markedForReview: Boolean(markedForReview[q.id]),
      timeSpentSeconds: timeSpentMap[q.id] ?? 0,
      marksAwarded,
      subjectId: q.subjectId,
      topicId: q.topicId,
      difficulty: q.difficulty,
    };
  });

  const attemptedCount = correctCount + incorrectCount;
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const percentage = maxScore > 0 ? Math.max(0, Math.round((score / maxScore) * 100)) : 0;

  const subjectBreakdown = Array.from(subjectMap.entries()).map(([subjectId, stat]) => ({
    subjectId,
    correct: stat.correct,
    total: stat.total,
    accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
  }));

  const weakTopicIds = Array.from(topicMap.entries())
    .filter(([, stat]) => stat.attempted > 0 && stat.correct / stat.attempted < 0.6)
    .map(([topicId]) => topicId);

  return {
    correctCount,
    incorrectCount,
    unattemptedCount,
    score: Number(score.toFixed(2)),
    maxScore,
    percentage,
    accuracy,
    questionResults,
    subjectBreakdown,
    difficultyBreakdown,
    weakTopicIds,
  };
}

export function generateHybridSchedule(params: {
  topics: Topic[];
  exams: ExamTarget[];
  startDateISO: string;
  days: number;
  dailyMinutesBudget: number;
  preferredDays: string[];
}): PlannerTask[] {
  const { topics, startDateISO, days, dailyMinutesBudget } = params;
  const priorityRank: Record<string, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  // Rank unfinished or revision-due topics by urgency
  const candidates = topics
    .filter((t) => t.status !== 'Mastered')
    .slice()
    .sort((a, b) => {
      const aDue = a.nextRevisionAt && a.nextRevisionAt <= startDateISO ? 20 : 0;
      const bDue = b.nextRevisionAt && b.nextRevisionAt <= startDateISO ? 20 : 0;
      const aWeak = a.status === 'Weak Area' ? 15 : 0;
      const bWeak = b.status === 'Weak Area' ? 15 : 0;
      const scoreA = priorityRank[a.priority] * 10 + a.weightage * 0.3 + aDue + aWeak - a.masteryScore * 0.2;
      const scoreB = priorityRank[b.priority] * 10 + b.weightage * 0.3 + bDue + bWeak - b.masteryScore * 0.2;
      return scoreB - scoreA;
    });

  if (candidates.length === 0) return [];

  const tasks: PlannerTask[] = [];
  let candidateIdx = 0;
  const maxTotalSlots = Math.max(days * 4, candidates.length * 2);

  for (let d = 0; d < days; d++) {
    const dateISO = addDaysISO(startDateISO, d);
    let remainingMinutes = Math.max(45, dailyMinutesBudget);
    let slotHour = 9;
    let dayTasks = 0;

    while (remainingMinutes >= 30 && tasks.length < maxTotalSlots && dayTasks < 4) {
      const topic = candidates[candidateIdx % candidates.length];
      candidateIdx += 1;

      const blockMinutes = Math.min(remainingMinutes, Math.max(30, Math.min(90, topic.estimatedMinutes || 60)));
      const isRevision =
        topic.status === 'Revision Due' ||
        topic.status === 'Completed' ||
        (topic.nextRevisionAt !== null && topic.nextRevisionAt <= dateISO);

      tasks.push({
        id: `plan-${dateISO}-${tasks.length + 1}`,
        title: `${isRevision ? 'Revise' : 'Study'}: ${topic.name}`,
        date: dateISO,
        startTime: `${String(slotHour).padStart(2, '0')}:00`,
        durationMinutes: blockMinutes,
        topicId: topic.id,
        subjectId: topic.subjectId,
        examId: topic.examIds[0],
        taskType: isRevision ? 'Revision' : 'Study',
        status: 'Pending',
        source: 'hybrid',
      });

      remainingMinutes -= blockMinutes;
      slotHour = Math.min(21, slotHour + Math.ceil(blockMinutes / 60) + 1);
      dayTasks += 1;
    }
  }

  return tasks;
}

export interface ExamCountdownMetrics {
  exam: ExamTarget;
  daysRemaining: number;
  hoursRemaining: number;
  totalWindowDays: number;
  elapsedDays: number;
  elapsedPercent: number;
  status: 'upcoming' | 'urgent' | 'today' | 'passed';
  remainingLabel: string;
}

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function parseISODateUTC(dateISO: string, hourUTC = 0): number {
  const clean = (dateISO || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return NaN;
  return Date.parse(`${clean}T${String(hourUTC).padStart(2, '0')}:00:00Z`);
}

export function sortExamsByNearest(exams: ExamTarget[], nowMs = Date.now()): ExamTarget[] {
  const todayISO = new Date(nowMs).toISOString().slice(0, 10);
  return exams.slice().sort((a, b) => {
    const aDate = (a.examDate || '').slice(0, 10);
    const bDate = (b.examDate || '').slice(0, 10);
    const aUpcoming = aDate >= todayISO ? 0 : 1;
    const bUpcoming = bDate >= todayISO ? 0 : 1;
    if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
    if (aUpcoming === 0) return aDate.localeCompare(bDate);
    return bDate.localeCompare(aDate);
  });
}

export function computeExamCountdown(
  exam: ExamTarget,
  nowMs = Date.now()
): ExamCountdownMetrics {
  const examDateISO = (exam.examDate || new Date(nowMs).toISOString().slice(0, 10)).slice(0, 10);
  const todayISO = new Date(nowMs).toISOString().slice(0, 10);

  const examStartOfDayMs = parseISODateUTC(examDateISO, 0);
  const examTargetMs = Number.isNaN(examStartOfDayMs) ? nowMs : examStartOfDayMs + 9 * MS_PER_HOUR;

  const fallbackStartISO = addDaysISO(examDateISO, -90);
  const prepStartISO =
    exam.prepStartDate && /^\d{4}-\d{2}-\d{2}$/.test(exam.prepStartDate.slice(0, 10))
      ? exam.prepStartDate.slice(0, 10)
      : fallbackStartISO;
  const parsedPrepStartMs = parseISODateUTC(prepStartISO, 0);
  const prepStartMs = Number.isNaN(parsedPrepStartMs)
    ? examTargetMs - 90 * MS_PER_DAY
    : Math.min(parsedPrepStartMs, examTargetMs - MS_PER_DAY);

  const totalWindowMs = Math.max(MS_PER_DAY, examTargetMs - prepStartMs);
  const totalWindowDays = Math.max(1, Math.round(totalWindowMs / MS_PER_DAY));
  const rawElapsedMs = Math.max(0, Math.min(totalWindowMs, nowMs - prepStartMs));
  const elapsedDays = Math.max(0, Math.round(rawElapsedMs / MS_PER_DAY));

  if (examDateISO === todayISO) {
    return {
      exam,
      daysRemaining: 0,
      hoursRemaining: 0,
      totalWindowDays,
      elapsedDays: totalWindowDays,
      elapsedPercent: 100,
      status: 'today',
      remainingLabel: 'Exam Day',
    };
  }

  const msRemaining = examTargetMs - nowMs;
  if (msRemaining <= 0 || examDateISO < todayISO) {
    const daysAgo = Math.max(1, Math.round(Math.abs(msRemaining) / MS_PER_DAY));
    return {
      exam,
      daysRemaining: 0,
      hoursRemaining: 0,
      totalWindowDays,
      elapsedDays: totalWindowDays,
      elapsedPercent: 100,
      status: 'passed',
      remainingLabel: `Passed ${daysAgo}d ago`,
    };
  }

  const daysRemaining = Math.floor(msRemaining / MS_PER_DAY);
  const hoursRemaining = Math.floor((msRemaining % MS_PER_DAY) / MS_PER_HOUR);
  const elapsedPercent = Math.max(0, Math.min(99, Math.round((rawElapsedMs / totalWindowMs) * 100)));
  const status = daysRemaining <= 14 ? 'urgent' : 'upcoming';
  const remainingLabel =
    daysRemaining < 1
      ? `${Math.max(1, hoursRemaining)}h left`
      : `${daysRemaining}d ${hoursRemaining}h left`;

  return {
    exam,
    daysRemaining,
    hoursRemaining,
    totalWindowDays,
    elapsedDays,
    elapsedPercent,
    status,
    remainingLabel,
  };
}

export interface RevisionQueueSummary {
  overdueTopics: Topic[];
  dueTodayTopics: Topic[];
  allDueTopics: Topic[];
  overdueCount: number;
  dueTodayCount: number;
  dueTotalCount: number;
}

/**
 * Computes deduplicated due-today + overdue revision topics so navigation badges,
 * Dashboard reminder counters, and the Revision Queue always stay in sync.
 */
export function getRevisionQueueSummary(
  topics: Topic[],
  todayISO: string
): RevisionQueueSummary {
  const cleanToday = todayISO.slice(0, 10);
  const overdueTopics: Topic[] = [];
  const dueTodayTopics: Topic[] = [];

  for (const t of topics) {
    const revDate = t.nextRevisionAt ? t.nextRevisionAt.slice(0, 10) : null;
    if (revDate !== null && revDate < cleanToday) {
      overdueTopics.push(t);
    } else if (
      t.status === 'Revision Due' ||
      t.status === 'Weak Area' ||
      revDate === cleanToday
    ) {
      dueTodayTopics.push(t);
    }
  }

  const allDueTopics = [...overdueTopics, ...dueTodayTopics];
  return {
    overdueTopics,
    dueTodayTopics,
    allDueTopics,
    overdueCount: overdueTopics.length,
    dueTodayCount: dueTodayTopics.length,
    dueTotalCount: allDueTopics.length,
  };
}


