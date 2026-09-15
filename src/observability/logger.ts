import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: !config.isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'ecommerce-backend',
    env: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
