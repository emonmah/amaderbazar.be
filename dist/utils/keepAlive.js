"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startKeepAliveSelfPing = startKeepAliveSelfPing;
exports.getKeepAliveStatus = getKeepAliveStatus;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../observability/logger");
const config_1 = require("../config");
let lastPingTimestamp = null;
let totalPingsSent = 0;
/**
 * Render Free Tier Anti-Sleep Self-Ping Heartbeat
 * Every 10 minutes (or configured interval), performs a GET operation
 * to /health to ensure Render's 15-minute inactivity timer never triggers.
 */
function startKeepAliveSelfPing() {
    const intervalMinutes = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10;
    const intervalMs = intervalMinutes * 60 * 1000;
    logger_1.logger.info({ intervalMinutes }, `🕒 Keep-alive self-ping scheduler started: GET /health will execute every ${intervalMinutes} min to prevent Render from sleeping`);
    const performPing = async () => {
        const uptimeSec = Math.floor(process.uptime());
        const uptimeMin = Math.floor(uptimeSec / 60);
        // Render sets RENDER_EXTERNAL_URL (e.g. https://amaderbazar-api.onrender.com)
        // Pinging this public URL routes through Render's external router, registering inbound activity
        const baseUrl = process.env.RENDER_EXTERNAL_URL ||
            process.env.BACKEND_URL ||
            process.env.SELF_URL ||
            `http://localhost:${config_1.config.port}`;
        const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;
        try {
            logger_1.logger.info({ uptimeMinutes: uptimeMin, healthUrl, pingCount: totalPingsSent + 1 }, '💓 Executing keep-alive GET operation to prevent Render from pausing backend');
            const res = await axios_1.default.get(healthUrl, {
                headers: {
                    'x-source': 'render-keepalive-ping',
                    'User-Agent': 'RenderKeepAliveBot/1.0',
                },
                timeout: 15000,
            });
            lastPingTimestamp = new Date();
            totalPingsSent++;
            logger_1.logger.info({ status: res.status, uptimeMinutes: uptimeMin, totalPingsSent }, '✅ Render keep-alive GET operation succeeded');
        }
        catch (err) {
            logger_1.logger.warn({ error: err.message, healthUrl }, '⚠️ Keep-alive GET operation failed (service may be waking up or DNS resolving)');
        }
    };
    const timer = setInterval(performPing, intervalMs);
    if (timer.unref) {
        timer.unref();
    }
}
function getKeepAliveStatus() {
    return {
        enabled: true,
        intervalMinutes: Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10,
        totalPingsSent,
        lastPingTimestamp,
        renderExternalUrl: process.env.RENDER_EXTERNAL_URL || null,
    };
}
