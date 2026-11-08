import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { internalAuth } from './internal-auth.js';

const receiptSchema = new mongoose.Schema({
  _id: String,
  signature: { type: String, required: true },
  status: { type: String, enum: ['confirmed', 'rejected'], required: true },
  reason: String,
  items: [{ _id: false, productId: String, quantity: Number }],
}, { timestamps: true });
export const PurchaseReceipt = mongoose.model('PurchaseReceipt', receiptSchema);

export function mountPurchases(app, Inventory) {
  const validId = (req, res, next) => mongoose.isObjectIdOrHexString(req.params.orderId)
    ? next() : res.status(400).json({ message: 'Pedido inválido' });
  app.get('/internal/purchases/:orderId', internalAuth, validId, async (req, res) => {
    try {
      const receipt = await PurchaseReceipt.findById(req.params.orderId).lean();
      if (!receipt) return res.status(404).json({ message: 'Pedido todavía no procesado' });
      res.json(receipt);
    } catch { res.status(503).json({ message: 'No se pudo consultar el pedido' }); }
  });
  app.put('/internal/purchases/:orderId', internalAuth, validId, async (req, res) => {
    const raw = req.body?.items;
    if (!Array.isArray(raw) || !raw.length || raw.length > 100 || raw.some(item =>
      !item || !mongoose.isObjectIdOrHexString(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
      return res.status(400).json({ message: 'Detalle de compra inválido' });
    }
    const items = raw.map(({ productId, quantity }) => ({ productId: productId.toLowerCase(), quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId));
    if (new Set(items.map(item => item.productId)).size !== items.length) return res.status(400).json({ message: 'Productos repetidos' });
    const signature = createHash('sha256').update(JSON.stringify(items)).digest('hex');
    let receipt;
    try {
      // All stock deductions and the durable receipt commit in this database together.
      await mongoose.connection.transaction(async session => {
        receipt = await PurchaseReceipt.findById(req.params.orderId).session(session).lean();
        if (receipt) return;
        const rows = await Inventory.find({ _id: { $in: items.map(item => item.productId) } }).session(session).lean();
        const available = new Map(rows.map(item => [String(item._id), item.stock]));
        const enough = items.every(item => (available.get(item.productId) ?? -1) >= item.quantity);
        if (enough) {
          for (const item of items) {
            const update = await Inventory.updateOne({ _id: item.productId, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } }, { session });
            if (update.modifiedCount !== 1) throw new Error('Inventario cambió durante la compra');
          }
        }
        [receipt] = await PurchaseReceipt.create([{
          _id: req.params.orderId, signature, items,
          status: enough ? 'confirmed' : 'rejected',
          reason: enough ? undefined : 'Uno o más productos ya no tienen stock suficiente.',
        }], { session });
      });
    } catch (error) {
      // A concurrent retry may already have committed this exact purchase.
      receipt = null;
      try { receipt = await PurchaseReceipt.findById(req.params.orderId).lean(); } catch { /* Retry with the same ID later. */ }
      if (!receipt) return res.status(503).json({ message: 'No se pudo confirmar el inventario. Consultá el mismo pedido antes de volver a intentar.' });
    }
    if (receipt.signature !== signature) return res.status(409).json({ message: 'El identificador ya corresponde a otro detalle de compra' });
    res.json(receipt);
  });
}
