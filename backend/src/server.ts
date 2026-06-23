import app from './app';
import { env } from './config/env';
import https from 'https';
import http from 'http';
import { JobScheduler } from './modules/jobs/scheduler';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Maritime ERP Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);

  // Initialize the cron-based job scheduler (replaces raw setInterval)
  if (env.ENABLE_CRON_JOBS) {
    JobScheduler.initialize();
    console.log('[Scheduler] Cron-based job scheduler initialized');
  } else {
    console.log('[Scheduler] Cron jobs DISABLED via ENABLE_CRON_JOBS=false');
  }

  // Start self-pinging keep-alive mechanism to prevent Render Free Tier spin-down
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_EXTERNAL_URL) {
    console.log(`[Keep-Awake] Configured self-ping for ${RENDER_EXTERNAL_URL}`);
    const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

    setInterval(() => {
      const healthUrl = `${RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`;
      console.log(`[Keep-Awake] Pinging health endpoint: ${healthUrl}`);

      const client = healthUrl.startsWith('https') ? https : http;
      client.get(healthUrl, (res) => {
        console.log(`[Keep-Awake] Ping response status: ${res.statusCode}`);
      }).on('error', (error) => {
        console.error(`[Keep-Awake] Error during ping: ${error.message}`);
      });
    }, PING_INTERVAL_MS);
  } else {
    console.log('[Keep-Awake] RENDER_EXTERNAL_URL not set. Skipping self-pinging.');
  }
});

// Graceful shutdowns
process.on('unhandledRejection', (err: any) => {
  console.error('💥 Unhandled Rejection! Shutting down server...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: any) => {
  console.error('💥 Uncaught Exception! Shutting down server...');
  console.error(err);
  process.exit(1);
});
