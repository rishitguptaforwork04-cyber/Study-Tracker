import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ExternalLink,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Music,
  PhoneOff,
  Radio,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppState, GroundingSource, TutorMessage } from '../types/study';
import { AmbientAudioPanel } from './AmbientAudioPanel';

interface AiAssistantViewProps {
  state: AppState;
  onAddMessages: (msgs: TutorMessage[]) => void;
  onClearHistory: () => void;
}

type StudioTab = 'chat' | 'voice' | 'music';

const CHAT_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (General & Reasoning)' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Fast)' },
] as const;

const TUTOR_ROLES = [
  { id: 'default', label: 'Balanced Academic Tutor' },
  { id: 'socratic_tutor', label: 'Socratic Checkpoint Tutor' },
  { id: 'exam_coach', label: 'Exam Strategy Coach' },
  { id: 'concept_simplifier', label: 'Concept Simplifier' },
  { id: 'deep_researcher', label: 'First-Principles Researcher' },
] as const;

const LIVE_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const;

const QUICK_MODES = [
  { id: 'explain_beginner', label: 'Explain (Beginner)' },
  { id: 'explain_intermediate', label: 'Explain (Intermediate)' },
  { id: 'explain_advanced', label: 'Explain (Advanced)' },
  { id: 'simplify', label: 'Simplify Concept' },
  { id: 'generate_notes', label: 'Generate Notes' },
  { id: 'flashcards', label: 'Create Flashcards' },
  { id: 'analyze_mistakes', label: 'Analyze Mistakes' },
  { id: 'revision_plan', label: 'Revision Plan' },
  { id: 'prerequisites', label: 'Identify Prerequisites' },
  { id: 'compare', label: 'Compare Concepts' },
  { id: 'next_study', label: 'What to Study Next' },
];

