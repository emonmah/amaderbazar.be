"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courierQueue = exports.invoiceQueue = exports.emailQueue = void 0;
exports.generateInvoicePdf = generateInvoicePdf;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const logger_1 = require("../observability/logger");
const eventDispatcher_1 = require("../events/eventDispatcher");
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Ensure invoices directory exists
const invoicesDir = path_1.default.join(process.cwd(), 'storage', 'invoices');
if (!fs_1.default.existsSync(invoicesDir)) {
    fs_1.default.mkdirSync(invoicesDir, { recursive: true });
}
async function generateInvoicePdf(data) {
    const { orderId, orderNumber, customerEmail, totalAmount, items, tenantId } = data;
    logger_1.logger.info({ orderNumber }, '📄 Rendering PDF Invoice with PDFKit');
    const fileName = `invoice-${orderNumber}.pdf`;
    const filePath = path_1.default.join(invoicesDir, fileName);
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ margin: 50 });
        const stream = fs_1.default.createWriteStream(filePath);
        doc.pipe(stream);
        // Header
        doc.fontSize(20).text('TAX INVOICE / PACKING SLIP', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Invoice Number: ${orderNumber}`);
        doc.text(`Tenant ID: ${tenantId}`);
        doc.text(`Customer: ${customerEmail}`);
        doc.text(`Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();
        // Items
        doc.fontSize(10).text('Items:', { underline: true });
        doc.moveDown(0.5);
        if (items && Array.isArray(items)) {
            items.forEach((item) => {
                doc.text(`• ${item.title || item.variantSku} - Qty: ${item.quantity} - $${item.unitPrice} (Total: $${item.totalPrice})`);
            });
        }
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(12).text(`Total Amount: $${totalAmount}`);
        doc.end();
        stream.on('finish', () => {
            logger_1.logger.info({ filePath }, 'PDF Invoice rendered successfully');
            const downloadUrl = `/api/v1/admin/orders/${orderId}/invoice-pdf`;
            eventDispatcher_1.eventDispatcher.dispatch({
                type: 'invoice.generated',
                tenantId,
                payload: { orderId, orderNumber, downloadUrl },
            });
            resolve({ filePath, downloadUrl });
        });
        stream.on('error', reject);
    });
}
// Queue abstraction with graceful in-memory execution fallback
class FallbackQueue {
    name;
    constructor(name) {
        this.name = name;
    }
    async add(jobName, data) {
        logger_1.logger.info({ queue: this.name, jobName }, '⚡ Asynchronous job queued');
        if (this.name === 'invoice-queue') {
            setTimeout(() => generateInvoicePdf(data).catch(() => { }), 100);
        }
        return { id: `job_${Date.now()}` };
    }
    async count() {
        return 0;
    }
}
exports.emailQueue = new FallbackQueue('email-queue');
exports.invoiceQueue = new FallbackQueue('invoice-queue');
exports.courierQueue = new FallbackQueue('courier-queue');
try {
    const host = redis_1.redis.options?.host || 'localhost';
    const port = redis_1.redis.options?.port || 6379;
    const connection = { host, port, maxRetriesPerRequest: null };
    exports.emailQueue = new bullmq_1.Queue('email-queue', { connection });
    exports.invoiceQueue = new bullmq_1.Queue('invoice-queue', { connection });
    exports.courierQueue = new bullmq_1.Queue('courier-queue', { connection });
    new bullmq_1.Worker('email-queue', async (job) => {
        logger_1.logger.info({ jobId: job.id, to: job.data.to }, '📧 [Worker] Processing email dispatch');
        return { delivered: true };
    }, { connection });
    new bullmq_1.Worker('invoice-queue', async (job) => {
        return generateInvoicePdf(job.data);
    }, { connection });
}
catch (e) {
    logger_1.logger.info('BullMQ running in graceful in-memory worker mode');
}
// Connect domain events to queues
eventDispatcher_1.eventDispatcher.on('order.placed', async (event) => {
    try {
        const { orderId, orderNumber, customerEmail, totalAmount, items } = event.payload;
        await exports.emailQueue.add('send-receipt', {
            to: customerEmail,
            subject: `Order Confirmation #${orderNumber}`,
            orderId,
            totalAmount,
        });
        await exports.invoiceQueue.add('generate-pdf', {
            orderId,
            orderNumber,
            customerEmail,
            totalAmount,
            items,
            tenantId: event.tenantId,
        });
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Error enqueueing background jobs for order.placed');
    }
});
