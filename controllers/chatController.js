import Message from '../models/Message.js';

export const saveMessage = async (req, res) => {
  const { messages } = req.body;
  const userId = req.user.id;
  try {
    await Message.insertMany(messages.map(msg => ({ ...msg, userId })));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving messages', error });
  }
};

export const getChatHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    const messages = await Message.find({ userId }).sort({ timestamp: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching chat history', error });
  }
};

export const clearChatHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    await Message.deleteMany({ userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error clearing chat history', error });
  }
};