function floatTo16BitPcmBase64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const samples = Math.floor(bytes.length / 2);
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  state,
  onAddMessages,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('chat');

  // Multi-Turn Chat & Search Grounding State
  const [selectedMode, setSelectedMode] = useState('next_study');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [rolePersona, setRolePersona] = useState<string>('default');
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);
  const [selectedTopicId, setSelectedTopicId] = useState(state.topics[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Live API Voice Session State + Refs (useRef inside callbacks prevents stale closures)
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [liveVoice, setLiveVoice] = useState<string>('Zephyr');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveNudge, setLiveNudge] = useState('');
  const [liveTranscripts, setLiveTranscripts] = useState<
    Array<{ id: string; speaker: 'You' | 'Gemini Live'; text: string }>
  >([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mutedRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const activeTopic = useMemo(
    () => state.topics.find((t) => t.id === selectedTopicId) ?? null,
    [state.topics, selectedTopicId]
  );

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [state.tutorHistory.length]);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  const stopLiveSession = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setLiveStatus('idle');
    setIsMuted(false);
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const schedulePcmOutput = (base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const float32 = base64Pcm16ToFloat32(base64Audio);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(new Float32Array(float32), 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  const clearQueuedOutput = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  };

  const appendLiveTranscript = (speaker: 'You' | 'Gemini Live', chunkText: string) => {
    const clean = chunkText;
    if (!clean) return;
    setLiveTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text}${clean}` },
        ];
      }
      return [
        ...prev,
        { id: `lt-${Date.now()}-${Math.random()}`, speaker, text: clean },
      ];
    });
  };

  const startLiveSession = async () => {
    if (liveStatus !== 'idle') return;
    setLiveError(null);
    setLiveStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const topicName = activeTopic?.name || state.profile.courseName || 'Academic Mastery';
      const wsUrl = `${proto}//${window.location.host}/api/live?voice=${encodeURIComponent(
        liveVoice
      )}&topic=${encodeURIComponent(topicName)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (mutedRef.current) return;
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          const pcmBase64 = floatTo16BitPcmBase64(e.inputBuffer.getChannelData(0));
          wsRef.current.send(JSON.stringify({ audio: pcmBase64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setLiveError(msg.error);
            stopLiveSession();
            return;
          }
          if (msg.status === 'connected') {
            setLiveStatus('connected');
          }
          if (msg.audio) {
            schedulePcmOutput(msg.audio);
          }
          if (msg.interrupted) {
            clearQueuedOutput();
          }
          if (msg.inputTranscript) {
            appendLiveTranscript('You', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendLiveTranscript('Gemini Live', msg.outputTranscript);
          }
        } catch {
          // ignore malformed server frame
        }
      };

      ws.onerror = () => {
        setLiveError('Live WebSocket connection failed. Ensure your server and API key are configured.');
        stopLiveSession();
      };

      ws.onclose = () => {
        stopLiveSession();
      };
    } catch (err) {
      setLiveError(
        err instanceof Error
          ? err.message
          : 'Microphone permission denied or Live Voice session unavailable.'
      );
      stopLiveSession();
    }
  };

  const sendLiveTextPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    const text = liveNudge.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    appendLiveTranscript('You', ` ${text}`);
    setLiveNudge('');
  };

  const sendPrompt = async (promptText: string, modeId = selectedMode) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    setError(null);

    const userMsg: TutorMessage = {
      id: `tm-${Date.now()}-u`,
      role: 'user',
      content: trimmed,
      mode: modeId,
      createdAt: new Date().toISOString(),
      isAiGenerated: false,
    };

    const historyPayload = state.tutorHistory.slice(-16).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setLoading(true);
    try {
      const context = {
        course: state.profile.courseName,
        level: state.profile.preparationLevel,
        exams: state.exams.map((e) => ({ name: e.name, date: e.examDate, target: e.targetScore })),
        focusedTopic: activeTopic
          ? {
              name: activeTopic.name,
              status: activeTopic.status,
              masteryScore: activeTopic.masteryScore,
              notes: activeTopic.notes,
              formulas: activeTopic.formulas,
            }
          : null,
        weakTopics: state.topics
          .filter((t) => t.status === 'Weak Area' || t.masteryScore < 55)
          .slice(0, 6)
          .map((t) => ({ name: t.name, mastery: t.masteryScore })),
        recentMistakes: state.mistakes.slice(0, 4).map((m) => ({
          question: m.questionStatement,
          mistakeType: m.mistakeType,
        })),
        recentMocks: state.mockTests.slice(-2).map((m) => ({
          title: m.title,
          percentage: m.percentage,
          accuracy: m.accuracy,
        })),
      };

      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: modeId,
          message: trimmed,
          context,
          history: historyPayload,
          model: useGoogleSearch ? 'gemini-4-hydrogen' : selectedModel,
          rolePersona,
          useGoogleSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI tutor request failed.');

      const aiMsg: TutorMessage = {
        id: `tm-${Date.now()}-a`,
        role: 'assistant',
        content: data.reply,
        mode: modeId,
        modelUsed: data.modelUsed || (useGoogleSearch ? 'gemini-4-hydrogen (Search)' : selectedModel),
        groundingSources: Array.isArray(data.groundingSources)
          ? (data.groundingSources as GroundingSource[])
          : undefined,
        createdAt: new Date().toISOString(),
        isAiGenerated: true,
      };
      onAddMessages([userMsg, aiMsg]);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach AI Study Assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (modeId: string, label: string) => {
    setSelectedMode(modeId);
    const topicSuffix = activeTopic ? ` for "${activeTopic.name}"` : '';
    const presetPrompts: Record<string, string> = {
      explain_beginner: `Explain${topicSuffix} at a beginner level using an intuitive analogy.`,
      explain_intermediate: `Explain${topicSuffix} at an intermediate exam-ready level with key rules.`,
      explain_advanced: `Provide a deep advanced breakdown${topicSuffix} including edge cases and derivations.`,
      simplify: `Simplify the hardest parts${topicSuffix} into 5 clear takeaways.`,
      generate_notes: `Generate structured study notes and formula highlights${topicSuffix}.`,
      flashcards: `Create 5 active-recall flashcards (Front / Back)${topicSuffix}.`,
      analyze_mistakes: `Analyze my recent mistake patterns and recommend targeted corrective drills.`,
      revision_plan: `Build a focused 5-day revision plan based on my weak areas and exam countdowns.`,
      prerequisites: `What prerequisite concepts should I master before studying${topicSuffix || ' my next hard topic'}?`,
      compare: `Compare and contrast the two most easily confused concepts${topicSuffix}.`,
      next_study: `Based on my exam dates, weak topics, and mastery scores, what should I study next today and why?`,
    };
    sendPrompt(presetPrompts[modeId] || `${label}${topicSuffix}`, modeId);
  };

  return (
    <div className="space-y-5">
      {/* Ultra-Sheer Glass Tab Bar */}
      <div
        role="tablist"
        aria-label="Study Buddy AI Tutor modes"
        className="inline-flex flex-wrap gap-2 p-1.5 rounded-2xl border border-white/30 dark:border-white/14 bg-white/16 dark:bg-white/[0.04] backdrop-blur-xl"
      >
        {(
          [
            { id: 'chat', label: 'Multi-Turn Tutor & Web Search', icon: Bot },
            { id: 'voice', label: 'Live Voice Tutor (Gemini 3.8 Live)', icon: Radio },
            { id: 'music', label: 'Study Room Music & Rain', icon: Music },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                active
                  ? 'text-white'
                  : 'bg-white/10 dark:bg-white/[0.03] text-slate-800 dark:text-slate-100 hover:bg-white/25 dark:hover:bg-white/12'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="ai-studio-tab-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-[#7C3AED]/74 border border-white/30 shadow-sm backdrop-blur-md"
                />
              )}
              <Icon className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
      {activeTab === 'chat' && (
        <motion.div
          key="chat"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="space-y-5"
        >
          {/* Model Routing, Tutor Persona & Search Grounding Controls */}
          <section className="rounded-2xl border border-slate-200/70 dark:border-white/14 bg-white/74 dark:bg-[#1A1A36]/70 backdrop-blur-xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#7C3AED]" />
                  Multi-Turn Gemini Tutor
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Maintains conversation context across turns, supports reasoning-tier routing, and grounds live syllabus queries with Google Search.
                </p>
              </div>
              {state.tutorHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  aria-label="Clear tutor conversation"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-300 hover:text-[#EF4444]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Thread
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Gemini Model
                </label>
                <select
                  value={useGoogleSearch ? 'gemini-4-hydrogen' : selectedModel}
                  disabled={useGoogleSearch}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  aria-label="Select Gemini chat model"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/70 dark:bg-[#14142B]/80 text-xs disabled:opacity-60"
                >
                  {CHAT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Tutor Persona
                </label>
                <select
                  value={rolePersona}
                  onChange={(e) => setRolePersona(e.target.value)}
                  aria-label="Select tutor system role"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/70 dark:bg-[#14142B]/80 text-xs"
                >
                  {TUTOR_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Topic Focus
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  aria-label="Focus topic for AI assistant"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/70 dark:bg-[#14142B]/80 text-xs"
                >
                  <option value="">Entire Study Profile</option>
                  {state.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setUseGoogleSearch((v) => !v)}
                  aria-pressed={useGoogleSearch}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    useGoogleSearch
                      ? 'border-[#06B6D4] bg-[#06B6D4]/20 text-[#0369A1] dark:text-[#67E8F9]'
                      : 'border-slate-200/80 dark:border-white/15 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:border-[#06B6D4]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {useGoogleSearch ? 'Search Grounding: ON' : 'Google Search Grounding'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickAction(m.id, m.label)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border backdrop-blur-sm transition-colors ${
                    selectedMode === m.id
                      ? 'border-[#7C3AED] bg-[#7C3AED]/18 text-[#6D28D9] dark:text-[#C4B5FD]'
                      : 'border-slate-200/70 dark:border-white/12 bg-white/40 dark:bg-white/5 hover:border-[#06B6D4]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          {/* Scrollable Multi-Turn Conversation */}
          <section className="rounded-2xl border border-slate-200/70 dark:border-white/14 bg-white/76 dark:bg-[#1A1A36]/72 backdrop-blur-xl p-5 space-y-4 min-h-[360px] flex flex-col justify-between">
            <div ref={chatScrollRef} className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {state.tutorHistory.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Sparkles className="w-6 h-6 text-[#06B6D4] mx-auto" />
                  <p className="text-sm font-semibold">
                    Start a multi-turn conversation or click a study mode above
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Toggle Google Search Grounding when asking about recent exam notifications, regulatory changes, or up-to-date syllabus circulars.
                  </p>
                </div>
              ) : (
                state.tutorHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl text-sm leading-relaxed backdrop-blur-md ${
                      msg.role === 'user'
                        ? 'bg-[#7C3AED]/16 border border-[#7C3AED]/30 ml-auto max-w-2xl'
                        : 'bg-white/75 dark:bg-[#14142B]/80 border border-slate-200/70 dark:border-white/14 max-w-3xl'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        {msg.role === 'user'
                          ? 'You'
                          : `Study Buddy · Your go-to tutor (${msg.modelUsed || 'gemini-4-hydrogen'})`}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {msg.groundingSources && msg.groundingSources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-white/10 space-y-1.5">
                        <p className="text-[11px] font-mono uppercase tracking-wider text-[#0284C7] dark:text-[#67E8F9] flex items-center gap-1.5">
                          <Globe className="w-3 h-3" />
                          Verified Web Grounding Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.groundingSources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#06B6D4]/12 border border-[#06B6D4]/30 text-[11px] text-[#0369A1] dark:text-[#67E8F9] hover:underline max-w-[260px]"
                            >
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {error && (
              <div role="alert" className="px-4 py-2.5 rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/30 text-xs text-[#DC2626] dark:text-[#FCA5A5]">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendPrompt(input);
              }}
              className="flex gap-2 pt-3 border-t border-slate-200/70 dark:border-white/12"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  useGoogleSearch
                    ? 'Ask a live web-grounded question (exam updates, syllabus changes, current rules)...'
                    : 'Ask a follow-up question or request a worked derivation...'
                }
                aria-label="Prompt AI study assistant"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/80 dark:bg-[#14142B]/80 text-sm"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </form>
          </section>
        </motion.div>
      )}

      {activeTab === 'voice' && (
        <motion.section
          key="voice"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="rounded-2xl border border-slate-200/70 dark:border-white/14 bg-white/76 dark:bg-[#1A1A36]/72 backdrop-blur-xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#06B6D4]" />
                Real-Time Voice Conversation (`gemini-3.8-live`)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
                Speak naturally with your study partner at 16kHz mic input &amp; 24kHz live voice playback. Practice verbal recall, oral defense, or rapid-fire concept drills.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={liveVoice}
                disabled={liveStatus !== 'idle'}
                onChange={(e) => setLiveVoice(e.target.value)}
                aria-label="Select Live API voice"
                className="px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/70 dark:bg-[#14142B]/80 text-xs disabled:opacity-60"
              >
                {LIVE_VOICES.map((v) => (
                  <option key={v} value={v}>
                    Voice: {v}
                  </option>
                ))}
              </select>

              {liveStatus === 'idle' ? (
                <button
                  type="button"
                  onClick={startLiveSession}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-slate-950 text-xs font-bold transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  Start Voice Session
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                      isMuted
                        ? 'border-[#F97316] bg-[#F97316]/15 text-[#F97316]'
                        : 'border-slate-200 dark:border-white/15 bg-white/50 dark:bg-white/10'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isMuted ? 'Muted' : 'Mic Live'}
                  </button>
                  <button
                    type="button"
                    onClick={stopLiveSession}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    End Call
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/70 dark:border-white/12 bg-white/55 dark:bg-[#14142B]/70 space-y-3 min-h-[240px] max-h-[380px] overflow-y-auto">
            {liveTranscripts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                {liveStatus === 'idle'
                  ? 'Click "Start Voice Session" and allow microphone access to begin speaking with your AI study partner.'
                  : liveStatus === 'connecting'
                    ? 'Connecting low-latency audio stream to Gemini Live...'
                    : 'Listening — speak your question or ask Gemini to quiz you verbally.'}
              </div>
            ) : (
              liveTranscripts.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    item.speaker === 'You'
                      ? 'bg-[#7C3AED]/15 border border-[#7C3AED]/25 ml-auto max-w-xl'
                      : 'bg-white/75 dark:bg-white/8 border border-slate-200/60 dark:border-white/12 max-w-xl'
                  }`}
                >
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {item.speaker}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))
            )}
          </div>

          {liveError && (
            <div role="alert" className="px-4 py-2.5 rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/30 text-xs text-[#DC2626] dark:text-[#FCA5A5]">
              {liveError}
            </div>
          )}

          {liveStatus === 'connected' && (
            <form onSubmit={sendLiveTextPrompt} className="flex gap-2">
              <input
                type="text"
                value={liveNudge}
                onChange={(e) => setLiveNudge(e.target.value)}
                placeholder="Optional: send a text prompt or topic cue mid-call..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/80 dark:bg-[#14142B]/80 text-xs"
              />
              <button
                type="submit"
                disabled={!liveNudge.trim()}
                className="px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold disabled:opacity-50"
              >
                Send Cue
              </button>
            </form>
          )}
        </motion.section>
      )}

      {activeTab === 'music' && (
        <motion.section
          key="music"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="rounded-2xl border border-slate-200/70 dark:border-white/14 bg-white/76 dark:bg-[#1A1A36]/72 backdrop-blur-xl p-6 space-y-4"
        >
          <div>
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Music className="w-4 h-4 text-[#7C3AED]" />
              Rain &amp; Cozy Study Music Studio
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Layer gentle rain over warm lo-fi Rhodes chords and Japanese pentatonic ambient music directly in your browser.
            </p>
          </div>
          <AmbientAudioPanel />
        </motion.section>
      )}
      </AnimatePresence>
    </div>
  );
};
