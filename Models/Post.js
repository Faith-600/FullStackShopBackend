import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  username: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Post', postSchema);
