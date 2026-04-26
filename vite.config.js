import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { describeMetricsMode, getMetricsPayload } from './scripts/metrics-endpoint.mjs';
import { describeUsageLimitMode, getUsageLimitPayload } from './scripts/usage-limit-endpoint.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'claude-metrics-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/metrics', async (_request, response) => {
          const payload = await getMetricsPayload(process.env);
          response.writeHead(payload.statusCode, payload.headers);
          response.end(payload.body);
        });

        server.middlewares.use('/api/usage-limit', async (_request, response) => {
          const payload = await getUsageLimitPayload(process.env);
          response.writeHead(payload.statusCode, payload.headers);
          response.end(payload.body);
        });

        server.httpServer?.once('listening', () => {
          server.config.logger.info(
            `Claude metrics endpoint: /api/metrics -> ${describeMetricsMode(process.env)}`,
            { clear: false }
          );
          server.config.logger.info(
            `Claude usage limit endpoint: /api/usage-limit -> ${describeUsageLimitMode(process.env)}`,
            { clear: false }
          );
        });
      }
    }
  ],
  server: {
    host: true
  }
});
