export type NavRoute =
  | 'dashboard'
  | 'my-study'
  | 'syllabus'
  | 'planner'
  | 'practice'
  | 'mock-tests'
  | 'revision'
  | 'notes'
  | 'analytics'
  | 'ai-assistant'
  | 'settings';

export type TopicStatus =
  | 'Not Started'
  | 'Learning'
  | 'Completed'
  | 'Revision Due'
  | 'Weak Area'
  | 'Mastered';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type QuestionType = 'MCQ' | 'Numerical' | 'Conceptual' | 'Descriptive';
export type QuestionSource = 'verified_pyq' | 'user_uploaded' | 'ai_generated';
export type MistakeType =
  | 'Conceptual Gap'
  | 'Calculation Error'
  | 'Misread Prompt'
  | 'Formula Recall'
  | 'Time Pressure';

export interface StudyProfile {
  studentName: string;
  courseName: string;
  courseCategory: string;
  preparationLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Repeating / Refining';
  dailyHoursTarget: number;
  weeklyHoursTarget: number;
  preferredStudyDays: string[];
  breakPreference: string;
  autoGeneratePlan: boolean;
  onboardingCompleted: boolean;
  isDemoMode: boolean;
}

export interface ExamTarget {
  id: string;
  name: string;
  examDate: string; // YYYY-MM-DD
  prepStartDate?: string; // YYYY-MM-DD
  attemptYear: string;
  targetScore: string;
  color: string;
  notes?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  color: string;
  order: number;
  examIds: string[];
}

export interface Unit {
  id: string;
  subjectId: string;
  name: string;
  order: number;
}

export interface Chapter {
  id: string;
  unitId: string;
  subjectId: string;
  name: string;
  order: number;
}

export interface Topic {
  id: string;
  chapterId: string;
  unitId: string;
  subjectId: string;
  name: string;
  subtopics: string[];
  status: TopicStatus;
  difficulty: DifficultyLevel;
  weightage: number; // 1-100 relative importance
  estimatedMinutes: number;
  actualMinutes: number;
  confidence: number; // 1-5
  understanding: number; // 1-5
  notes: string;
  formulas: string;
  definitions: string;
  importantConcepts: string;
  prerequisites: string[];
  examIds: string[];
  practiceAttempted: number;
  practiceCorrect: number;
  lastStudiedAt: string | null;
  nextRevisionAt: string | null;
  revisionIntervalDays: number;
  revisionCount: number;
  priority: PriorityLevel;
  masteryScore: number; // 0-100
  order: number;
}

export interface StudySession {
  id: string;
  topicId?: string;
  subjectId?: string;
  examId?: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  activityType: 'Study' | 'Revision' | 'Practice' | 'Mock Test';
  notes: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  topicId?: string;
  subjectId?: string;
  examId?: string;
  taskType: 'Study' | 'Revision' | 'Practice' | 'Mock' | 'Goal';
  status: 'Pending' | 'In Progress' | 'Done' | 'Postponed';
  source: 'manual' | 'ai_generated' | 'hybrid';
}

export interface Question {
  id: string;
  statement: string;
  options?: string[];
  correctAnswer: string;
  solution: string;
  explanation: string;
  difficulty: DifficultyLevel;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  examId?: string;
  year?: string;
  marks: number;
  negativeMarks: number;
  questionType: QuestionType;
  source: QuestionSource;
  sourceLabel: string;
  bookmarked: boolean;
  reportedIssue?: string;
}

export interface MistakeEntry {
  id: string;
  questionId: string;
  questionStatement: string;
  subjectId: string;
  topicId?: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  mistakeType: MistakeType;
  correctiveAction: string;
  resolved: boolean;
  createdAt: string;
}

export interface MockTestConfig {
  title: string;
  durationMinutes: number;
  questionCount: number;
  subjectIds: string[];
  chapterIds: string[];
  topicIds: string[];
  difficulty: 'All' | DifficultyLevel;
  questionFormat: 'All' | QuestionType;
  examId: string;
  marksPerQuestion: number;
  negativeMarking: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
}

export interface QuestionAttemptResult {
  questionId: string;
  userAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  isAttempted: boolean;
  markedForReview: boolean;
  timeSpentSeconds: number;
  marksAwarded: number;
  subjectId: string;
  topicId?: string;
  difficulty: DifficultyLevel;
}

export interface MockTestAttempt {
  id: string;
  title: string;
  config: MockTestConfig;
  startedAt: string;
  completedAt: string;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  totalTimeSeconds: number;
  questionResults: QuestionAttemptResult[];
}

export interface Flashcard {
  id: string;
  topicId?: string;
  subjectId: string;
  front: string;
  back: string;
  source: 'user' | 'ai_generated';
  masteryLevel: number; // 0-5
  nextReviewAt?: string;
}

export interface UploadedResource {
  id: string;
  title: string;
  type: 'PDF' | 'DOCX' | 'XLSX' | 'Image' | 'URL' | 'Note' | 'TXT';
  subjectId?: string;
  topicId?: string;
  summary?: string;
  contentSnippet: string;
  uploadedAt: string;
}

export type DashboardWidgetId =
  | 'overall_completion'
  | 'subject_completion'
  | 'study_hours_activity'
  | 'exam_countdowns'
  | 'todays_agenda'
  | 'revision_queue'
  | 'weak_topics'
  | 'test_accuracy'
  | 'goals_readiness'
  | 'recent_activity'
  | 'quick_actions';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  title: string;
  visible: boolean;
  span: 1 | 2;
  order: number;
}

export interface DashboardFilters {
  subjectId: string; // 'all' or subjectId
  examId: string; // 'all' or examId
  timeRange: '7d' | '30d' | '90d' | 'all';
  topicStatus: 'all' | TopicStatus;
}

export interface RevisionConfig {
  weakIntervalDays: number;
  moderateIntervalDays: number;
  strongIntervalDays: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  modelUsed?: string;
  groundingSources?: GroundingSource[];
  createdAt: string;
  isAiGenerated: boolean;
}

export interface AppState {
  profile: StudyProfile;
  exams: ExamTarget[];
  subjects: Subject[];
  units: Unit[];
  chapters: Chapter[];
  topics: Topic[];
  sessions: StudySession[];
  tasks: PlannerTask[];
  questions: Question[];
  mistakes: MistakeEntry[];
  mockTests: MockTestAttempt[];
  flashcards: Flashcard[];
  resources: UploadedResource[];
  dashboardConfig: {
    widgets: DashboardWidgetConfig[];
    filters: DashboardFilters;
  };
  revisionConfig: RevisionConfig;
  tutorHistory: TutorMessage[];
}

export interface ExtractedSyllabusDraft {
  subjects: Array<{
    name: string;
    code: string;
    examNames: string[];
    units: Array<{
      name: string;
      chapters: Array<{
        name: string;
        topics: Array<{
          name: string;
          subtopics: string[];
          difficulty: DifficultyLevel;
          weightage: number;
          estimatedMinutes: number;
          prerequisites: string[];
        }>;
      }>;
    }>;
  }>;
  extractionNotes?: string;
}
