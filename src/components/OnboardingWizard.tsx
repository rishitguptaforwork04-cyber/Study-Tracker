import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { ExamTarget, StudyProfile } from '../types/study';
import { getTodayISO } from '../data/demoData';

interface OnboardingWizardProps {
  initialProfile: StudyProfile;
  onComplete: (payload: {
    profile: Partial<StudyProfile>;
    exams: Array<Omit<ExamTarget, 'id'>>;
    subjectNames: string[];
  }) => void;
  onLoadDemo: () => void;
  onCancel?: () => void;
}

const COURSE_CATEGORIES = [
  'Professional Certification (CFA, CA, FRM, CPA)',
  'Competitive Examination (UPSC, GATE, CUET, CAT)',
  'University Degree (B.Tech, B.Sc, MBA)',
  'School & Board Studies',
  'Skill-Based Learning / Custom Course',
];

const STUDY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PRESET_SUBJECTS: Record<string, string[]> = {
  CFA: ['Ethical & Professional Standards', 'Quantitative Methods', 'Economics', 'Financial Statement Analysis', 'Fixed Income'],
  UPSC: ['Polity & Governance', 'Modern History', 'Geography', 'Indian Economy', 'Science & Environment'],
  GATE: ['Engineering Mathematics', 'Algorithms & Data Structures', 'Operating Systems', 'Computer Networks', 'Database Management'],
  'B.Tech': ['Linear Algebra', 'Discrete Mathematics', 'Digital Logic', 'Object-Oriented Programming'],
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialProfile,
  onComplete,
  onLoadDemo,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [studentName, setStudentName] = useState(
    initialProfile.studentName && initialProfile.studentName !== 'Scholar'
      ? initialProfile.studentName
      : ''
  );
  const [courseName, setCourseName] = useState(initialProfile.courseName || '');
  const [courseCategory, setCourseCategory] = useState(
    initialProfile.courseCategory || COURSE_CATEGORIES[0]
  );
  const [preparationLevel, setPreparationLevel] = useState<StudyProfile['preparationLevel']>(
    initialProfile.preparationLevel || 'Intermediate'
  );

  const [exams, setExams] = useState<Array<Omit<ExamTarget, 'id'>>>([
    {
      name: '',
      examDate: '',
      prepStartDate: getTodayISO(),
      attemptYear: '2027',
      targetScore: '',
      color: '#7C3AED',
    },
  ]);

  const [subjectInput, setSubjectInput] = useState('');
  const [subjectNames, setSubjectNames] = useState<string[]>([]);

  const [dailyHoursTarget, setDailyHoursTarget] = useState(initialProfile.dailyHoursTarget || 3);
  const [weeklyHoursTarget, setWeeklyHoursTarget] = useState(initialProfile.weeklyHoursTarget || 20);
  const [preferredStudyDays, setPreferredStudyDays] = useState<string[]>(
    initialProfile.preferredStudyDays.length > 0
      ? initialProfile.preferredStudyDays
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [breakPreference, setBreakPreference] = useState(
    initialProfile.breakPreference || '50m focus / 10m break'
  );
  const [autoGeneratePlan, setAutoGeneratePlan] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const examColors = ['#7C3AED', '#06B6D4', '#F97316', '#EC4899', '#22C55E'];

  const handleAddExamRow = () => {
    setExams((prev) => [
      ...prev,
      {
        name: '',
        examDate: '',
        prepStartDate: getTodayISO(),
        attemptYear: '2027',
        targetScore: '',
        color: examColors[prev.length % examColors.length],
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

  const handleNext = () => {
    setValidationError(null);
    if (step === 1 && !courseName.trim()) {
      setValidationError('Please enter what course, degree, or certification you are studying.');
      return;
    }
    if (step === 2) {
      const validExams = exams.filter((e) => e.name.trim().length > 0);
      if (validExams.length === 0) {
        setValidationError('Please add at least one target examination name.');
        return;
      }
    }
    setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
  };

  const handleSubmit = () => {
    setValidationError(null);
    const cleanedExams = exams
      .filter((e) => e.name.trim().length > 0)
      .map((e) => ({
        ...e,
        name: e.name.trim(),
        examDate: e.examDate || getTodayISO(),
        targetScore: e.targetScore.trim() || 'Target Mastery',
      }));

    if (!courseName.trim() || cleanedExams.length === 0) {
      setValidationError('Please ensure your course and at least one examination target are filled in.');
      return;
    }

    onComplete({
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
    <div className="min-h-screen text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left editorial welcome panel */}
        <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200/75 dark:border-white/15 bg-white/76 dark:bg-[#191934]/72 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="relative h-48 sm:h-56 overflow-hidden bg-[#141428]">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_study_desk_1795465323583.jpg"
                  alt="Minimalist evening study desk with notebook and lamp"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#17172F] via-[#251E4D] to-[#0F2A3F]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex flex-col justify-end p-6">
                <p className="text-xs font-medium text-[#06B6D4]">Study Buddy</p>
                <h1 className="font-display text-2xl font-bold text-white leading-tight text-balance">
                  Your go-to tutor &amp; study command centre
                </h1>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Adaptable to CFA, CA, FRM, UPSC, GATE, CUET, university degrees, or self-directed skill tracks. Map multi-exam overlaps, track true mastery, and automate spaced repetition.
              </p>

              <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/12">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Quick preview option
                </p>
                <button
                  type="button"
                  onClick={onLoadDemo}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30 hover:bg-[#06B6D4]/25 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Explore Sample Demo (CFA + FRM)</span>
                </button>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Loads clearly labeled sample data so you can inspect every dashboard widget, overlap matrix, and mock test immediately. Reset anytime in Settings.
                </p>
              </div>
            </div>
          </div>

          {onCancel && (
            <div className="px-6 pb-5">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline"
              >
                Return to Welcome / Workspace
              </button>
            </div>
          )}
        </div>

        {/* Right multi-step setup form */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/75 dark:border-white/15 bg-white/78 dark:bg-[#191934]/74 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Step progress indicator */}
            <div className="flex items-center justify-between gap-2 pb-6 mb-6 border-b border-slate-200/70 dark:border-white/12">
              <div>
                <p className="text-xs font-medium text-[#7C3AED]">Step {step} of 4</p>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {step === 1 && 'Course & Preparation Profile'}
                  {step === 2 && 'Target Examinations & Scores'}
                  {step === 3 && 'Subjects & Syllabus Seed'}
                  {step === 4 && 'Study Availability & Schedule'}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    aria-label={`Go to setup step ${num}`}
                    onClick={() => setStep(num as 1 | 2 | 3 | 4)}
                    className={`h-2 rounded-full transition-all ${
                      step === num
                        ? 'w-7 bg-[#7C3AED]'
                        : step > num
                          ? 'w-4 bg-[#22C55E]'
                          : 'w-4 bg-slate-200 dark:bg-[#2E2E58]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {validationError && (
              <div
                role="alert"
                className="mb-4 px-4 py-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#EF4444]"
              >
                {validationError}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="onb-name" className="block text-sm font-medium mb-1.5">
                    Your Name
                  </label>
                  <input
                    id="onb-name"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Riya Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
                <div>
                  <label htmlFor="onb-course" className="block text-sm font-medium mb-1.5">
                    What are you studying? (Course, degree, certification, or custom track)
                  </label>
                  <input
                    id="onb-course"
                    type="text"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="e.g. B.Tech Computer Science, CFA Level I, UPSC CSE, or Applied ML"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="onb-cat" className="block text-sm font-medium mb-1.5">
                      Category
                    </label>
                    <select
                      id="onb-cat"
                      value={courseCategory}
                      onChange={(e) => setCourseCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    >
                      {COURSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="onb-level" className="block text-sm font-medium mb-1.5">
                      Current Preparation Level
                    </label>
                    <select
                      id="onb-level"
                      value={preparationLevel}
                      onChange={(e) =>
                        setPreparationLevel(e.target.value as StudyProfile['preparationLevel'])
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    >
                      <option value="Beginner">Beginner (Starting fresh)</option>
                      <option value="Intermediate">Intermediate (Partially covered)</option>
                      <option value="Advanced">Advanced (Revision & mocks)</option>
                      <option value="Repeating / Refining">Repeating / Refining</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Add one or multiple examination targets under this study profile. Overlapping topics across exams will be automatically detected.
                </p>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {exams.map((exam, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Exam Target {idx + 1}
                        </span>
                        {exams.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExams((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label={`Remove exam target ${idx + 1}`}
                            className="text-xs text-[#EF4444] hover:underline flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={exam.name}
                          onChange={(e) =>
                            setExams((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                            )
                          }
                          placeholder="Exam name (e.g. GATE CS, CFA Level I)"
                          aria-label={`Exam ${idx + 1} name`}
                          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#1E1E3B] text-sm"
                        />
                        <input
                          type="date"
                          value={exam.examDate}
                          onChange={(e) =>
                            setExams((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, examDate: e.target.value } : item
                              )
                            )
                          }
                          aria-label={`Exam ${idx + 1} date`}
                          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#1E1E3B] text-sm font-mono"
                        />
                        <input
                          type="text"
                          value={exam.attemptYear}
                          onChange={(e) =>
                            setExams((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, attemptYear: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Attempt year (e.g. 2027)"
                          aria-label={`Exam ${idx + 1} attempt year`}
                          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#1E1E3B] text-sm font-mono"
                        />
                        <input
                          type="text"
                          value={exam.targetScore}
                          onChange={(e) =>
                            setExams((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, targetScore: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Target score / rank / %"
                          aria-label={`Exam ${idx + 1} target score`}
                          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-white dark:bg-[#1E1E3B] text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddExamRow}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#06B6D4] hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Add another target exam
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Add initial subjects manually or pick a starter subject group. You can import PDF, DOCX, XLSX, images, text, or URLs via AI right after setup.
                </p>

                <div className="flex flex-wrap gap-2">
                  {Object.keys(PRESET_SUBJECTS).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setSubjectNames((prev) =>
                          Array.from(new Set([...prev, ...PRESET_SUBJECTS[key]]))
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#2E2E58] hover:border-[#7C3AED] transition-colors"
                    >
                      + {key} Subjects
                    </button>
                  ))}
                </div>

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
                    placeholder="Type a subject name and press Add"
                    aria-label="New subject name"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                  >
                    Add
                  </button>
                </div>

                {subjectNames.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    No subjects added yet — you can also import your full syllabus directly in the Syllabus tab.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-[#2A2A50] border border-slate-200 dark:border-[#2E2E58] rounded-xl">
                    {subjectNames.map((name) => (
                      <div key={name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => setSubjectNames((prev) => prev.filter((s) => s !== name))}
                          className="text-xs text-[#EF4444] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="onb-daily" className="block text-sm font-medium mb-1.5">
                      Daily Study Availability (hours)
                    </label>
                    <input
                      id="onb-daily"
                      type="number"
                      min={0.5}
                      max={16}
                      step={0.5}
                      value={dailyHoursTarget}
                      onChange={(e) => setDailyHoursTarget(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="onb-weekly" className="block text-sm font-medium mb-1.5">
                      Weekly Study Goal (hours)
                    </label>
                    <input
                      id="onb-weekly"
                      type="number"
                      min={1}
                      max={100}
                      value={weeklyHoursTarget}
                      onChange={(e) => setWeeklyHoursTarget(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Preferred Study Days</p>
                  <div className="flex flex-wrap gap-2">
                    {STUDY_DAYS.map((day) => {
                      const selected = preferredStudyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            selected
                              ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                              : 'border-slate-200 dark:border-[#2E2E58] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="onb-breaks" className="block text-sm font-medium mb-1.5">
                    Break & Focus Cadence
                  </label>
                  <select
                    id="onb-breaks"
                    value={breakPreference}
                    onChange={(e) => setBreakPreference(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
                  >
                    <option value="25m focus / 5m break">Pomodoro (25m focus / 5m break)</option>
                    <option value="50m focus / 10m break">Deep Block (50m focus / 10m break)</option>
                    <option value="90m focus / 20m break">Exam Endurance (90m focus / 20m break)</option>
                  </select>
                </div>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGeneratePlan}
                    onChange={(e) => setAutoGeneratePlan(e.target.checked)}
                    className="mt-1 accent-[#7C3AED]"
                  />
                  <span className="text-sm">
                    <span className="font-semibold block">Enable adaptive study plan suggestions</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Automatically prioritize topics by exam date, weightage, and mastery in the Planner.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-[#2A2A50]">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-[#2E2E58] hover:bg-slate-100 dark:hover:bg-[#232347]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#22C55E] hover:bg-[#16A34A] text-white"
              >
                <Check className="w-4 h-4" />
                Launch Workspace
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
