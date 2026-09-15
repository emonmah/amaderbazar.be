"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otelSdk = void 0;
exports.startTracing = startTracing;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const logger_1 = require("./logger");
exports.otelSdk = new sdk_node_1.NodeSDK({
    resource: new resources_1.Resource({
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: 'ecommerce-backend',
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
});
function startTracing() {
    try {
        exports.otelSdk.start();
        logger_1.logger.info('🔭 OpenTelemetry tracing initialized');
    }
    catch (error) {
        logger_1.logger.warn({ error }, 'OpenTelemetry failed to initialize, continuing without tracing');
    }
}
