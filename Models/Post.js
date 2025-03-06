<<<<<<< HEAD
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  username: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Post', postSchema);
=======
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  username: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Post', postSchema);
>>>>>>> 8d98f5a (Added a dependecy for push notifcations)
