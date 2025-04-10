import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, match: /^[a-zA-Z\s]{2,50}$/ },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  pushTokens: [{type:String}],
}, { timestamps: true });


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

export default mongoose.model('User', userSchema);

