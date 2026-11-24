import React, { useEffect, useRef, useState } from 'react';
import { CloudRain, Music, Pause, Play, Volume2, VolumeX } from 'lucide-react';

interface AmbientAudioPanelProps {
  compact?: boolean;
  darkSurface?: boolean;
}

type MusicMoodId = 'kyoto-lofi' | 'shoji-piano' | 'midnight-pad';

const MUSIC_MOODS: Array<{
  id: MusicMoodId;
  label: string;
  tempoMs: number;
  chords: number[][];
}> = [
  {
    id: 'kyoto-lofi',
    label: 'Kyoto Rain Rhodes',
    tempoMs: 2800,
    // Warm jazzy maj7/m9 voicings (Fmaj7 - Em7 - Dm9 - Cmaj7)
    chords: [
      [174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
      [146.83, 174.61, 220.0, 261.63, 329.63],
      [130.81, 164.81, 196.0, 246.94],
    ],
  },
  {
    id: 'shoji-piano',
    label: 'Japanese Pentatonic',
    tempoMs: 2400,
    // Serene Yo/Hirajoshi-inspired warm chords
    chords: [
      [196.0, 246.94, 293.66, 392.0],
      [174.61, 220.0, 261.63, 349.23],
      [164.81, 220.0, 246.94, 329.63],
      [146.83, 196.0, 220.0, 293.66],
    ],
  },
  {
    id: 'midnight-pad',
    label: 'Midnight Focus Pad',
    tempoMs: 3600,
    chords: [
      [130.81, 196.0, 246.94, 293.66],
      [110.0, 164.81, 220.0, 261.63],
    ],
  },
];

export const AmbientAudioPanel: React.FC<AmbientAudioPanelProps> = ({
  compact = false,
  darkSurface = false,
}) => {
  // Synthesized Web Audio Rain State
  const [rainPlaying, setRainPlaying] = useState(false);
  const [rainVolume, setRainVolume] = useState(0.4);
  const rainCtxRef = useRef<AudioContext | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);

  // Built-in Web Audio Cozy Study Lo-Fi Synthesizer State
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicMood, setMusicMood] = useState<MusicMoodId>('kyoto-lofi');
  const [musicVolume, setMusicVolume] = useState(0.32);
  const [audioError, setAudioError] = useState<string | null>(null);

  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicMasterGainRef = useRef<GainNode | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const chordStepRef = useRef<number>(0);

  const stopRain = () => {
    if (rainCtxRef.current) {
      rainCtxRef.current.close().catch(() => {});
      rainCtxRef.current = null;
      rainGainRef.current = null;
    }
    setRainPlaying(false);
  };

  const toggleRainSound = () => {
    setAudioError(null);
    if (rainPlaying) {
      stopRain();
      return;
    }

    try {
      const ctx = new AudioContext();
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
      }

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1350;

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 190;

      const gainNode = ctx.createGain();
      gainNode.gain.value = rainVolume;

      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start();

      rainCtxRef.current = ctx;
      rainGainRef.current = gainNode;
      setRainPlaying(true);
    } catch {
      setAudioError('Browser audio playback was blocked or unavailable.');
    }
  };

  const stopStudyMusic = () => {
    if (musicTimerRef.current !== null) {
      window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
    }
    if (musicCtxRef.current) {
      musicCtxRef.current.close().catch(() => {});
      musicCtxRef.current = null;
      musicMasterGainRef.current = null;
    }
    setMusicPlaying(false);
  };

  const playWarmChord = (ctx: AudioContext, dest: AudioNode, freqs: number[], durationSec: number) => {
    const now = ctx.currentTime;
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(920, now);

      // Gentle Rhodes-like swell & soft tail
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(0.11 / freqs.length, now + 0.18 + idx * 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(dest);

      osc.start(now + idx * 0.03);
      osc.stop(now + durationSec + 0.05);
    });
  };

  const startStudyMusic = (moodId: MusicMoodId) => {
    stopStudyMusic();
    setAudioError(null);
    try {
      const mood = MUSIC_MOODS.find((m) => m.id === moodId) ?? MUSIC_MOODS[0];
      const ctx = new AudioContext();
      const masterGain = ctx.createGain();
      masterGain.gain.value = musicVolume;
      masterGain.connect(ctx.destination);

      musicCtxRef.current = ctx;
      musicMasterGainRef.current = masterGain;
      chordStepRef.current = 0;

      const trigger = () => {
        if (!musicCtxRef.current || !musicMasterGainRef.current) return;
        const chord = mood.chords[chordStepRef.current % mood.chords.length];
        chordStepRef.current += 1;
        playWarmChord(
          musicCtxRef.current,
          musicMasterGainRef.current,
          chord,
          mood.tempoMs / 1000
        );
      };

      trigger();
      musicTimerRef.current = window.setInterval(trigger, mood.tempoMs);
      setMusicPlaying(true);
    } catch {
      setAudioError('Browser audio playback was blocked or unavailable.');
    }
  };

  const toggleStudyMusic = () => {
    if (musicPlaying) {
      stopStudyMusic();
    } else {
      startStudyMusic(musicMood);
    }
  };

  const handleMoodChange = (newMood: MusicMoodId) => {
    setMusicMood(newMood);
    if (musicPlaying) {
      startStudyMusic(newMood);
    }
  };

  useEffect(() => {
    if (rainGainRef.current && rainCtxRef.current) {
      rainGainRef.current.gain.setTargetAtTime(
        rainVolume,
        rainCtxRef.current.currentTime,
        0.08
      );
    }
  }, [rainVolume]);

  useEffect(() => {
    if (musicMasterGainRef.current && musicCtxRef.current) {
      musicMasterGainRef.current.gain.setTargetAtTime(
        musicVolume,
        musicCtxRef.current.currentTime,
        0.08
      );
    }
  }, [musicVolume]);

  useEffect(() => {
    return () => {
      if (rainCtxRef.current) {
        rainCtxRef.current.close().catch(() => {});
      }
      if (musicTimerRef.current !== null) {
        window.clearInterval(musicTimerRef.current);
      }
      if (musicCtxRef.current) {
        musicCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const panelText = darkSurface ? 'text-white' : 'text-slate-900 dark:text-white';
  const subText = darkSurface ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300';

  return (
    <div className={`space-y-4 ${panelText}`}>
      {/* Rain Ambience Controls */}
      <div
        className={`p-3.5 rounded-xl border ${
          darkSurface
            ? 'border-white/15 bg-white/8'
            : 'border-slate-200/70 dark:border-white/15 bg-white/45 dark:bg-white/5'
        } backdrop-blur-md space-y-3`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CloudRain className="w-4 h-4 text-[#06B6D4]" />
            <div>
              <p className="text-xs font-semibold">Rain on Shoji Window</p>
              <p className={`text-[11px] ${subText}`}>Real-time soft rain ambience</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleRainSound}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              rainPlaying
                ? 'bg-[#06B6D4] text-slate-950'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
            }`}
          >
            {rainPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {rainPlaying ? 'Rain On' : 'Play Rain'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono w-14 ${subText}`}>
            Vol {Math.round(rainVolume * 100)}%
          </span>
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={rainVolume}
            onChange={(e) => setRainVolume(Number(e.target.value))}
            aria-label="Rain ambience volume"
            className="flex-1 accent-[#06B6D4] cursor-pointer"
          />
        </div>
      </div>

      {/* Cozy Lo-Fi Study Music Synthesizer */}
      <div
        className={`p-3.5 rounded-xl border ${
          darkSurface
            ? 'border-white/15 bg-white/8'
            : 'border-slate-200/70 dark:border-white/15 bg-white/45 dark:bg-white/5'
        } backdrop-blur-md space-y-3`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Music className="w-4 h-4 text-[#7C3AED]" />
            <div>
              <p className="text-xs font-semibold">Cozy Study Room Music</p>
              <p className={`text-[11px] ${subText}`}>
                Warm lo-fi Rhodes &amp; Japanese ambient chords
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleStudyMusic}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              musicPlaying
                ? 'bg-[#22C55E] text-slate-950'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
            }`}
          >
            {musicPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {musicPlaying ? 'Pause Music' : 'Play Music'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {MUSIC_MOODS.map((mood) => (
            <button
              key={mood.id}
              type="button"
              onClick={() => handleMoodChange(mood.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                musicMood === mood.id
                  ? 'border-[#06B6D4] bg-[#06B6D4]/20 text-[#06B6D4]'
                  : darkSurface
                    ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/15'
                    : 'border-slate-200/80 dark:border-white/15 hover:border-[#06B6D4]'
              }`}
            >
              {mood.label}
            </button>
          ))}
        </div>

        {!compact && (
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-mono w-14 ${subText}`}>
              Vol {Math.round(musicVolume * 100)}%
            </span>
            <input
              type="range"
              min={0.05}
              max={0.85}
              step={0.05}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              aria-label="Study music volume"
              className="flex-1 accent-[#7C3AED] cursor-pointer"
            />
          </div>
        )}
      </div>

      {audioError && (
        <div role="alert" className="px-3 py-2 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[11px] text-[#FCA5A5]">
          {audioError}
        </div>
      )}
    </div>
  );
};
