import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CloudRain,
  GraduationCap,
  Headphones,
  Moon,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ExamTarget, StudyProfile } from '../types/study';
import { getTodayISO } from '../data/demoData';
import { computeExamCountdown, sortExamsByNearest } from '../utils/studyMath';
import { AmbientAudioPanel } from './AmbientAudioPanel';

interface WelcomeViewProps {
  profile: StudyProfile;
  exams: ExamTarget[];
  totalTopicsCount: number;
  completedTopicsCount: number;
  theme: 'dark' | 'light';
  rainVisualEnabled: boolean;
  onToggleRainVisual: () => void;
  onToggleTheme: () => void;
  onCompleteSetup: (payload: {
    profile: Partial<StudyProfile>;
    exams: Array<Omit<ExamTarget, 'id'>>;
    subjectNames: string[];
  }) => void;
  onLoadDemo: () => void;
  onEnterWorkspace: () => void;
}

type WelcomeTab = 'overview' | 'audio' | 'capabilities';
type SetupStep = 1 | 2 | 3 | 4;

const COURSE_CATEGORIES = [
  'Professional Certification (CFA, CA, FRM, CPA)',
  'Competitive Examination (UPSC, GATE, CUET, CAT)',
  'University Degree (B.Tech, B.Sc, MBA)',
  'School & Board Studies',
  'Skill-Based Learning / Custom Course',
];

const QUICK_COURSES: Array<{ label: string; category: string; subjects: string[] }> = [
  {
    label: 'CFA Level I',
    category: COURSE_CATEGORIES[0],
    subjects: ['Ethical & Professional Standards', 'Quantitative Methods', 'Fixed Income', 'Financial Statement Analysis'],
  },
  {
    label: 'UPSC CSE',
    category: COURSE_CATEGORIES[1],
    subjects: ['Polity & Governance', 'Modern History', 'Geography', 'Indian Economy'],
  },
  {
    label: 'GATE CS',
    category: COURSE_CATEGORIES[1],
    subjects: ['Engineering Mathematics', 'Algorithms & Data Structures', 'Operating Systems', 'Computer Networks'],
  },
  {
    label: 'B.Tech',
    category: COURSE_CATEGORIES[2],
    subjects: ['Linear Algebra', 'Discrete Mathematics', 'Data Structures', 'Digital Logic'],
  },
  {
    label: 'CA Intermediate',
    category: COURSE_CATEGORIES[0],
    subjects: ['Advanced Accounting', 'Corporate & Other Laws', 'Taxation', 'Cost & Management Accounting'],
  },
];

const STUDY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PREP_LEVELS: StudyProfile['preparationLevel'][] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Repeating / Refining',
];

