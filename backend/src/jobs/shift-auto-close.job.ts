import cron from 'node-cron';
import { prisma } from '../lib/prisma';

export function startShiftAutoCloseJob(): void {
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('[Shift Auto-Close] Running stale shift check...');

      const result = await prisma.$executeRaw`
        UPDATE shifts
        SET
          shift_end = last_activity_at,
          status = 'closed'
        WHERE status = 'open'
        AND last_activity_at < NOW() - INTERVAL '6 hours'
      `;

      if (result > 0) {
        console.log(`[Shift Auto-Close] Closed ${result} stale shift(s).`);
      }
    } catch (err) {
      console.error('[Shift Auto-Close] Job failed:', err);
    }
  });

  console.log('[Shift Auto-Close] Job scheduled (every 15 min, 6h inactivity threshold).');
}
