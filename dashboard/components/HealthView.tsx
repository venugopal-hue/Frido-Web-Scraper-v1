'use client';

import React from 'react';
import { HealEvent, Run, Status, timeAgo } from '@/lib/api';
import Card from './Card';
import HealTimeline from './HealTimeline';
import {
  IconHealth,
  IconShieldCheck,
  IconSparkles,
  IconTelegram,
  IconClock,
  IconCheck,
  IconAlertTriangle,
} from './Icons';

const RUN_STYLES: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  success: {
    dot: 'bg-emerald-500',
    label: 'Successful',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    text: 'text-emerald-700',
  },
  running: {
    dot: 'bg-blue-500 animate-ping',
    label: 'In Progress',
    bg: 'bg-blue-50 text-blue-700 border-blue-200/60',
    text: 'text-blue-700',
  },
  failed: {
    dot: 'bg-rose-500',
    label: 'Failed',
    bg: 'bg-rose-50 text-rose-700 border-rose-200/60',
    text: 'text-rose-700',
  },
  empty: {
    dot: 'bg-amber-500',
    label: 'Empty Results',
    bg: 'bg-amber-50 text-amber-700 border-amber-200/60',
    text: 'text-amber-700',
  },
  interrupted: {
    dot: 'bg-slate-400',
    label: 'Interrupted',
    bg: 'bg-slate-50 text-slate-600 border-slate-200',
    text: 'text-slate-500',
  },
};

const isInterrupted = (r: Run) => /interrupted/i.test(r.error ?? '');
const styleFor = (r: Run) =>
  isInterrupted(r) ? RUN_STYLES.interrupted : (RUN_STYLES[r.status] ?? RUN_STYLES.failed);

function duration(run: Run) {
  if (!run.finished_at) return '—';
  const ms = Date.parse(run.finished_at) - Date.parse(run.started_at);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HealthView({
  status,
  heals,
  runs,
}: {
  status: Status | null;
  heals: HealEvent[];
  runs: Run[];
}) {
  const attempted = runs.filter((r) => r.status !== 'running' && !isInterrupted(r));
  const succeeded = attempted.filter((r) => r.status === 'success').length;
  const rate = attempted.length ? Math.round((succeeded / attempted.length) * 100) : 0;
  const interrupted = runs.filter(isInterrupted).length;
  const repaired = heals.filter((h) => h.status === 'healed').length;

  return (
    <div className="space-y-6">
      {/* 4 KPI Health Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HealthStat
          label="Pipeline Success Rate"
          value={attempted.length ? `${rate}%` : '—'}
          hint={
            interrupted
              ? `${succeeded} of ${attempted.length} (${interrupted} interrupted)`
              : `${succeeded} of ${attempted.length} runs`
          }
          icon={IconCheck}
          badge="Reliability"
          badgeBg="bg-emerald-50 text-emerald-700 border-emerald-100"
          iconBg="bg-emerald-50 text-emerald-600 border-emerald-100"
        />
        <HealthStat
          label="Self-Healing Repairs"
          value={String(repaired)}
          hint={`${heals.length} repair cycles logged`}
          icon={IconSparkles}
          badge="AI Heals"
          badgeBg="bg-indigo-50 text-indigo-700 border-indigo-100"
          iconBg="bg-indigo-50 text-indigo-600 border-indigo-100"
        />
        <HealthStat
          label="Bright Data Engine"
          value={status?.collector_id ? 'Active' : 'Offline'}
          hint={status?.collector_id ?? 'No collector ID'}
          mono
          icon={IconShieldCheck}
          badge="Collector"
          badgeBg="bg-sky-50 text-sky-700 border-sky-100"
          iconBg="bg-sky-50 text-sky-600 border-sky-100"
        />
        <HealthStat
          label="Subscribed Users"
          value={String(status?.subscribers ?? 0)}
          hint="Telegram alert audience"
          icon={IconTelegram}
          badge="Telegram"
          badgeBg="bg-violet-50 text-violet-700 border-violet-100"
          iconBg="bg-violet-50 text-violet-600 border-violet-100"
        />
      </div>

      {/* Embedded Self-Healing Timeline */}
      <HealTimeline events={heals} />

      {/* Scraper Run History Card */}
      <Card className="overflow-hidden border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <IconClock size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                  Collector Execution History
                </h2>
                <p className="text-xs text-slate-500">
                  Comprehensive audit trail of recent collector scrape runs and execution durations.
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              Last {runs.length} Runs
            </span>
          </div>
        </div>

        <div className="p-5">
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
              No historical runs recorded in database yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {runs.map((r) => {
                const s = styleFor(r);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs transition hover:bg-slate-50/50 rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        #{r.id}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${s.bg}`}
                      >
                        {s.label}
                      </span>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <span className="font-semibold text-slate-800">
                        {r.status === 'running' ? 'Scraping inventory…' : `${r.item_count} items extracted`}
                      </span>
                      {r.error && !isInterrupted(r) && (
                        <span className="block truncate text-[11px] font-medium text-rose-600 mt-0.5">
                          {r.error}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-slate-500 font-medium">
                      <span className="tabular-nums font-mono text-[11px]">
                        {duration(r)}
                      </span>
                      <span className="w-20 text-right text-[11px] text-slate-400">
                        {timeAgo(r.finished_at ?? r.started_at)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function HealthStat({
  label,
  value,
  hint,
  mono = false,
  icon: Icon,
  badge,
  badgeBg,
  iconBg,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge: string;
  badgeBg: string;
  iconBg: string;
}) {
  return (
    <Card className="p-5 border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconBg}`}>
          <Icon size={18} />
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeBg}`}>
          {badge}
        </span>
      </div>

      <div className="mt-4">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </span>
        </div>
        {hint && (
          <p
            className={`mt-1.5 truncate text-xs text-slate-500 ${
              mono ? 'font-mono text-[11px]' : ''
            }`}
          >
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}
