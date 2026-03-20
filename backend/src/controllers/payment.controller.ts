import { Request, Response } from 'express';
import {
  initiatePaymentForPending,
  initiatePaymentForBooking,
  handleWalleeWebhook,
  verifyAndFinalizePayment,
} from '../services/payment.service';

export async function initiateHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await initiatePaymentForPending(req.body);
    res.json(result);
  } catch (err: any) {
    console.error('initiateHandler error:', err?.response?.data || err.message);
    res.status(400).json({ message: err.message || 'Failed to initiate payment' });
  }
}

export async function initiateForBookingHandler(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId, source, amount } = req.body;
    if (!bookingId) {
      res.status(400).json({ message: 'bookingId is required' });
      return;
    }
    const customAmount = typeof amount === 'number' && amount > 0 ? amount : undefined;
    const result = await initiatePaymentForBooking(bookingId, source, customAmount);
    res.json(result);
  } catch (err: any) {
    console.error('initiateForBookingHandler error:', err?.response?.data || err.message);
    res.status(400).json({ message: err.message || 'Failed to initiate payment' });
  }
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  console.log('Wallee webhook received:', JSON.stringify(req.body));
  res.status(200).json({ received: true });
  handleWalleeWebhook(req.body).catch((err) =>
    console.error('Webhook processing error:', err)
  );
}

export async function verifyHandler(req: Request, res: Response): Promise<void> {
  try {
    const ref = req.query['ref'] as string;
    if (!ref) {
      res.status(400).json({ message: 'ref query param is required' });
      return;
    }
    const result = await verifyAndFinalizePayment(ref);
    res.json(result);
  } catch (err: any) {
    console.error('verifyHandler error:', err?.response?.data || err.message);
    res.status(500).json({ message: err.message || 'Failed to verify payment' });
  }
}
