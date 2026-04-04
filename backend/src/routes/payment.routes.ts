import { Router } from 'express';
import {
  initiateHandler,
  initiateForBookingHandler,
  initiateForPendingUpdateHandler,
  webhookHandler,
  verifyHandler,
} from '../controllers/payment.controller';

const router = Router();

router.post('/initiate', initiateHandler);
router.post('/initiate-for-booking', initiateForBookingHandler);
router.post('/initiate-for-pending-update', initiateForPendingUpdateHandler);
router.post('/webhook', webhookHandler);
router.get('/verify', verifyHandler);

export default router;
