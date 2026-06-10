import app from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Maritime ERP Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
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
