require('dotenv').config();


const bcrypt = require('bcrypt')
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid');
const { addDoc, collection, getDocs, doc, deleteDoc, getDoc, query, where } = require('firebase/firestore');
const { db } = require('./firebase');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 4000;
const SECRET_KEY = process.env.JWT_SECRET ;
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.post('/post', upload.single('image'), async (req, res) => {
  try {
    const {
      name, price, description, category, stock,
      discount, section, material, detail, design,
      Condition, Warranty, Protection, Customization,
      itemnum, Pricetype
    } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'Image file is required' });
    if (isNaN(Number(price))) return res.status(400).json({ error: 'Price must be a number' });
    if (isNaN(Number(stock))) return res.status(400).json({ error: 'Stock must be a number' });
    if (isNaN(Number(discount))) return res.status(400).json({ error: 'Discount must be a number' });
    if (!isNaN(name)) return res.status(400).json({ error: 'Name must contain letters, not just numbers' });
    if (!section) return res.status(400).json({ error: 'Section is required' });

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'product-images', public_id: uuidv4() },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(file.buffer);
    });

    const docRef = await addDoc(collection(db, 'Products Collection'), {
      name,
      price: Number(price),
      description,
      category,
      stock: Number(stock),
      discount: Number(discount),
      section,
      imageUrl: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      createdAt: new Date().toISOString(),
      material: material || '',
      detail: detail || '',
      design: design || '',
      Condition: Condition || '',
      Warranty: Warranty || '',
      Protection: Protection || '',
      Customization: Customization || '',
      itemnum: itemnum || '',
      Pricetype: Pricetype || ''
    });

    res.status(200).json({
      message: 'Product created successfully',
      id: docRef.id,
      imageUrl: uploadResult.secure_url,
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

app.get('/posts/:section', async (req, res) => {
  try {
    const sectionName = req.params.section;
    const q = query(collection(db, 'Products Collection'), where('section', '==', sectionName));
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching by section:", error);
    res.status(500).json({ error: "Failed to fetch products by section" });
  }
});

app.get('/post/:postid', async (req, res) => {
  try {
    const postId = req.params.postid;
    const docRef = doc(db, 'Products Collection', postId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return res.status(404).json({ error: "Product not found" });
    const product = { id: docSnap.id, ...docSnap.data() };
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.get('/posts', async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, 'Products Collection'));
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(posts);
  } catch (error) {
    console.error('Error reading documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.delete('/post/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    const docRef = doc(db, 'Products Collection', docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return res.status(404).json({ error: "Document not found" });

    const post = docSnap.data();
    if (post.cloudinaryId) await cloudinary.uploader.destroy(post.cloudinaryId);

    await deleteDoc(docRef);
    res.status(200).json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

app.post("/log-in", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userSnap = await getDocs(
      query(collection(db, "Acc info"), where("email", "==", email))
    );

    if (userSnap.empty) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    const isPasswordCorrect = await bcrypt.compare(password, userData.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

   const token = jwt.sign(
  { id: userDoc.id, email: userData.email, role: userData.role || 'user' }, // default role
  SECRET_KEY,
  { expiresIn: "1h" }
);

return res.status(200).json({
  message: "Login successful",
  token,
  role: userData.role || 'user' // send role to frontend
});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


app.post('/sign-in', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const emailSnap = await getDocs(query(collection(db, 'Acc info'), where('email', '==', email)));
  if (!emailSnap.empty) {
    return res.status(400).json({ message: 'Email already exists' });
  }

  const nameSnap = await getDocs(query(collection(db, 'Acc info'), where('name', '==', name)));
  if (!nameSnap.empty) {
    return res.status(400).json({ message: 'Username already taken' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

const docRef = await addDoc(collection(db, 'Acc info'), {
  name,
  email,
  password: hashedPassword,
  role: 'user', // assign default role
});

  const token = jwt.sign({ id: docRef.id, email  }, SECRET_KEY, { expiresIn: '1h' });

  return res.status(201).json({ message: "Account created", token });
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'You have access', user: req.user });
});



const serverless = require('serverless-http');
module.exports = serverless(app);
