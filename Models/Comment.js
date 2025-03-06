<<<<<<< HEAD
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  content: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  username: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Comment', commentSchema);
=======
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  content: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  username: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Comment', commentSchema);
>>>>>>> 8d98f5a (Added a dependecy for push notifcations)
