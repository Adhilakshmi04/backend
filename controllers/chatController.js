import Chat from '../models/Chat.js';

export const saveMessage = async (req, res) => {
  const { messages } = req.body;
  const userId = req.user.id;
  try {
    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = new Chat({ userId, messages });
    } else {
      chat.messages.push(...messages);
    }
    await chat.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving messages', error });
  }
};

export const getChatHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    const chat = await Chat.findOne({ userId }).select('messages');
    if (!chat) {
      return res.json({ success: true, messages: [] });
    }
    res.json({ success: true, messages: chat.messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching chat history', error });
  }
};

export const clearChatHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    const chat = await Chat.findOne({ userId });
    if (!chat) {
      return res.json({ success: true });
    }
    chat.messages = [];
    await chat.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error clearing chat history', error });
  }
};
