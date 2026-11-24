import React, { useState } from 'react';
import { Download, Moon, RotateCcw, Sparkles, Sun, Trash2, Upload } from 'lucide-react';
import type { AppState, StudyProfile } from '../types/study';

interface SettingsViewProps {
  state: AppState;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onUpdateProfile: (patch: Partial<StudyProfile>) => void;
  onLoadDemo: () => void;
  onResetEmpty: () => void;
  onImportBackup: (next: AppState) => void;
  onOpenOnboarding: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  theme,
  onToggleTheme,
  onUpdateProfile,
  onLoadDemo,
  onResetEmpty,
  onImportBackup,
  onOpenOnboarding,
}) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `axiom-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Backup JSON downloaded.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (parsed && parsed.profile && Array.isArray(parsed.topics)) {
          onImportBackup(parsed);
          setStatusMsg('Workspace restored from backup.');
        } else {
          setStatusMsg('Invalid backup file format.');
        }
      } catch {
        setStatusMsg('Failed to parse backup JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {statusMsg && (
        <div className="px-4 py-3 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-xs font-semibold text-[#22C55E]">
          {statusMsg}
        </div>
      )}

      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold">Theme & Appearance</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Midnight Navy dark mode is enabled by default with a crisp light mode option.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold hover:border-[#7C3AED]"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-[#FACC15]" /> : <Moon className="w-4 h-4 text-[#7C3AED]" />}
          {theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        </button>
      </section>

      {/* Study Profile Settings */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold">Study Profile Preferences</h2>
          <button
            type="button"
            onClick={onOpenOnboarding}
            className="text-xs font-semibold text-[#06B6D4] hover:underline"
          >
            Relaunch Setup Wizard
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Student Name</label>
            <input
              type="text"
              value={state.profile.studentName}
              onChange={(e) => onUpdateProfile({ studentName: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Course / Program</label>
            <input
              type="text"
              value={state.profile.courseName}
              onChange={(e) => onUpdateProfile({ courseName: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Daily Availability (hours)</label>
            <input
              type="number"
              min={0.5}
              max={16}
              step={0.5}
              value={state.profile.dailyHoursTarget}
              onChange={(e) => onUpdateProfile({ dailyHoursTarget: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Weekly Study Goal (hours)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={state.profile.weeklyHoursTarget}
              onChange={(e) => onUpdateProfile({ weeklyHoursTarget: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] bg-slate-50 dark:bg-[#17172F] text-sm font-mono"
            />
          </div>
        </div>
      </section>

      {/* Sample Demo Mode & Backups */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2A2A50] bg-white/76 dark:bg-[#1A1A36]/68 backdrop-blur-xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-bold">Data Management, Demo Reset & Backups</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All data persists locally in your browser. Export a JSON backup anytime or reset sample demo data.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON Backup
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold cursor-pointer hover:border-[#06B6D4]">
            <Upload className="w-3.5 h-3.5 text-[#06B6D4]" />
            Restore JSON Backup
            <input type="file" accept=".json" onChange={handleImportJson} className="sr-only" />
          </label>

          <button
            type="button"
            onClick={() => {
              onLoadDemo();
              setStatusMsg('Sample Demo Data (CFA + FRM) loaded.');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#06B6D4]/40 text-[#06B6D4] text-xs font-semibold hover:bg-[#06B6D4]/10"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load / Reset Sample Demo Data
          </button>

          <button
            type="button"
            onClick={() => {
              onResetEmpty();
              setStatusMsg('Workspace cleared to blank state.');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#EF4444]/40 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Data
          </button>

          <button
            type="button"
            onClick={onOpenOnboarding}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#2E2E58] text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Study Profile
          </button>
        </div>
      </section>
    </div>
  );
};
