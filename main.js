import express from 'express';
import mysql from 'mysql';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { Server } from 'socket.io'
import {createServer} from 'http'
import dotenv  from 'dotenv'


dotenv.config();
const dbPassword = process.env.DB_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
const dbUsers = process.env.DB_USER;
const dbName = process.env.DB_NAME;
const dbPort = process.env.DB_PORT;
const dbHost = process.env.DB_HOST;



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
  cookie: { maxAge: 1000 * 60 * 60 * 24 } 
}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const httpServer = createServer(); 
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ["GET", "POST"]
  }
});


const namePattern = /^[a-zA-Z\s]{2,50}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const db = mysql.createPool({
  host: dbHost,
  user: dbUsers,
  password: dbPassword,
  database: dbName,
  port:dbPort
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


app.post("/users", (req, res) => {
  const { name, email, password } = req.body;

   // Validate name pattern
  if (!namePattern.test(name)) {
    return res.status(400).json({ error: 'Name must be 2-50 alphabetic characters long.' });
  }
   // Validate password pattern
   if (!passwordPattern.test(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long, include at least one uppercase letter, one lowercase letter, one number, and one special character.',
    });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const checkEmailQuery = "SELECT * FROM users WHERE email = ?";
  db.query(checkEmailQuery, [email], (err, results) => {
    if (err) {
      console.error("MySQL Error:", err);
      return res.status(500).json({ message: "Database error", error: err });
    }
    if (results.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const sql = "INSERT INTO users (name, email, password) VALUES (?)";
    const values = [name, email, password];
    db.query(sql, [values], (err, result) => {
      if (err) {
        console.error("MySQL Error:", err);
        return res.status(500).json({ message: 'Error inserting user', error: err });
      }
      return res.status(201).json({ message: "User registered successfully", result });
    });
  });
});

app.post('/login', (req, res) => {
  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(sql, [req.body.email, req.body.password], (err, result) => {
    if (err) {
      console.error("MySQL Error:", err);
      return res.json({ message: 'Error inside server' });
    }
    if (result.length > 0) {
      req.session.name = result[0].name;
      // console.log(req.session.name);
      
      return res.json({ Login: true, user: result[0] });  // Sending user data if needed
    } else {
      return res.json({ Login: false });
    }
  });
});

app.post('/posts', (req, res) => {
  const { content,username } = req.body;

  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Content cannot be empty.' });
  }
  if (!username || username.toLowerCase() === 'guest' ) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  

  // Insert post into the database
  const query = 'INSERT INTO posts (content,username) VALUES (?,?)';
  db.query(query, [content,username], (err, result) => {
    if (err) {
      console.error('Error inserting post:', err);
      return res.status(500).json({ error: 'Failed to save post.' });
    }

   // Retrieve the newly created post with the generated ID
   const newPostId = result.insertId;
   const fetchQuery = 'SELECT * FROM posts WHERE id = ?'; // Assuming "id" is the primary key
   db.query(fetchQuery, [newPostId], (fetchErr, rows) => {
     if (fetchErr) {
       console.error('Error fetching new post:', fetchErr);
       return res.status(500).json({ error: 'Failed to retrieve new post.' });
     }
     
     // Respond with the new post's data
     if (rows.length > 0) {
      const newPost = rows[0]; // Assuming rows[0] contains the post data
      res.status(201).json(newPost);
    } else {
      res.status(404).json({ error: 'New post not found after creation.' });
    }
  });
  });
});

// Route to retrieve all posts (optional)
app.get('/posts', (req, res) => {
  const query = 'SELECT * FROM posts ORDER BY created_at DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching posts:', err);
      return res.status(500).json({ error: 'Failed to fetch posts.' });
    }

    res.status(200).json({ posts: results });
    
  });
});


// Updating Posts

app.put('/posts/:id', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  db.query('UPDATE posts SET content = ? WHERE id = ?', [content, id], (err, result) => {
    if (err) {
      return res.status(500).send({ error: 'Error updating post' });
    }
    res.send({ success: true, updatedPost: { id, content } });
  });
});

// Handling Delete Posts 
app.delete('/posts/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM posts WHERE id = ?', [id], (err, result) => {
    if (err) {
      return res.status(500).send({ error: 'Error deleting post' });
    }
    res.send({ success: true, message: 'Post deleted successfully' });
  });
});




// Post a New Comment
app.post('/api/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;
  const { content, parentId,username } = req.body; // parentId is optional for nested comments

  if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Content cannot be empty.' });
  }
  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username cannot be empty.' });
}

  // Insert comment into the database
  const query = 'INSERT INTO comments (postId, content, parentId,username) VALUES (?, ?, ?,?)';
  db.query(query, [postId, content, parentId || null,username], (err, result) => {
      if (err) {
          console.error('Error adding comment:', err);
          return res.status(500).json({ error: 'Failed to add comment' });
      }
      res.status(201).json({ id: result.insertId, postId, content, parentId ,username});
  });
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

app.get("/users", (req, res) => {
  db.query("SELECT id, name FROM users", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// // Getting message 
app.get('/messages/:sender/:receiver', (req, res) => {
  const { sender, receiver } = req.params;
  const query = `
    SELECT * FROM messages
    WHERE (sender = ? AND receiver = ?)
    OR (sender = ? AND receiver = ?)
    ORDER BY createdAt ASC;
  `;
  db.query(query, [sender, receiver, receiver, sender], (err, results) => {
    if (err) {
      console.error('Error fetching messages:', err);
      return res.status(500).json({ error: 'Failed to fetch messages.' });
    }
    res.status(200).json(results);
  });
});



// Posting  message
app.post('/messages', (req, res) => {
  const { sender, receiver, content } = req.body;

  const query = `
    INSERT INTO messages (sender, receiver, content)
    VALUES (?, ?, ?);
  `;
  db.query(query, [sender, receiver, content], (err, result) => {
    if (err) {
      console.error('Error saving message:', err);
      return res.status(500).json({ error: 'Failed to save message.' });
    }
    io.emit('newMessage', { sender, receiver, content });
    res.status(201).json({ message: 'Message sent successfully.' });
  });
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
