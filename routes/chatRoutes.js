import express from 'express';
import { saveMessage, getChatHistory, clearChatHistory } from '../controllers/chatController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/save', saveMessage);
router.get('/history', getChatHistory);
router.delete('/clear', clearChatHistory);

export default router;
