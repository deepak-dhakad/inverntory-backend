require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Initialize Express app
const app = express();
const corsOptions = {
  origin: process.env.FRONTEND_URL, // Allow only the frontend URL from .env
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Apply CORS with options
app.use(cors(corsOptions));app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define Schemas and Models

// Nominee Schema
const nomineeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: { type: String },
  type: { type: String, enum: ['Material', 'Product'], required: true }, // "Material" or "Product"
  currentBalance: {
    fine: { type: Number, default: 0 },  // Default to 0 for new entries
    amount: { type: Number, default: 0 }, // Default to 0 for new entries
  }
});

const Nominee = mongoose.model('Nominee', nomineeSchema);


// Material Transaction Schema
const materialTransactionSchema = new mongoose.Schema({
  nomineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nominee' },
  date: { type: Date, default: Date.now },
  product: { type: String, required: true },
  totalWeight:{ type: Number, required: false },
  netWeight: { type: Number, required: false },
  tunch: { type: Number, required: false },
  wastage: { type: Number, required: false },
  transType: {
    type: String,
    enum: ['Naam', 'Jama'], // Enum definition
    required: true,
  },
  pieces: { type: Number, required: false },
  fine: { type: Number, required: false },
  bhav: { type: Number, required: false },
  badla: { type: Number, enum: [0, 10, 12], required: false },
  amount: { type: Number, required: false },
  description: { type: String, required: false },
  mode:{type: String,
    enum: ['cash', 'metal','bhav'], // Enum definition
    required: true,},
}, { timestamps: true });
const MaterialTransaction = mongoose.model('MaterialTransaction', materialTransactionSchema);
const boxSchema = new mongoose.Schema({
    quantity: { type: Number, required: true },       // Number of boxes
    weight: { type: Number, required: true },         // Individual box weight
  }, { _id: false }); // No unique ID for each box entry
  
  // Define a schema for individual polythene with quantity and weight per polythene
  const polytheneSchema = new mongoose.Schema({
    quantity: { type: Number, required: true },       // Number of polythenes
    weight: { type: Number, required: true },         // Individual polythene weight
  }, { _id: false }); // No unique ID for each polythene entry
  
  // Define the product schema with product-specific fields
  const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    grossWeight: { type: Number, required: true },
    tunch: { type: Number, required: true },
    boxes: [boxSchema],           // Array of boxes, each with quantity and individual weight
    polythene: [polytheneSchema], 
    wastage: { type: Number, required: true },
    fine: { type: Number, required: true },
  }, { _id: false }); 
  
  // Define the main transaction schema, including arrays for boxes and polythenes
  const productGiveTransactionSchema = new mongoose.Schema({
    nomineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nominee' },
    date: { type: Date, default: Date.now },
    description: { type: String, required: false },

    // Array of polythenes, each with quantity and individual weight
    products: [productSchema],   
    Totalfine: { type: Number, required: true },  
  }, { timestamps: true });
  
  const ProductGiveTransaction = mongoose.model('ProductGiveTransaction', productGiveTransactionSchema);

  const metalSchema = new mongoose.Schema({
    weight: { type: Number, required: false },
    tunch: { type: Number, required: false },
    fine: { type: Number, required: false },
    bhav: { type: Number, required: false },
    badla: { type: Number, enum: [0, 10, 12], required: false },
  });
  
  const productTakeTransactionSchema = new mongoose.Schema({
    nomineeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nominee' },
    date: { type: Date, default: Date.now },
    description: { type: String, required: false },
    amount: { type: Number, required: false },
    metal: { type: Boolean, required: false },
    metals: { type: [metalSchema], required: false },
  }, { timestamps: true });

productTakeTransactionSchema.pre('validate', function (next) {
  if (!this.amount && !this.metal) {
    next(new Error('Either amount or metal must be provided'));
  } else {
    next();
  }
});

const ProductTakeTransaction = mongoose.model('ProductTakeTransaction', productTakeTransactionSchema);

const lendenSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  transType: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true }
});
const Lenden = mongoose.model('Lenden', lendenSchema);
app.post('/lenden/add', async (req, res) => {
  const { name, description, date, transType, amount } = req.body;
  try {
    const lenden = new Lenden({ name, description, date, transType, amount });
    await lenden.save();
    res.status(201).json(lenden);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.get('/lenden', async (req, res) => {
  const { startDate, endDate } = req.query;
  const filter = {};

  if (startDate && endDate) {
    filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  try {
    const lendenRecords = await Lenden.find(filter);
    res.json(lendenRecords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.delete('/lenden/:id', async (req, res) => {
  try {
    await Lenden.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.put('/lenden/:id', async (req, res) => {
  try {
    const updatedTransaction = await Lenden.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedTransaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a nominee
app.get('/nominees/search', async (req, res) => {
    try {
      const { query, type } = req.query;
      const nominees = await Nominee.find({ 
        name: { $regex: query, $options: 'i' }, 
        type 
      }).limit(5);
      res.status(200).json(nominees);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/nominees', async (req, res) => {
    try {
      const nominees = await Nominee.find({});
      res.status(200).json(nominees);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching nominees', error });
    }
  });
 // Fetch all transactions, with optional date filtering
// Fetch all transactions, with optional date filtering based on updatedAt
app.get('/transactions/all', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};

    if (startDate) {
      filter.updatedAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      filter.updatedAt = filter.updatedAt || {};
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      filter.updatedAt.$lte = end;
    }

    const materialTransactions = await MaterialTransaction.find(filter)
      .populate('nomineeId', 'name')
      .sort({ updatedAt: -1 });
    const productGiveTransactions = await ProductGiveTransaction.find(filter)
      .populate('nomineeId', 'name')
      .sort({ updatedAt: -1 });
    const productTakeTransactions = await ProductTakeTransaction.find(filter)
      .populate('nomineeId', 'name')
      .sort({ updatedAt: -1 });

    const allTransactions = [
      ...materialTransactions.map(t => ({ ...t.toObject(), type: 'Material' })),
      ...productGiveTransactions.map(t => ({ ...t.toObject(), type: 'Product Give' })),
      ...productTakeTransactions.map(t => ({ ...t.toObject(), type: 'Product Take' })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); // Sort by updatedAt

    res.status(200).json(allTransactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

  
  
app.post('/nominees', async (req, res) => {
  try {
    const nominee = new Nominee(req.body);
    await nominee.save();
    res.status(201).json(nominee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a material transaction
app.post('/material-transactions', async (req, res) => {
  try {
    const transaction = new MaterialTransaction(req.body);
    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a product give transaction
app.post('/product-give-transactions', async (req, res) => {
  try {
    const transaction = new ProductGiveTransaction(req.body);
    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a product take transaction
app.post('/product-take-transactions', async (req, res) => {
  try {
    const transaction = new ProductTakeTransaction(req.body);
    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update transaction by ID and type

app.get('/transactions/:id', async (req, res) => {
  try {
    const transaction = await MaterialTransaction.findById(req.params.id).populate('nomineeId', 'name');
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update a material transaction by ID
app.put('/transactions/:id', async (req, res) => {
  try {
    const transaction = await MaterialTransaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(400).json({ message: 'Error updating transaction' });
  }
});
  
  
  
// Get transactions by nominee and date range

app.delete('/transactions/:id', async (req, res) => {
    try {
      const { type } = req.query;
      const { id } = req.params;
  
      // Normalize type to lowercase or remove spaces for consistent comparison
      const normalizedType = type.replace(/\s+/g, '').toLowerCase();
  
      let TransactionModel;
      switch (normalizedType) {
        case 'material':
          TransactionModel = MaterialTransaction;
          break;
        case 'productgive':
          TransactionModel = ProductGiveTransaction;
          break;
        case 'producttake':
          TransactionModel = ProductTakeTransaction;
          break;
        default:
          return res.status(400).json({ error: 'Invalid transaction type' });
      }
  
      const deletedTransaction = await TransactionModel.findByIdAndDelete(id);
      if (!deletedTransaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
  
      res.status(200).json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Error deleting transaction' });
    }
  });
  // Get transactions by nominee ID with optional date filtering
app.get('/transactions/by-nominee/:nomineeId', async (req, res) => {
  try {
    const { nomineeId } = req.params;
    const { startDate, endDate } = req.query;
    let filter = { nomineeId }; // Filter by nominee ID
    
    // Add date range to filter if provided
    if (startDate) {
      filter.date = { $gte: new Date(startDate) };
    }
    if (endDate) {
      filter.date = filter.date || {};
      // Set end date to the end of the day for inclusiveness
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }

    // Fetch transactions from all relevant collections
    const materialTransactions = await MaterialTransaction.find(filter)
      .sort({ date: -1 })
      .lean();
    

    // Combine transactions into a single array
    const transactions = [
      ...materialTransactions.map((t) => ({ ...t, type: 'Material' })),
      
    ].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date

    // Fetch nominee details
    const nominee = await Nominee.findById(nomineeId);
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    res.status(200).json({
      transactions,
      nomineeName: nominee.name,
      nomineeType:nominee.type,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Error fetching transactions' });
  }
});
app.post('/login', (req, res) => {
  const { id, password } = req.body;
  
  // Debugging lines to check environment variable values
  console.log("Environment LOGIN_ID:", process.env.LOGIN_ID);
  console.log("Environment LOGIN_PASSWORD:", process.env.LOGIN_PASSWORD);

  if (id === process.env.LOGIN_ID && password === process.env.LOGIN_PASSWORD) {
    const token = jwt.sign({ id }, process.env.JWT_SECRET);
    return res.json({ success: true, token });
  } else {
    console.log("Unauthorized Access Attempt"); 
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// BUYER (Customer)
const buyerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  mobile: String,
  gst: String,
  pan: String,
  state: String,
  createdAt: { type: Date, default: Date.now }
});

// BILL
const billSchema = new mongoose.Schema({
  invoiceNo: String,
  invoiceDate: String,
  dueDate: String,

  buyer: {
    name: String,
    address: String,
    mobile: String,
    gst: String,
    pan: String,
    state: String
  },

  items: [
    {
      name: String,
      hsn: String,
      qty: Number,
      rate: Number,
      tax: Number,
      amount: Number
    }
  ],

  subtotal: Number,
  taxTotal: Number,
  total: Number,

  terms: String,

  createdAt: { type: Date, default: Date.now }
});

/* ==========================
   MODELS
========================== */
const Buyer = mongoose.model("Buyer", buyerSchema);
const Bill = mongoose.model("Bill", billSchema);

/* ==========================
   BUYER APIs
========================== */

// ADD BUYER
app.post("/api/buyers", async (req, res) => {
  try {
    const buyer = new Buyer(req.body);
    await buyer.save();
    res.json(buyer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SEARCH BUYER (for bill page)
app.get("/api/buyers/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    const buyers = await Buyer.find({
      name: { $regex: q, $options: "i" }
    }).limit(10);
    res.json(buyers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL BUYERS (optional)
app.get("/api/buyers", async (req, res) => {
  const buyers = await Buyer.find().sort({ createdAt: -1 });
  res.json(buyers);
});
app.get("/api/buyers/:id", async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) {
      return res.status(404).json({ error: "Buyer not found" });
    }
    res.json(buyer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE BUYER
app.put("/api/buyers/:id", async (req, res) => {
  try {
    const buyer = await Buyer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!buyer) {
      return res.status(404).json({ error: "Buyer not found" });
    }
    res.json(buyer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE BUYER
app.delete("/api/buyers/:id", async (req, res) => {
  try {
    const buyer = await Buyer.findByIdAndDelete(req.params.id);
    if (!buyer) {
      return res.status(404).json({ error: "Buyer not found" });
    }
    res.json({ message: "Buyer deleted successfully", buyer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ==========================
   BILL APIs
========================== */

// SAVE BILL
app.post("/api/bills", async (req, res) => {
  try {
    const bill = new Bill(req.body);
    await bill.save();
    res.json(bill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL BILLS
app.get("/api/bills", async (req, res) => {
  const bills = await Bill.find().sort({ createdAt: -1 });
  res.json(bills);
});

// GET SINGLE BILL (for edit)
app.get("/api/bills/:id", async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  res.json(bill);
});

// UPDATE BILL
app.put("/api/bills/:id", async (req, res) => {
  const bill = await Bill.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(bill);
});

// DELETE BILL
app.delete("/api/bills/:id", async (req, res) => {
  await Bill.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});



// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
