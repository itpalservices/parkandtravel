import { Router } from 'express';
import {
  initiateHandler,
  initiateForBookingHandler,
  webhookHandler,
  verifyHandler,
} from '../controllers/payment.controller';

const router = Router();

router.post('/initiate', initiateHandler);
router.post('/initiate-for-booking', initiateForBookingHandler);
router.post('/webhook', webhookHandler);
router.get('/verify', verifyHandler);

export default router;
