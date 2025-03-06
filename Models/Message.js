<<<<<<< HEAD
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
=======
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
>>>>>>> 8d98f5a (Added a dependecy for push notifcations)
