import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import dotenv  from 'dotenv';
import User from './Models/User.js'
import Post from './Models/Post.js'
import Comment from './Models/Comment.js'
import Message from './Models/Message.js';
import bcrypt from 'bcrypt';
import MongoStore from 'connect-mongo';
import {Expo} from 'expo-server-sdk'


dotenv.config();

const mongoUrl = process.env.MONGO_URL;
const port = process.env.PORT || 3001;
const expo = new Expo();



const sessionSecret = process.env.SESSION_SECRET;

const app = express();
const allowedOrigins = [
  "https://full-stack-shop-rouge.vercel.app", // Deployed frontend
  "http://localhost:8081", // React Native (Metro bundler)
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["POST", "GET", "PUT", "DELETE"],
    credentials: true,
  })
);
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



mongoose.connect(mongoUrl,{
  serverSelectionTimeoutMS: 5000,
}).then(() => console.log('Connected to MongoDB')).catch((err) => {
    console.error('MongoDB connection error:', err);
  });

 
app.get('/', (req, res) => {
  res.json({ message: 'Hello from the serverless function!' });
});


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
    res.clearCookie('connect.sid'); 
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
    const { email, pushToken } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ Login: false });

    const isValid = await bcrypt.compare(req.body.password, user.password);
    if (!isValid) return res.json({ Login: false });

    if (pushToken && !user.pushTokens.includes(pushToken)) {
      await User.updateOne({ _id: user._id }, { $push: { pushTokens: pushToken } });
      console.log('Token saved:', pushToken);
    }

    req.session.name = user.name;
    res.json({ Login: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Error inside server' });
  }
});



// Create a new post
app.post('/posts', async (req, res) => {
  try {
    const { content, username } = req.body;
    const newPost = new Post({ content, username });
    await newPost.save();

    // Fetch all users' push tokens
    const users = await User.find({}, 'pushTokens');
    const pushTokens = users
      .flatMap(user => user.pushTokens)
      .filter(token => Expo.isExpoPushToken(token));

      console.log('Found push tokens:', pushTokens);

      // Send notifications if there are valid tokens
    if (pushTokens.length > 0) {
      const messages = pushTokens.map(token => ({
        to: token,
        sound: 'default',
        title: 'New Post',
        body: `${username}: ${content.slice(0, 100)}...`,
        data: { postId: newPost._id },
      }));

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
          console.log('Notifications sent to:', chunk.map(msg => msg.to));
        } catch (error) {
          console.error('Notification error:', error);
        }
      }
    }

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
      console.log("Request Body:", req.body);
      console.log("Post ID:", req.params.postId);

      const { content, parentId, username } = req.body;
      const { postId } = req.params;

      if (!content || !username) {
          return res.status(400).json({ error: 'Content and username are required' });
      }

      // Convert postId to ObjectId
      const postObjectId = new mongoose.Types.ObjectId(postId);

      // Create the comment
      const newComment = new Comment({ 
          content, 
          username, 
          postId: postObjectId, // Save as ObjectId
          parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null 
      });

      await newComment.save();
      console.log('New comment saved:', newComment);
      res.status(201).json(newComment);
  } catch (err) {
      console.error('Error saving comment:', err);
      res.status(500).json({ error: 'Failed to add comment' });
  }
});


// Get comments for a specific post
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
      console.log('Fetching comments for postId:', req.params.postId); // Log the postId

      const postId = new mongoose.Types.ObjectId(req.params.postId); // Convert to ObjectId
      const comments = await Comment.find({ postId }).sort({ createdAt: -1 });

      console.log('Fetched comments:', comments); // Log the fetched comments
      res.status(200).json(comments);
  } catch (err) {
      console.error('Error fetching comments:', err); // Log the error
      res.status(500).json({ error: 'Failed to fetch comments.' });
  }
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

    res.status(200).json(messages || []);
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

    const receiverUser = await User.findOne({ name: receiver });
    if (!receiverUser || !receiverUser.pushTokens) {
      console.log(`No push token found for ${receiver}`);
      return res.status(201).json({ message: 'Message sent successfully, no notification sent.' });
    }

    const pushToken = receiverUser.pushTokens;
    const notificationPayload = {
      to: pushToken,
      title: `New Message from ${sender}`,
      body: content,
      data: { sender, receiver, content }, 
    };
    await axios.post('https://exp.host/--/api/v2/push/send', notificationPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((response) => {
      console.log('Push notification sent:', response.data);
    }).catch((error) => {
      console.error('Error sending push notification:', error.response?.data || error.message);
    });
    res.status(201).json({ message: 'Message sent successfully.' });
  } catch (err) {
    console.error('Error saving message or sending notification:', err);
    res.status(500).json({ error: 'Failed to save message.' });
  }
});
 
app.post('/update-token', async (req, res) => {
  const { name, pushToken } = req.body; 

  try {
    await User.updateOne({name }, { $push: { pushTokens: pushToken } }, { upsert: true });
    res.status(200).json({ message: 'Token updated successfully.' });
  } catch (err) {
    console.error('Error updating token:', err);
    res.status(500).json({ error: 'Failed to update token.' });
  }
});


export default app;

app.listen(port, ()=>{
  console.log("server is running on port " + port)
});