const EXAM_COLORS = ['#7C3AED', '#06B6D4', '#F97316', '#EC4899', '#22C55E'];

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  profile,
  exams,
  totalTopicsCount,
  completedTopicsCount,
  theme,
  rainVisualEnabled,
  onToggleRainVisual,
  onToggleTheme,
  onCompleteSetup,
  onLoadDemo,
  onEnterWorkspace,
}) => {
  const hasExistingProfile = profile.onboardingCompleted;
  const [activeTab, setActiveTab] = useState<WelcomeTab>('overview');
  const [showInlineSetup, setShowInlineSetup] = useState<boolean>(() => !hasExistingProfile);
  const [step, setStep] = useState<SetupStep>(1);

  // Inline Setup Form State (preserved across tab switches)
  const [studentName, setStudentName] = useState(
    profile.studentName && profile.studentName !== 'Scholar' ? profile.studentName : ''
  );
  const [courseName, setCourseName] = useState(profile.courseName || '');
  const [courseCategory, setCourseCategory] = useState(
    profile.courseCategory || COURSE_CATEGORIES[0]
  );
  const [preparationLevel, setPreparationLevel] = useState<StudyProfile['preparationLevel']>(
    profile.preparationLevel || 'Intermediate'
  );

  const [draftExams, setDraftExams] = useState<Array<Omit<ExamTarget, 'id'>>>(() =>
    exams.length > 0
      ? exams.map(({ id: _id, ...rest }) => rest)
      : [
          {
            name: '',
            examDate: '',
            prepStartDate: getTodayISO(),
            attemptYear: String(new Date().getFullYear() + 1),
            targetScore: '',
            color: '#7C3AED',
          },
        ]
  );

  const [subjectInput, setSubjectInput] = useState('');
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [dailyHoursTarget, setDailyHoursTarget] = useState(profile.dailyHoursTarget || 3);
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(profile.weeklyHoursTarget || 20);
  const [preferredStudyDays, setPreferredStudyDays] = useState<string[]>(
    profile.preferredStudyDays.length > 0
      ? profile.preferredStudyDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [breakPreference, setBreakPreference] = useState(
    profile.breakPreference || '50m focus / 10m break'
  );
  const [autoGeneratePlan, setAutoGeneratePlan] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const nearestExamMetrics = useMemo(() => {
    if (exams.length === 0) return null;
    const sorted = sortExamsByNearest(exams);
    return computeExamCountdown(sorted[0]);
  }, [exams]);

  const suggestedSubjects = useMemo(() => {
    const match = QUICK_COURSES.find((q) =>
      courseName.toLowerCase().includes(q.label.split(' ')[0].toLowerCase())
    );
    return match ? match.subjects : QUICK_COURSES[0].subjects;
  }, [courseName]);

  const handleStudyRoomTabClick = () => {
    setActiveTab('overview');
    if (!hasExistingProfile) {
      setShowInlineSetup(true);
    }
  };

  const handlePickStarterCourse = (preset: (typeof QUICK_COURSES)[number]) => {
    setCourseName(preset.label);
    setCourseCategory(preset.category);
    if (subjectNames.length === 0) {
      setSubjectNames(preset.subjects);
    }
    if (draftExams.length === 1 && !draftExams[0].name.trim()) {
      setDraftExams((prev) => [{ ...prev[0], name: preset.label }, ...prev.slice(1)]);
    }
    setValidationError(null);
  };

  const handleAddExamRow = () => {
    setDraftExams((prev) => [
      ...prev,
      {
        name: '',
        examDate: '',
        prepStartDate: getTodayISO(),
        attemptYear: String(new Date().getFullYear() + 1),
        targetScore: '',
        color: EXAM_COLORS[prev.length % EXAM_COLORS.length],
      },
    ]);
  };

  const handleAddSubject = () => {
    const trimmed = subjectInput.trim();
    if (!trimmed) return;
    if (!subjectNames.includes(trimmed)) {
      setSubjectNames((prev) => [...prev, trimmed]);
    }
    setSubjectInput('');
  };

  const handleToggleDay = (day: string) => {
    setPreferredStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleNextStep = () => {
    setValidationError(null);
    if (step === 1 && !courseName.trim()) {
      setValidationError('Tell Study Buddy what course, degree, or exam you are studying.');
      return;
    }
    if (step === 2) {
      const validExams = draftExams.filter((e) => e.name.trim().length > 0);
      if (validExams.length === 0) {
        setValidationError('Add at least one target examination so we can track your countdown.');
        return;
      }
    }
    setStep((s) => (s < 4 ? ((s + 1) as SetupStep) : s));
  };

  const handleFinishInlineSetup = () => {
    setValidationError(null);
    const cleanedExams = draftExams
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        ...e,
        name: e.name.trim(),
        examDate: e.examDate || getTodayISO(),
        prepStartDate: e.prepStartDate || getTodayISO(),
        targetScore: e.targetScore.trim() || 'Target Mastery',
      }));

    if (!courseName.trim() || cleanedExams.length === 0) {
      setValidationError('Ensure your course and at least one examination target are filled in.');
      return;
    }

    onCompleteSetup({
      profile: {
        studentName: studentName.trim() || 'Scholar',
        courseName: courseName.trim(),
        courseCategory,
        preparationLevel,
        dailyHoursTarget: Number(dailyHoursTarget) || 3,
        weeklyHoursTarget: Number(weeklyHoursTarget) || 20,
        preferredStudyDays,
        breakPreference,
        autoGeneratePlan,
      },
      exams: cleanedExams,
      subjectNames,
    });
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col justify-between text-white">
      {/* Ultra-Sheer Top Glass Header */}
      <header className="px-5 sm:px-10 py-3.5 flex items-center justify-between gap-4 bg-[#0B0C1E]/24 backdrop-blur-md border-b border-white/15">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#7C3AED]/78 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-lg font-bold tracking-tight text-white block leading-tight">
              Study Buddy
            </span>
            <p className="text-[11px] text-slate-200/90 truncate">
              Your go-to tutor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleRainVisual}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md transition-all duration-200 ${
              rainVisualEnabled
                ? 'bg-[#06B6D4]/18 border-[#06B6D4]/45 text-[#67E8F9]'
                : 'bg-white/8 border-white/15 text-slate-200 hover:bg-white/15'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rain Motion</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl bg-white/8 hover:bg-white/18 border border-white/18 backdrop-blur-md text-white transition-all duration-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {hasExistingProfile && (
            <button
              type="button"
              onClick={onEnterWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C3AED]/78 hover:bg-[#6D28D9] border border-white/25 backdrop-blur-md text-xs font-semibold text-white transition-all duration-200"
            >
              Open Workspace
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Centrally Aligned Study Room Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-6 sm:py-10">
        <div className="w-full max-w-2xl rounded-3xl bg-[#0D0F24]/34 backdrop-blur-xl border border-white/22 p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Centered Brand Eyebrow & Ultra-Sheer Glass Tabs */}
          <div className="flex flex-col items-center text-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#67E8F9]">
              Study Buddy · Your go-to tutor
            </p>

            <div
              role="tablist"
              aria-label="Study room experience tabs"
              className="inline-flex flex-wrap justify-center gap-1.5 p-1 rounded-2xl bg-white/[0.06] border border-white/18 backdrop-blur-md"
            >
              {(
                [
                  { id: 'overview', label: 'Study Room' },
                  { id: 'audio', label: 'Rain & Study Music' },
                  { id: 'capabilities', label: 'Academic System' },
                ] as const
              ).map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={selected}
                    type="button"
                    onClick={() =>
                      tab.id === 'overview' ? handleStudyRoomTabClick() : setActiveTab(tab.id)
                    }
                    className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                      selected ? 'text-white' : 'text-slate-200/90 hover:text-white'
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="welcome-tab-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-white/18 border border-white/32 shadow-sm backdrop-blur-md"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key={showInlineSetup ? 'inline-setup' : 'returning-summary'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="space-y-5"
              >
                {showInlineSetup ? (
                  /* First-Time (or Reconfigure) Guided Setup Inside Centered Study Room */
                  <div className="space-y-5">
                    <div className="text-center space-y-2">
                      <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        {step === 1 && 'What are you studying?'}
                        {step === 2 && 'Which exam(s) are you targeting?'}
                        {step === 3 && 'Which subjects are on your syllabus?'}
                        {step === 4 && 'How do you like to study?'}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-200/90 max-w-lg mx-auto">
                        {step === 1 &&
                          'Answer 4 quick questions inside your Study Room to set up Study Buddy right away.'}
                        {step === 2 &&
                          'Add one or more exam dates so Study Buddy tracks your countdown bar on every screen.'}
                        {step === 3 &&
                          'Seed starter subjects now—you can also import full PDF, DOCX, or URL syllabi inside.'}
                        {step === 4 &&
                          'Set your focus rhythm and optionally generate a starter study plan automatically.'}
                      </p>

                      {/* Centered Step Progress Track */}
                      <div className="flex items-center justify-center gap-2 pt-1">
                        {([1, 2, 3, 4] as const).map((num) => (
                          <button
                            key={num}
                            type="button"
                            aria-label={`Question ${num} of 4`}
                            onClick={() => {
                              setValidationError(null);
                              if (num <= step || courseName.trim()) {
                                setStep(num);
                              }
                            }}
                            className={`h-2 rounded-full transition-all duration-200 ${
                              step === num
                                ? 'w-8 bg-[#7C3AED] border border-white/40'
                                : step > num
                                  ? 'w-4 bg-[#10B981]'
                                  : 'w-4 bg-white/20'
                            }`}
                          />
                        ))}
                        <span className="ml-2 font-mono text-[11px] text-slate-200 tabular-nums">
                          {step}/4
                        </span>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {step === 1 && (
                        <motion.div
                          key="q-step-1"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.16 }}
                          className="space-y-4 text-left"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor="wb-student-name"
                                className="block text-xs font-medium text-slate-200 mb-1"
                              >
                                Your Name
                              </label>
                              <input
                                id="wb-student-name"
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="e.g. Aarav"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-300/70 focus:outline-none focus:border-[#67E8F9]"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="wb-course-name"
                                className="block text-xs font-medium text-slate-200 mb-1"
                              >
                                Course / Exam / Degree *
                              </label>
                              <input
                                id="wb-course-name"
                                type="text"
                                value={courseName}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="e.g. CFA Level I, UPSC, GATE"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-300/70 focus:outline-none focus:border-[#67E8F9]"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {QUICK_COURSES.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => handlePickStarterCourse(preset)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border backdrop-blur-md transition-colors ${
                                  courseName === preset.label
                                    ? 'bg-[#7C3AED]/65 border-white/40 text-white'
                                    : 'bg-white/8 border-white/15 text-slate-200 hover:bg-white/18'
                                }`}
                              >
                                + {preset.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label
                                htmlFor="wb-course-cat"
                                className="block text-xs font-medium text-slate-200 mb-1"
                              >
                                Category
                              </label>
                              <select
                                id="wb-course-cat"
                                value={courseCategory}
                                onChange={(e) => setCourseCategory(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#12142D]/85 border border-white/20 text-xs text-white focus:outline-none focus:border-[#67E8F9]"
                              >
                                {COURSE_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className="block text-xs font-medium text-slate-200 mb-1">
                                Current Preparation Level
                              </span>
                              <div className="grid grid-cols-2 gap-1.5">
                                {PREP_LEVELS.map((lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setPreparationLevel(lvl)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors truncate ${
                                      preparationLevel === lvl
                                        ? 'bg-[#7C3AED]/70 border-white/40 text-white'
                                        : 'bg-white/8 border-white/15 text-slate-200 hover:bg-white/16'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {step === 2 && (
                        <motion.div
                          key="q-step-2"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.16 }}
                          className="space-y-3 text-left"
                        >
                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {draftExams.map((ex, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-2xl bg-white/8 border border-white/16 backdrop-blur-md space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-mono text-[#67E8F9]">
                                    Exam Target #{idx + 1}
                                  </span>
                                  {draftExams.length > 1 && (
                                    <button
                                      type="button"
                                      aria-label={`Remove exam target ${idx + 1}`}
                                      onClick={() =>
                                        setDraftExams((prev) => prev.filter((_, i) => i !== idx))
                                      }
                                      className="p-1 rounded-lg text-slate-300 hover:text-[#FCA5A5]"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input
                                    type="text"
                                    value={ex.name}
                                    onChange={(e) =>
                                      setDraftExams((prev) =>
                                        prev.map((row, i) =>
                                          i === idx ? { ...row, name: e.target.value } : row
                                        )
                                      )
                                    }
                                    placeholder="Exam name *"
                                    aria-label={`Exam ${idx + 1} name`}
                                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-300/70"
                                  />
                                  <input
                                    type="date"
                                    value={ex.examDate}
                                    onChange={(e) =>
                                      setDraftExams((prev) =>
                                        prev.map((row, i) =>
                                          i === idx
                                            ? {
                                                ...row,
                                                examDate: e.target.value,
                                                attemptYear:
                                                  e.target.value.slice(0, 4) || row.attemptYear,
                                              }
                                            : row
                                        )
                                      )
                                    }
                                    aria-label={`Exam ${idx + 1} date`}
                                    className="px-3 py-2 rounded-xl bg-[#12142D]/80 border border-white/20 text-xs font-mono text-white"
                                  />
                                  <input
                                    type="text"
                                    value={ex.targetScore}
                                    onChange={(e) =>
                                      setDraftExams((prev) =>
                                        prev.map((row, i) =>
                                          i === idx ? { ...row, targetScore: e.target.value } : row
                                        )
                                      )
                                    }
                                    placeholder="Target score / rank"
                                    aria-label={`Exam ${idx + 1} target score`}
                                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-300/70"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleAddExamRow}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Another Exam
                          </button>
                        </motion.div>
                      )}

                      {step === 3 && (
                        <motion.div
                          key="q-step-3"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.16 }}
                          className="space-y-3.5 text-left"
                        >
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={subjectInput}
                              onChange={(e) => setSubjectInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddSubject();
                                }
                              }}
                              placeholder="Type a subject and press Enter..."
                              aria-label="Add subject name"
                              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-300/70 focus:outline-none focus:border-[#67E8F9]"
                            />
                            <button
                              type="button"
                              onClick={handleAddSubject}
                              className="px-4 py-2.5 rounded-xl bg-[#7C3AED]/85 hover:bg-[#6D28D9] border border-white/25 text-xs font-semibold text-white shrink-0"
                            >
                              Add
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-slate-300 mr-1">Suggestions:</span>
                            {suggestedSubjects.map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  if (!subjectNames.includes(sug)) {
                                    setSubjectNames((prev) => [...prev, sug]);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/18 border border-white/16 text-[11px] text-slate-200 transition-colors"
                              >
                                + {sug}
                              </button>
                            ))}
                          </div>

                          <div className="min-h-[60px] p-3 rounded-2xl bg-white/[0.06] border border-white/15 flex flex-wrap gap-2 items-center">
                            {subjectNames.length === 0 ? (
                              <p className="text-xs text-slate-300 mx-auto">
                                No subjects added yet — click suggestions above or skip to import a file later.
                              </p>
                            ) : (
                              subjectNames.map((subj) => (
                                <span
                                  key={subj}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#7C3AED]/35 border border-white/25 text-xs font-medium text-white"
                                >
                                  {subj}
                                  <button
                                    type="button"
                                    aria-label={`Remove subject ${subj}`}
                                    onClick={() =>
                                      setSubjectNames((prev) => prev.filter((s) => s !== subj))
                                    }
                                    className="text-slate-200 hover:text-white ml-0.5"
                                  >
                                    &times;
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}

                      {step === 4 && (
                        <motion.div
                          key="q-step-4"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.16 }}
                          className="space-y-4 text-left"
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                              <label
                                htmlFor="wb-daily-hrs"
                                className="block text-xs font-medium text-slate-200 mb-1"
                              >
                                Daily Hours
                              </label>
                              <input
                                id="wb-daily-hrs"
                                type="number"
                                min={1}
                                max={16}
                                value={dailyHoursTarget}
                                onChange={(e) => setDailyHoursTarget(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-mono text-white"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="wb-weekly-hrs"
                                className="block text-xs font-medium text-slate-200 mb-1"
                              >
                                Weekly Hours
                              </label>
                              <input
                                id="wb-weekly-hrs"
                                type="number"
                                min={1}
                                max={100}
                                value={weeklyHoursTarget}
                                onChange={(e) => setWeeklyHoursTarget(Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-mono text-white"
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <label
                                htmlFor="wb-break-pref"
                                className="block text-xs font-medium text-slate-200 mb-1"
                              >
                                Focus Rhythm
                              </label>
                              <select
                                id="wb-break-pref"
                                value={breakPreference}
                                onChange={(e) => setBreakPreference(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-[#12142D]/85 border border-white/20 text-xs text-white"
                              >
                                <option>25m focus / 5m break</option>
                                <option>50m focus / 10m break</option>
                                <option>90m deep work / 20m break</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <span className="block text-xs font-medium text-slate-200 mb-1.5">
                              Preferred Study Days
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {STUDY_DAYS.map((day) => {
                                const on = preferredStudyDays.includes(day);
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleToggleDay(day)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                                      on
                                        ? 'bg-[#7C3AED]/75 border-white/35 text-white'
                                        : 'bg-white/8 border-white/16 text-slate-200 hover:bg-white/16'
                                    }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/8 border border-white/16 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoGeneratePlan}
                              onChange={(e) => setAutoGeneratePlan(e.target.checked)}
                              className="w-4 h-4 accent-[#7C3AED]"
                            />
                            <span className="text-xs text-slate-100">
                              Auto-generate my initial 5-day Study Plan immediately after setup
                            </span>
                          </label>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {validationError && (
                      <div
                        role="alert"
                        className="px-3.5 py-2 rounded-xl bg-[#EF4444]/20 border border-[#EF4444]/40 text-xs text-[#FECACA] text-center"
                      >
                        {validationError}
                      </div>
                    )}

                    {/* Centered Setup Action Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/14">
                      <div className="flex items-center gap-2">
                        {step > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setValidationError(null);
                              setStep((s) => (s - 1) as SetupStep);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/18 text-xs font-semibold text-white transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back
                          </button>
                        ) : hasExistingProfile ? (
                          <button
                            type="button"
                            onClick={() => setShowInlineSetup(false)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/18 text-xs font-semibold text-white transition-colors"
                          >
                            Cancel
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={onLoadDemo}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/18 border border-white/16 text-xs font-semibold text-[#67E8F9] transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Sample Demo
                        </button>
                      </div>

                      {step < 4 ? (
                        <button
                          type="button"
                          onClick={handleNextStep}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#7C3AED]/88 hover:bg-[#6D28D9] border border-white/25 text-xs sm:text-sm font-semibold text-white shadow-lg transition-colors"
                        >
                          Next Question
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleFinishInlineSetup}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 text-xs sm:text-sm font-bold shadow-lg transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Launch Study Buddy
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Returning User Profile Summary inside Centered Study Room */
                  <div className="text-center space-y-5">
                    <div className="space-y-2">
                      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                        Welcome back, {profile.studentName || 'Scholar'}
                      </h1>
                      <p className="text-sm text-slate-200 max-w-lg mx-auto">
                        Your quiet study room is ready. Pick up where you left off or fine-tune your Study Buddy setup.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      <div className="p-3.5 rounded-2xl bg-white/8 border border-white/16 backdrop-blur-md">
                        <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-[#67E8F9]" />
                          Active Track
                        </p>
                        <p className="text-sm font-bold text-white mt-1 truncate">
                          {profile.courseName || 'Custom Curriculum'}
                        </p>
                        <p className="text-[11px] text-slate-300 truncate">
                          {profile.preparationLevel} · {profile.dailyHoursTarget}h/day
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white/8 border border-white/16 backdrop-blur-md">
                        <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5 text-[#A78BFA]" />
                          Nearest Exam
                        </p>
                        {nearestExamMetrics ? (
                          <>
                            <p className="text-sm font-bold text-white mt-1 truncate">
                              {nearestExamMetrics.exam.name}
                            </p>
                            <p className="text-[11px] font-mono text-[#67E8F9] tabular-nums">
                              {nearestExamMetrics.remainingLabel}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-300 mt-1">No exam target set</p>
                        )}
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white/8 border border-white/16 backdrop-blur-md">
                        <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#34D399]" />
                          Syllabus Progress
                        </p>
                        <p className="text-sm font-bold text-white mt-1 font-mono tabular-nums">
                          {completedTopicsCount}/{totalTopicsCount} topics
                        </p>
                        <p className="text-[11px] text-slate-300">
                          {exams.length} {exams.length === 1 ? 'exam target' : 'exam targets'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={onEnterWorkspace}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#7C3AED]/90 hover:bg-[#6D28D9] border border-white/25 text-white text-sm font-semibold shadow-lg transition-colors"
                      >
                        Resume Studying
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setShowInlineSetup(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/18 backdrop-blur-md text-white text-sm font-semibold transition-colors"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        Update Setup
                      </button>

                      <button
                        type="button"
                        onClick={onLoadDemo}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/8 hover:bg-white/16 border border-white/16 backdrop-blur-md text-[#67E8F9] text-sm font-semibold transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                        Sample Demo
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'audio' && (
              <motion.div
                key="audio"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="space-y-3"
              >
                <div className="flex items-center justify-center gap-2">
                  <Headphones className="w-4 h-4 text-[#67E8F9]" />
                  <h2 className="font-display text-lg font-bold text-white">
                    Cozy Rain &amp; Lo-Fi Study Room Audio
                  </h2>
                </div>
                <AmbientAudioPanel darkSurface />
              </motion.div>
            )}

            {activeTab === 'capabilities' && (
              <motion.div
                key="capabilities"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left"
              >
                {[
                  {
                    title: 'Universal Syllabus Architect',
                    desc: 'Parse PDF, DOCX, XLSX, images, text, or public URLs into Units, Chapters & Topics.',
                  },
                  {
                    title: 'Weighted Mastery & SRS',
                    desc: 'Separates completion from true mastery and schedules spaced-repetition reviews.',
                  },
                  {
                    title: 'Practice & Timed Mocks',
                    desc: 'Honest PYQ vs AI source tagging, mistake notebook, and configurable negative marking.',
                  },
                  {
                    title: 'Study Buddy Voice & Search Tutor',
                    desc: 'Multi-turn tutor, Google Search grounding links, and real-time voice prep.',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="p-4 rounded-2xl bg-white/8 border border-white/16 backdrop-blur-md space-y-1"
                  >
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-xs text-slate-200 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Subtle Footer Bar */}
      <footer className="px-5 sm:px-10 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200/90 bg-[#0B0C1E]/24 backdrop-blur-md border-t border-white/12">
        <span>Study Buddy · Your go-to tutor</span>
        <span className="font-mono text-[11px] text-slate-200/85">
          Rain &amp; lo-fi audio available anytime inside the Study Room
        </span>
      </footer>
    </div>
  );
};
