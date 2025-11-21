const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs'); // Standard fs for streams
const fsPromises = require('fs').promises; // Async fs for reading/writing data

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. LOGGING SETUP (New) ---

// Create a write stream (in append mode)
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'log.txt'), { flags: 'a' });

// Setup Morgan to log to file AND console
app.use(morgan('combined', { stream: accessLogStream })); // Writes to log.txt
app.use(morgan('dev')); // Writes to console

// Middleware to parse JSON bodies
app.use(express.json());

// --- 2. DATA HELPERS ---

const BOOKS_FILE = path.join(__dirname, 'data', 'books.json');
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');

const readData = async (filePath) => {
    try {
        const data = await fsPromises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        throw new Error('Database error');
    }
};

const writeData = async (filePath, data) => {
    try {
        await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        throw new Error('Database error');
    }
};

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// --- 3. BOOKS ENDPOINTS ---

// GET /api/books/featured
app.get('/api/books/featured', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const featuredBooks = data.books.filter(book => book.featured === true);
        res.json(featuredBooks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/books/search
app.get('/api/books/search', async (req, res) => {
    try {
        const query = req.query.q?.toLowerCase();
        if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });

        const data = await readData(BOOKS_FILE);
        const results = data.books.filter(book =>
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query) ||
            book.tags.some(tag => tag.toLowerCase().includes(query))
        );
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/books
app.get('/api/books', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        res.json(data.books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/books/:id
app.get('/api/books/:id', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const book = data.books.find(b => b.id === req.params.id);

        if (!book) return res.status(404).json({ message: 'Book not found' });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/books (With Auto-Increment)
app.post('/api/books', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);

        // Auto-increment Logic
        const ids = data.books.map(book => parseInt(book.id));
        const maxId = ids.length > 0 ? Math.max(...ids) : 0;
        const nextId = (maxId + 1).toString();

        const newBook = {
            id: nextId,
            ...req.body,
            datePublished: req.body.datePublished || new Date().toISOString().split('T')[0]
        };

        data.books.push(newBook);
        await writeData(BOOKS_FILE, data);

        res.status(201).json(newBook);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/books/:id
app.put('/api/books/:id', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const index = data.books.findIndex(b => b.id === req.params.id);

        if (index === -1) return res.status(404).json({ message: 'Book not found' });

        data.books[index] = {
            ...data.books[index],
            ...req.body,
            id: req.params.id // Prevent ID modification
        };

        await writeData(BOOKS_FILE, data);
        res.json(data.books[index]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/books/:id
app.delete('/api/books/:id', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const initialLength = data.books.length;
        const filteredBooks = data.books.filter(b => b.id !== req.params.id);

        if (filteredBooks.length === initialLength) {
            return res.status(404).json({ message: 'Book not found' });
        }

        data.books = filteredBooks;
        await writeData(BOOKS_FILE, data);
        res.json({ message: 'Book deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. REVIEWS ENDPOINTS ---

// GET /api/reviews
app.get('/api/reviews', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        res.json(data.reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reviews/book/:id
app.get('/api/reviews/book/:id', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const bookReviews = data.reviews.filter(r => r.bookId === req.params.id);
        res.json(bookReviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reviews
app.post('/api/reviews', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const newReview = {
            id: `review-${Date.now()}`,
            timestamp: new Date().toISOString(),
            verified: false,
            ...req.body
        };

        if (!newReview.bookId || !newReview.rating) {
            return res.status(400).json({ message: 'bookId and rating are required' });
        }

        data.reviews.push(newReview);
        await writeData(REVIEWS_FILE, data);
        res.status(201).json(newReview);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/reviews/:id
app.put('/api/reviews/:id', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const index = data.reviews.findIndex(r => r.id === req.params.id);

        if (index === -1) return res.status(404).json({ message: 'Review not found' });

        data.reviews[index] = { ...data.reviews[index], ...req.body };

        await writeData(REVIEWS_FILE, data);
        res.json(data.reviews[index]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/reviews/:id
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const filteredReviews = data.reviews.filter(r => r.id !== req.params.id);

        if (filteredReviews.length === data.reviews.length) {
            return res.status(404).json({ message: 'Review not found' });
        }

        data.reviews = filteredReviews;
        await writeData(REVIEWS_FILE, data);
        res.json({ message: 'Review deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Amana Bookstore API running on http://localhost:${PORT}`);
});