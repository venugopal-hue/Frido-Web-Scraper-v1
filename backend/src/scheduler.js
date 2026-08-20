import cron from 'node-cron';
import { runCycle } from './pipeline.js';
import { targetUrls } from './targets.js';
import { notifySubscribers, notifyWatchers } from './notify.js';
import { formatDiff, HEAL_ALERT } from './format-alert.js';
import { trackProgress, clearProgress } from './progress.js';

/**
 * Scheduled scrape. Every completed cycle is diffed against the previous
 * snapshot; anything meaningful gets pushed to Telegram subscribers.
 */
export function startScheduler() {
  const expr = process.env.CRON_SCHEDULE ?? '0 */6 * * *'; // every 6 hours

  if (!cron.validate(expr)) {
    console.error(`[scheduler] invalid CRON_SCHEDULE "${expr}" — scheduler not started`);
    return;
  }

  cron.schedule(expr, async () => {
    console.log(`[scheduler] tick ${new Date().toISOString()}`);
    try {
      const result = await runCycle({
        urls: targetUrls(),
        autoHeal: true,
        // Report into the same shared progress the dashboard reads, so a
        // scheduled run shows its phase just like a manual one.
        onEvent: (e) => {
          trackProgress(e);
          console.log('[scheduler]', e.type, e.chunk ? `${e.chunk}/${e.of}` : '');
        },
      });

      if (result.healed) {
        await notifySubscribers(HEAL_ALERT);
      }
      if (result.diff?.hasChanges) {
        await notifySubscribers(formatDiff(result.diff));
        // Watchers hear about their own products even when the change is too
        // small to make the catalogue-wide digest.
        await notifyWatchers(result.diff);
      }
    } catch (err) {
      console.error('[scheduler] cycle failed:', err);
    } finally {
      clearProgress();
    }
  });

  console.log(`[scheduler] started with "${expr}"`);
}

