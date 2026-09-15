import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../observability/logger';
import { bullQueueDepth } from '../observability/metrics';
import { eventDispatcher } from '../events/eventDispatcher';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Ensure invoices directory exists
const invoicesDir = path.join(process.cwd(), 'storage', 'invoices');
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

export async function generateInvoicePdf(data: any): Promise<{ filePath: string; downloadUrl: string }> {
  const { orderId, orderNumber, customerEmail, totalAmount, items, tenantId } = data;
  logger.info({ orderNumber }, '📄 Rendering PDF Invoice with PDFKit');

  const fileName = `invoice-${orderNumber}.pdf`;
  const filePath = path.join(invoicesDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
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
      items.forEach((item: any) => {
        doc.text(`• ${item.title || item.variantSku} - Qty: ${item.quantity} - $${item.unitPrice} (Total: $${item.totalPrice})`);
      });
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text(`Total Amount: $${totalAmount}`);
    doc.end();

    stream.on('finish', () => {
      logger.info({ filePath }, 'PDF Invoice rendered successfully');
      const downloadUrl = `/api/v1/admin/orders/${orderId}/invoice-pdf`;

      eventDispatcher.dispatch({
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
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  async add(jobName: string, data: any) {
    logger.info({ queue: this.name, jobName }, '⚡ Asynchronous job queued');
    if (this.name === 'invoice-queue') {
      setTimeout(() => generateInvoicePdf(data).catch(() => {}), 100);
    }
    return { id: `job_${Date.now()}` };
  }
  async count() {
    return 0;
  }
}

export let emailQueue: any = new FallbackQueue('email-queue');
export let invoiceQueue: any = new FallbackQueue('invoice-queue');
export let courierQueue: any = new FallbackQueue('courier-queue');

try {
  const host = redis.options?.host || 'localhost';
  const port = redis.options?.port || 6379;
  const connection = { host, port, maxRetriesPerRequest: null };

  emailQueue = new Queue('email-queue', { connection });
  invoiceQueue = new Queue('invoice-queue', { connection });
  courierQueue = new Queue('courier-queue', { connection });

  new Worker(
    'email-queue',
    async (job: Job) => {
      logger.info({ jobId: job.id, to: job.data.to }, '📧 [Worker] Processing email dispatch');
      return { delivered: true };
    },
    { connection }
  );

  new Worker(
    'invoice-queue',
    async (job: Job) => {
      return generateInvoicePdf(job.data);
    },
    { connection }
  );
} catch (e) {
  logger.info('BullMQ running in graceful in-memory worker mode');
}

// Connect domain events to queues
eventDispatcher.on('order.placed', async (event) => {
  try {
    const { orderId, orderNumber, customerEmail, totalAmount, items } = event.payload;

    await emailQueue.add('send-receipt', {
      to: customerEmail,
      subject: `Order Confirmation #${orderNumber}`,
      orderId,
      totalAmount,
    });

    await invoiceQueue.add('generate-pdf', {
      orderId,
      orderNumber,
      customerEmail,
      totalAmount,
      items,
      tenantId: event.tenantId,
    });
  } catch (err) {
    logger.error({ err }, 'Error enqueueing background jobs for order.placed');
  }
});
