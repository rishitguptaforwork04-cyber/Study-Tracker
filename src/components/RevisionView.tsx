import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  List,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { AppState, Flashcard, RevisionConfig } from '../types/study';
import { getTodayISO } from '../data/demoData';
import { addDaysISO, getRevisionQueueSummary } from '../utils/studyMath';

interface RevisionViewProps {
  state: AppState;
  onCompleteRevision: (
    topicId: string,
    accuracyPct: number | null,
    understanding: number,
    confidence: number
  ) => void;
  onUpdateRevisionConfig: (patch: Partial<RevisionConfig>) => void;
  onAddFlashcard: (card: Omit<Flashcard, 'id'>) => void;
  onUpdateFlashcard: (id: string, patch: Partial<Flashcard>) => void;
  onDeleteFlashcard: (id: string) => void;
}

interface FlashcardDeckSummary {
  deckKey: string;
  title: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId?: string;
  cards: Flashcard[];
  dueCount: number;
  masteredCount: number;
}

export const RevisionView: React.FC<RevisionViewProps> = ({
  state,
  onCompleteRevision,
  onUpdateRevisionConfig,
  onAddFlashcard,
  onUpdateFlashcard,
  onDeleteFlashcard,
}) => {
  const today = getTodayISO();
  const prefersReducedMotion = useReducedMotion();

  const [activeMode, setActiveMode] = useState<
    'queue' | 'flashcards' | 'formulas' | 'mistakes'
  >('queue');

  const [reviseTopicId, setReviseTopicId] = useState<string | null>(null);
  const [revUnderstanding, setRevUnderstanding] = useState(4);
  const [revConfidence, setRevConfidence] = useState(4);
  const [revQuizScore, setRevQuizScore] = useState<number>(80);

  // Flashcards authoring
  const defaultSubjectId = state.subjects[0]?.id ?? '';
  const [fcSubjectId, setFcSubjectId] = useState(defaultSubjectId);
  const [fcTopicId, setFcTopicId] = useState(() => {
    const firstTopic = state.topics.find((t) => t.subjectId === defaultSubjectId);
    return firstTopic?.id ?? '';
  });
  const [fcFront, setFcFront] = useState('');
  const [fcBack, setFcBack] = useState('');

  // Flashcard Deck Browser + 3D Flip Session
  const [deckSubjectFilter, setDeckSubjectFilter] = useState<string>('all');
  const [activeDeckKey, setActiveDeckKey] = useState<string | null>(null);
  const [deckSubView, setDeckSubView] = useState<'flip' | 'list'>('flip');
  const [reviewOrderIds, setReviewOrderIds] = useState<string[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [sessionReviewedIds, setSessionReviewedIds] = useState<Record<string, boolean>>({});
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const revisionSummary = useMemo(
    () => getRevisionQueueSummary(state.topics, today),
    [state.topics, today]
  );

  const subjectMap = useMemo(
    () => new Map(state.subjects.map((s) => [s.id, s])),
    [state.subjects]
  );
  const topicMap = useMemo(
    () => new Map(state.topics.map((t) => [t.id, t])),
    [state.topics]
  );

  const topicsForComposerSubject = useMemo(
    () => state.topics.filter((t) => !fcSubjectId || t.subjectId === fcSubjectId),
    [state.topics, fcSubjectId]
  );

  const handleComposerSubjectChange = (nextSubjId: string) => {
    setFcSubjectId(nextSubjId);
    const matching = state.topics.filter((t) => t.subjectId === nextSubjId);
    setFcTopicId(matching[0]?.id ?? '');
  };

  // Group flashcards into Topic Decks (+ General fallback per subject)
  const topicDecks = useMemo<FlashcardDeckSummary[]>(() => {
    const groups = new Map<string, Flashcard[]>();
    for (const fc of state.flashcards) {
      const key = fc.topicId
        ? `topic:${fc.topicId}`
        : `general:${fc.subjectId || 'general'}`;
      const list = groups.get(key) ?? [];
      list.push(fc);
      groups.set(key, list);
    }

    const decks: FlashcardDeckSummary[] = [];
    groups.forEach((cards, deckKey) => {
      const first = cards[0];
      const topic = first.topicId ? topicMap.get(first.topicId) : undefined;
      const subject = subjectMap.get(topic?.subjectId || first.subjectId);
      const dueCount = cards.filter(
        (c) => c.masteryLevel <= 2 || (c.nextReviewAt ? c.nextReviewAt <= today : false)
      ).length;
      const masteredCount = cards.filter((c) => c.masteryLevel >= 4).length;

      decks.push({
        deckKey,
        title: topic?.name ?? `${subject?.name ?? 'General'} — General Deck`,
        subjectId: subject?.id ?? first.subjectId,
        subjectName: subject?.name ?? 'General',
        subjectColor: subject?.color ?? '#7C3AED',
        topicId: topic?.id,
        cards,
        dueCount,
        masteredCount,
      });
    });

    return decks.sort((a, b) => b.dueCount - a.dueCount || b.cards.length - a.cards.length);
  }, [state.flashcards, subjectMap, topicMap, today]);

  const visibleTopicDecks = useMemo(
    () =>
      topicDecks.filter(
        (d) => deckSubjectFilter === 'all' || d.subjectId === deckSubjectFilter
      ),
    [topicDecks, deckSubjectFilter]
  );

  const activeDeck = useMemo<FlashcardDeckSummary | null>(() => {
    if (!activeDeckKey) return null;
    if (activeDeckKey === '__all__') {
      const dueCount = state.flashcards.filter(
        (c) => c.masteryLevel <= 2 || (c.nextReviewAt ? c.nextReviewAt <= today : false)
      ).length;
      const masteredCount = state.flashcards.filter((c) => c.masteryLevel >= 4).length;
      return {
        deckKey: '__all__',
        title: 'All Flashcards',
        subjectId: 'all',
        subjectName: 'All Subjects',
        subjectColor: '#7C3AED',
        cards: state.flashcards,
        dueCount,
        masteredCount,
      };
    }
    return topicDecks.find((d) => d.deckKey === activeDeckKey) ?? null;
  }, [activeDeckKey, state.flashcards, topicDecks, today]);

  const activeDeckCards = useMemo(() => {
    if (!activeDeck) return [];
    const byId = new Map(activeDeck.cards.map((c) => [c.id, c]));
    const ordered = reviewOrderIds
      .map((id) => byId.get(id))
      .filter((c): c is Flashcard => Boolean(c));
    const orderedSet = new Set(ordered.map((c) => c.id));
    const remaining = activeDeck.cards.filter((c) => !orderedSet.has(c.id));
    return [...ordered, ...remaining];
  }, [activeDeck, reviewOrderIds]);

  const safeIndex =
    activeDeckCards.length > 0
      ? Math.max(0, Math.min(currentCardIdx, activeDeckCards.length - 1))
      : 0;
  const currentCard = activeDeckCards[safeIndex] ?? null;

  const openDeckSession = (deck: FlashcardDeckSummary) => {
    setActiveDeckKey(deck.deckKey);
    setReviewOrderIds(deck.cards.map((c) => c.id));
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setSessionReviewedIds({});
    setSessionCompleted(false);
    setDeckSubView('flip');
  };

  const handleShuffleDeck = () => {
    if (!activeDeck) return;
    const ids = activeDeck.cards.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setReviewOrderIds(ids);
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setSessionCompleted(false);
  };

  const handleRestartDeck = () => {
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setSessionReviewedIds({});
    setSessionCompleted(false);
  };

  const stepCard = (delta: number) => {
    if (activeDeckCards.length === 0) return;
    setIsCardFlipped(false);
    setSessionCompleted(false);
    setCurrentCardIdx((prev) =>
      Math.max(0, Math.min(activeDeckCards.length - 1, prev + delta))
    );
  };

  const handleRateCard = (rating: 'hard' | 'easy') => {
    if (!currentCard) return;
    const nextMastery =
      rating === 'easy'
        ? Math.min(5, currentCard.masteryLevel + 1)
        : Math.max(1, currentCard.masteryLevel - 1);
    const nextReviewAt =
      rating === 'easy'
        ? addDaysISO(today, Math.max(1, nextMastery * 2))
        : today;

    onUpdateFlashcard(currentCard.id, {
      masteryLevel: nextMastery,
      nextReviewAt,
    });
    setSessionReviewedIds((prev) => ({ ...prev, [currentCard.id]: true }));
    setIsCardFlipped(false);

    if (safeIndex + 1 < activeDeckCards.length) {
      setCurrentCardIdx(safeIndex + 1);
    } else {
      setSessionCompleted(true);
    }
  };

  // Keyboard shortcuts during 3D Flip Review Session
  useEffect(() => {
    if (activeMode !== 'flashcards' || !activeDeck || deckSubView !== 'flip') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsCardFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (safeIndex + 1 < activeDeckCards.length) {
          setIsCardFlipped(false);
          setCurrentCardIdx((idx) => Math.min(activeDeckCards.length - 1, idx + 1));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (safeIndex > 0) {
          setIsCardFlipped(false);
          setCurrentCardIdx((idx) => Math.max(0, idx - 1));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeMode, activeDeck, deckSubView, safeIndex, activeDeckCards.length]);

  const currentCardTopicName = currentCard?.topicId
    ? topicMap.get(currentCard.topicId)?.name
    : undefined;
  const currentCardSubjectName = currentCard
    ? subjectMap.get(currentCard.subjectId)?.name
    : undefined;

  return (
    <div className="space-y-6">
      {/* Spaced Repetition Interval Config & Mode Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">Adaptive Spaced Repetition</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
              {revisionSummary.overdueCount} overdue · {revisionSummary.dueTodayCount} due today ·{' '}
              {revisionSummary.dueTotalCount} total due
            </p>
          </div>
          <div className="inline-flex flex-wrap rounded-xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-md p-0.5">
            {(
              [
                ['queue', 'Revision Queue'],
                ['flashcards', 'Flashcards'],
                ['formulas', 'Formula & Concept Drill'],
                ['mistakes', 'Incorrect Reattempts'],
              ] as const
            ).map(([id, label]) => {
              const active = activeMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveMode(id)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                    active
                      ? 'text-white'
                      : 'text-slate-800 dark:text-slate-100 hover:bg-white/24 dark:hover:bg-white/10'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="revision-mode-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <span>{label}</span>
                    {id === 'queue' && revisionSummary.dueTotalCount > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono text-[10px] tabular-nums ${
                          active
                            ? 'bg-white/25 text-white'
                            : 'bg-[#EF4444]/18 text-[#DC2626] dark:text-[#FCA5A5]'
                        }`}
                      >
                        {revisionSummary.dueTotalCount}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5">
          <p className="text-xs font-semibold mb-2">Revision Interval Rules (Days)</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-[#EF4444]">Weak</label>
              <input
                type="number"
                min={1}
                max={14}
                value={state.revisionConfig.weakIntervalDays}
                onChange={(e) =>
                  onUpdateRevisionConfig({ weakIntervalDays: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#D97706] dark:text-[#FACC15]">Moderate</label>
              <input
                type="number"
                min={2}
                max={30}
                value={state.revisionConfig.moderateIntervalDays}
                onChange={(e) =>
                  onUpdateRevisionConfig({ moderateIntervalDays: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#16A34A] dark:text-[#22C55E]">Strong</label>
              <input
                type="number"
                min={4}
                max={60}
                value={state.revisionConfig.strongIntervalDays}
                onChange={(e) =>
                  onUpdateRevisionConfig({ strongIntervalDays: Number(e.target.value) })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs font-mono tabular-nums"
              />
            </div>
          </div>
        </div>
      </div>

      {activeMode === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[
            {
              title: 'Overdue Revisions',
              items: revisionSummary.overdueTopics,
              accent: '#EF4444',
            },
            {
              title: "Today's Revision Queue",
              items: revisionSummary.dueTodayTopics,
              accent: '#F97316',
            },
          ].map((group) => (
            <section
              key={group.title}
              className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3"
            >
              <h3 className="font-display text-sm font-bold" style={{ color: group.accent }}>
                {group.title} ({group.items.length})
              </h3>
              {group.items.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Queue clear.</p>
              ) : (
                <div className="space-y-2.5">
                  {group.items.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{t.name}</p>
                          <p className="text-xs font-mono tabular-nums text-slate-500">
                            {subjectMap.get(t.subjectId)?.name} · Mastery {t.masteryScore}% · Due{' '}
                            {t.nextRevisionAt ?? 'Today'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setReviseTopicId(reviseTopicId === t.id ? null : t.id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9] shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Log Review
                        </button>
                      </div>

                      {reviseTopicId === t.id && (
                        <div className="pt-3 border-t border-slate-200 dark:border-[#2E2E58] space-y-3">
                          {t.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-semibold">Notes:</span> {t.notes}
                            </p>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <label className="block mb-1">Understanding (1–5)</label>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={revUnderstanding}
                                onChange={(e) => setRevUnderstanding(Number(e.target.value))}
                                className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl font-mono tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block mb-1">Confidence (1–5)</label>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={revConfidence}
                                onChange={(e) => setRevConfidence(Number(e.target.value))}
                                className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl font-mono tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block mb-1">Recall Score (%)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={revQuizScore}
                                onChange={(e) => setRevQuizScore(Number(e.target.value))}
                                className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl font-mono tabular-nums"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onCompleteRevision(
                                t.id,
                                revQuizScore,
                                revUnderstanding,
                                revConfidence
                              );
                              setReviseTopicId(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#22C55E] text-white text-xs font-semibold"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Complete & Schedule Next
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {activeMode === 'flashcards' && (
        <div className="space-y-6">
          {/* Topic-Linked Flashcard Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!fcFront.trim() || !fcBack.trim()) return;
              const selectedTopic = fcTopicId ? topicMap.get(fcTopicId) : undefined;
              const resolvedSubjectId =
                selectedTopic?.subjectId || fcSubjectId || state.subjects[0]?.id || 'general';
              onAddFlashcard({
                subjectId: resolvedSubjectId,
                topicId: selectedTopic?.id || undefined,
                front: fcFront.trim(),
                back: fcBack.trim(),
                source: 'user',
                masteryLevel: 1,
                nextReviewAt: today,
              });
              setFcFront('');
              setFcBack('');
            }}
            className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-950 dark:text-white">
                  Write Topic Flashcard
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Link each prompt-and-answer card to a syllabus topic deck for focused 3D flip review
                </p>
              </div>
              {fcTopicId && topicMap.get(fcTopicId) && (
                <span className="text-xs font-mono text-[#7C3AED] dark:text-[#C4B5FD]">
                  Deck: {topicMap.get(fcTopicId)?.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
              <select
                value={fcSubjectId}
                onChange={(e) => handleComposerSubjectChange(e.target.value)}
                aria-label="Flashcard subject"
                className="lg:col-span-3 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              >
                {state.subjects.length === 0 ? (
                  <option value="">General Study</option>
                ) : (
                  state.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>

              <select
                value={fcTopicId}
                onChange={(e) => setFcTopicId(e.target.value)}
                aria-label="Flashcard topic deck"
                className="lg:col-span-3 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              >
                <option value="">General (Subject Deck)</option>
                {topicsForComposerSubject.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={fcFront}
                onChange={(e) => setFcFront(e.target.value)}
                placeholder="Front (question, formula, concept prompt)"
                aria-label="Flashcard front prompt"
                className="lg:col-span-3 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              />

              <input
                type="text"
                value={fcBack}
                onChange={(e) => setFcBack(e.target.value)}
                placeholder="Back (concise answer, derivation, key rule)"
                aria-label="Flashcard back answer"
                className="lg:col-span-3 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!fcFront.trim() || !fcBack.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Card to Deck
              </button>
            </div>
          </form>

          {/* Active 3D Flip Review Session OR Topic Deck Selector */}
          {activeDeck ? (
            <section
              data-testid="flashcard-review-session"
              className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 sm:p-6 space-y-5"
            >
              {/* Session Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveDeckKey(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#7C3AED] transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    All Decks
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                      {activeDeck.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                      {activeDeck.subjectName} · {activeDeckCards.length} cards
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDeckSubView((v) => (v === 'flip' ? 'list' : 'flip'))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#7C3AED]"
                  >
                    {deckSubView === 'flip' ? (
                      <>
                        <List className="w-3.5 h-3.5" />
                        Browse Cards
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        3D Flip Mode
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleShuffleDeck}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#06B6D4]"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Shuffle
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartDeck}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#7C3AED]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restart
                  </button>
                </div>
              </div>

              {activeDeckCards.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This deck has no cards left.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveDeckKey(null)}
                    className="px-3.5 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold"
                  >
                    Back to Topic Decks
                  </button>
                </div>
              ) : deckSubView === 'flip' && currentCard ? (
                <div className="space-y-5">
                  {/* Deck Progress Bar */}
                  <div className="space-y-1.5 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      <span>
                        Card {safeIndex + 1} of {activeDeckCards.length}
                      </span>
                      <span>
                        Reviewed this session:{' '}
                        {Object.keys(sessionReviewedIds).length}/{activeDeckCards.length}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200/80 dark:bg-[#13132B] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] transition-all duration-300"
                        style={{
                          width: `${Math.round(((safeIndex + 1) / activeDeckCards.length) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {sessionCompleted && (
                    <div className="max-w-2xl mx-auto rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/12 p-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#15803D] dark:text-[#4ADE80]">
                        Deck review complete! All cards rated.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRestartDeck}
                          className="px-3 py-1.5 rounded-lg bg-[#22C55E] text-white text-xs font-semibold"
                        >
                          Review Again
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveDeckKey(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 text-xs font-semibold"
                        >
                          Switch Deck
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3D Flip Stage */}
                  <div className="max-w-2xl mx-auto [perspective:1200px]">
                    <div
                      role="button"
                      tabIndex={0}
                      data-testid="flashcard-3d-stage"
                      aria-pressed={isCardFlipped}
                      aria-label={
                        isCardFlipped
                          ? 'Flashcard showing answer. Click or press Space to show prompt.'
                          : 'Flashcard showing prompt. Click or press Space to reveal answer.'
                      }
                      onClick={() => setIsCardFlipped((f) => !f)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setIsCardFlipped((f) => !f);
                        }
                      }}
                      className="cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-2xl"
                    >
                      {prefersReducedMotion ? (
                        <div className="min-h-[260px] sm:min-h-[290px] rounded-2xl border border-white/35 dark:border-white/15 bg-white/85 dark:bg-[#141430]/90 p-6 sm:p-8 flex flex-col justify-between shadow-lg">
                          <div className="flex items-center justify-between gap-2 text-xs font-mono">
                            <span className="text-[#7C3AED] dark:text-[#C4B5FD] font-semibold">
                              {isCardFlipped ? 'BACK · ANSWER' : 'FRONT · PROMPT'}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                              {currentCardTopicName ?? currentCardSubjectName ?? 'General'} · Mastery{' '}
                              {currentCard.masteryLevel}/5
                            </span>
                          </div>
                          <p className="text-base sm:text-xl font-medium text-slate-950 dark:text-white leading-relaxed text-center py-6">
                            {isCardFlipped ? currentCard.back : currentCard.front}
                          </p>
                          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                            Click or press Space to flip
                          </p>
                        </div>
                      ) : (
                        <motion.div
                          animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                          style={{ transformStyle: 'preserve-3d' }}
                          className="relative min-h-[260px] sm:min-h-[290px]"
                        >
                          {/* Front Face */}
                          <div
                            style={{ backfaceVisibility: 'hidden' }}
                            className="absolute inset-0 rounded-2xl border border-slate-200 dark:border-[#343464] bg-white/90 dark:bg-[#141430]/92 p-6 sm:p-8 flex flex-col justify-between shadow-lg"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-mono">
                              <span className="text-[#7C3AED] dark:text-[#C4B5FD] font-bold tracking-wide">
                                FRONT · PROMPT
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                {currentCardTopicName ?? currentCardSubjectName ?? 'General'} · Mastery{' '}
                                {currentCard.masteryLevel}/5
                              </span>
                            </div>

                            <p className="text-base sm:text-xl font-semibold text-slate-950 dark:text-white leading-relaxed text-center py-4">
                              {currentCard.front}
                            </p>

                            <p className="text-center text-xs text-slate-500 dark:text-slate-400 inline-flex items-center justify-center gap-1.5">
                              <RotateCw className="w-3.5 h-3.5 text-[#7C3AED]" />
                              Click card or press Space to reveal answer
                            </p>
                          </div>

                          {/* Back Face */}
                          <div
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                            }}
                            className="absolute inset-0 rounded-2xl border border-[#06B6D4]/45 bg-gradient-to-br from-white/95 to-cyan-50/90 dark:from-[#161E3A]/95 dark:to-[#121633]/95 p-6 sm:p-8 flex flex-col justify-between shadow-lg"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-mono">
                              <span className="text-[#0891B2] dark:text-[#67E8F9] font-bold tracking-wide">
                                BACK · ANSWER
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                {currentCardTopicName ?? currentCardSubjectName ?? 'General'} · Mastery{' '}
                                {currentCard.masteryLevel}/5
                              </span>
                            </div>

                            <p className="text-base sm:text-lg font-medium text-slate-950 dark:text-white leading-relaxed text-center py-4">
                              {currentCard.back}
                            </p>

                            <p className="text-center text-xs text-slate-500 dark:text-slate-400 inline-flex items-center justify-center gap-1.5">
                              <RotateCw className="w-3.5 h-3.5 text-[#06B6D4]" />
                              Click card to return to prompt, or rate recall below
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Step & Mastery Feedback Controls */}
                  <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => stepCard(-1)}
                        disabled={safeIndex === 0}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold disabled:opacity-40 hover:border-[#7C3AED]"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCardFlipped((f) => !f)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        {isCardFlipped ? 'Show Prompt' : 'Flip Card'}
                      </button>
                      <button
                        type="button"
                        onClick={() => stepCard(1)}
                        disabled={safeIndex >= activeDeckCards.length - 1}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold disabled:opacity-40 hover:border-[#7C3AED]"
                      >
                        Next
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRateCard('hard')}
                        className="px-3.5 py-2 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/12 text-[#DC2626] dark:text-[#FCA5A5] hover:bg-[#EF4444]/22 text-xs font-semibold"
                      >
                        Needs Review (Hard)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRateCard('easy')}
                        className="px-3.5 py-2 rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#15803D] dark:text-[#4ADE80] hover:bg-[#22C55E]/25 text-xs font-semibold"
                      >
                        Got It (Easy)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Deck List / Manage Cards Sub-View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeDeckCards.map((card, i) => (
                    <div
                      key={card.id}
                      className="rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50/90 dark:bg-[#17172F]/90 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <span className="tabular-nums">
                          #{i + 1} · Mastery {card.masteryLevel}/5
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentCardIdx(i);
                              setIsCardFlipped(false);
                              setDeckSubView('flip');
                            }}
                            className="text-[#7C3AED] dark:text-[#C4B5FD] font-semibold hover:underline"
                          >
                            Review in 3D
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteFlashcard(card.id)}
                            aria-label={`Delete flashcard ${i + 1}`}
                            className="p-1 rounded text-slate-400 hover:text-[#EF4444]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {card.front}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200/70 dark:border-[#2A2A50] pt-2">
                        {card.back}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            /* Topic Deck Selector Grid */
            <section aria-label="Topic Flashcard Decks" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-950 dark:text-white">
                    Topic Flashcard Decks ({visibleTopicDecks.length})
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Pick any topic deck below to start an interactive 3D flip review session
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={deckSubjectFilter}
                    onChange={(e) => setDeckSubjectFilter(e.target.value)}
                    aria-label="Filter decks by subject"
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-white/76 dark:bg-[#1A1A36]/68 text-xs"
                  >
                    <option value="all">All Subjects</option>
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  {state.flashcards.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        openDeckSession({
                          deckKey: '__all__',
                          title: 'All Flashcards',
                          subjectId: 'all',
                          subjectName: 'All Subjects',
                          subjectColor: '#7C3AED',
                          cards: state.flashcards,
                          dueCount: state.flashcards.filter((c) => c.masteryLevel <= 2).length,
                          masteredCount: state.flashcards.filter((c) => c.masteryLevel >= 4).length,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold whitespace-nowrap"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Review All Cards ({state.flashcards.length})
                    </button>
                  )}
                </div>
              </div>

              {visibleTopicDecks.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    No flashcard decks created yet for this filter.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Use the topic composer above to write your first flashcard and automatically build a topic deck.
                  </p>
                </div>
              ) : (
                <div
                  data-testid="topic-flashcard-decks-grid"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {visibleTopicDecks.map((deck) => {
                    const masteryPct =
                      deck.cards.length > 0
                        ? Math.round((deck.masteredCount / deck.cards.length) * 100)
                        : 0;
                    return (
                      <article
                        key={deck.deckKey}
                        data-testid={`flashcard-deck-${deck.topicId ?? deck.deckKey}`}
                        className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 flex flex-col justify-between gap-4 hover:border-[#7C3AED]/60 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: deck.subjectColor }}
                              />
                              <span className="truncate">{deck.subjectName}</span>
                            </span>
                            <span className="font-mono font-bold tabular-nums text-[#7C3AED] dark:text-[#C4B5FD] shrink-0">
                              {deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'}
                            </span>
                          </div>
                          <h4 className="font-display text-base font-bold text-slate-950 dark:text-white leading-snug">
                            {deck.title}
                          </h4>
                          <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {deck.dueCount} to review · {masteryPct}% mastered
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-[#13132B] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#10B981]"
                              style={{ width: `${Math.max(8, masteryPct)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openDeckSession(deck)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold transition-colors"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                              Start 3D Flip Review
                            </button>
                            {deck.topicId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFcSubjectId(deck.subjectId);
                                  setFcTopicId(deck.topicId || '');
                                }}
                                title="Write another card in this topic"
                                className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#7C3AED]"
                              >
                                + Card
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {activeMode === 'formulas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.topics
            .filter((t) => t.formulas || t.definitions || t.importantConcepts)
            .map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-2.5"
              >
                <p className="font-display text-sm font-bold text-[#06B6D4]">{t.name}</p>
                {t.formulas && (
                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-[#17172F] font-mono text-xs whitespace-pre-wrap">
                    {t.formulas}
                  </pre>
                )}
                {t.definitions && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Definition:</span> {t.definitions}
                  </p>
                )}
                {t.importantConcepts && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Key Concept:</span> {t.importantConcepts}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      {activeMode === 'mistakes' && (
        <div className="space-y-3">
          {state.mistakes.filter((m) => !m.resolved).length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-8 text-center text-sm text-slate-500">
              No unresolved mistakes to reattempt.
            </div>
          ) : (
            state.mistakes
              .filter((m) => !m.resolved)
              .map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-5 space-y-2"
                >
                  <p className="text-sm font-medium">{m.questionStatement}</p>
                  <p className="text-xs font-mono text-[#EF4444]">
                    Your previous answer: {m.userAnswer}
                  </p>
                  <p className="text-xs font-mono text-[#22C55E]">
                    Correct answer: {m.correctAnswer}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{m.explanation}</p>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};
