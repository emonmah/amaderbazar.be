import axios from 'axios';
import { logger } from '../observability/logger';
import { config } from '../config';

let lastPingTimestamp: Date | null = null;
let totalPingsSent = 0;

/**
 * Render Free Tier Anti-Sleep Self-Ping Heartbeat
 * Every 10 minutes (or configured interval), performs a GET operation
 * to /health to ensure Render's 15-minute inactivity timer never triggers.
 */
export function startKeepAliveSelfPing() {
  const intervalMinutes = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10;
  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(
    { intervalMinutes },
    `🕒 Keep-alive self-ping scheduler started: GET /health will execute every ${intervalMinutes} min to prevent Render from sleeping`
  );

  const performPing = async () => {
    const uptimeSec = Math.floor(process.uptime());
    const uptimeMin = Math.floor(uptimeSec / 60);

    // Render sets RENDER_EXTERNAL_URL (e.g. https://amaderbazar-api.onrender.com)
    // Pinging this public URL routes through Render's external router, registering inbound activity
    const baseUrl =
      process.env.RENDER_EXTERNAL_URL ||
      process.env.BACKEND_URL ||
      process.env.SELF_URL ||
      `http://localhost:${config.port}`;

    const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;

    try {
      logger.info(
        { uptimeMinutes: uptimeMin, healthUrl, pingCount: totalPingsSent + 1 },
        '💓 Executing keep-alive GET operation to prevent Render from pausing backend'
      );

      const res = await axios.get(healthUrl, {
        headers: {
          'x-source': 'render-keepalive-ping',
          'User-Agent': 'RenderKeepAliveBot/1.0',
        },
        timeout: 15000,
      });

      lastPingTimestamp = new Date();
      totalPingsSent++;

      logger.info(
        { status: res.status, uptimeMinutes: uptimeMin, totalPingsSent },
        '✅ Render keep-alive GET operation succeeded'
      );
    } catch (err: any) {
      logger.warn(
        { error: err.message, healthUrl },
        '⚠️ Keep-alive GET operation failed (service may be waking up or DNS resolving)'
      );
    }
  };

  const timer = setInterval(performPing, intervalMs);

  if (timer.unref) {
    timer.unref();
  }
}

export function getKeepAliveStatus() {
  return {
    enabled: true,
    intervalMinutes: Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10,
    totalPingsSent,
    lastPingTimestamp,
    renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null,
  };
}
