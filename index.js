import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { Server } from 'socket.io'
import {createServer} from 'http'
import dotenv  from 'dotenv'
import User from './Models/User.js'
import Post from './Models/Post.js'
import Comment from './Models/Comment.js'
import Message from './Models/Message.js';
import bcrypt from 'bcrypt';
import MongoStore from 'connect-mongo';

dotenv.config();

const mongoUrl = process.env.MONGO_URL

const sessionSecret = process.env.SESSION_SECRET;

const app = express();
app.use(cors({
  origin:'http://localhost:5173',
  methods:["POST","GET",'PUT', 'DELETE'],
  credentials:true
}));
app.use(express.json());
app.use(session({
  secret: sessionSecret,          
  resave: false,                  
  saveUninitialized: true,           
  store: MongoStore.create({
    mongoUrl: mongoUrl, 
    collectionName: 'sessions',
  })
}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const httpServer = createServer(app); 
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ["GET", "POST"]
  }
});


mongoose.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('Connected to MongoDB');
  }).catch((err) => {
    console.error('MongoDB connection error:', err);
  });



app.get('/',(req,res)=>{
  res.json('Hello')
})



app.get('/',(req,res)=>{
  if(req.session.name){
return res.json({valid:true,name:req.session.name})
  }else{
    return res.json({valid:false})
  }
})

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.clearCookie('connect.sid'); // This will clear the session cookie on the client
    return res.status(200).json({ message: "Logout successful" });
  });
});

//  POSTING USERS 
app.post('/users', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const newUser = new User({ name, email, password });
    await newUser.save();
    
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error registering user", error: err });
  }
});

// LOGINS 
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.json({ Login: false });

    const isValid = await bcrypt.compare(req.body.password, user.password);
    if (!isValid) return res.json({ Login: false });

    req.session.name = user.name;
    res.json({ Login: true, user });
  } catch (err) {
    res.status(500).json({ message: 'Error inside server' });
  }
});



// Create a new post
app.post('/posts', async (req, res) => {
  try {
    const { content, username } = req.body;
    const newPost = new Post({ content, username });
    await newPost.save();
    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save post.' });
  }
});

// Get all posts
app.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// Update a post
app.put('/posts/:id', async (req, res) => {
  try {
    const { content } = req.body;
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, { content }, { new: true });
    if (!updatedPost) return res.status(404).json({ error: 'Post not found' });
    res.json(updatedPost);
  } catch (err) {
    res.status(500).json({ error: 'Error updating post' });
  }
});

// Delete a post
app.delete('/posts/:id', async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);
    if (!deletedPost) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting post' });
  }
});





// Add a new comment
app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const { content, parentId, username } = req.body;
    const newComment = new Comment({ postId: req.params.postId, content, parentId, username });
    await newComment.save();
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a specific post
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId }).sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments.' });
  }
});


// Get Comments for a Specific Post
app.get('/api/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;

  const query = 'SELECT * FROM comments WHERE postId = ? ORDER BY createdAt DESC';
  db.query(query, [postId], (err, results) => {
      if (err) {
          console.error('Error fetching comments:', err);
          return res.status(500).json({ error: 'Failed to fetch comments.' });
      }
      res.status(200).json(results);
  });
});



// Getting names of users 

app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, 'id name');
      res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// // Getting message 
// Get messages between two users
app.get('/messages/:sender/:receiver', async (req, res) => {
  const { sender, receiver } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ createdAt: 1 }); 

    res.status(200).json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});




// Post a message
app.post('/messages', async (req, res) => {
  const { sender, receiver, content } = req.body;

  try {
   
    const newMessage = new Message({ sender, receiver, content });
    await newMessage.save();
   io.emit('newMessage', { sender, receiver, content });
   res.status(201).json({ message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ error: 'Failed to save message.' });
  }
});

io.on('connection', (socket) => {
  console.log('connected');

  socket.on('newMessage', async (msg) => {
    try {
      // Assuming you have a Chat model to save messages
      const newMessage = new Chat(msg);
      await newMessage.save();
      io.emit('message', msg); // Emit the message to all clients
    } catch (err) {
      console.log(err);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

 



app.listen(3001, () => {
  console.log("Connected to backend");
});
