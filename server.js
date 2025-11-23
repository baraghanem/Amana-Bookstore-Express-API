const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. MIDDLEWARE ---

// Logging
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'log.txt'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

// JSON Parsing
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Bookstore API!')
})

// --- BONUS CHALLENGE: AUTHENTICATION MIDDLEWARE ---
// This function acts as a guard. We will apply it ONLY to POST/PUT/DELETE routes.
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key']; // Look for this specific header

    if (apiKey === 'admin123') {
        next(); // Password matches! Proceed to the route.
    } else {
        res.status(403).json({ message: 'Forbidden: You must provide a valid x-api-key header.' });
    }
};

// --- 2. DATA HELPERS ---
const BOOKS_FILE = path.join(__dirname, 'data', 'books.json');
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');

const readData = async (filePath) => {
    try {
        const data = await fsPromises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        throw new Error('Database error');
    }
};

const writeData = async (filePath, data) => {
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
};

// --- 3. BOOK ROUTES ---

// A. Top 10 Rated Books (Rating * ReviewCount)
// *Must come before /:id*
app.get('/api/books/top-rated', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const sortedBooks = data.books
            .map(book => ({
                ...book,
                score: (book.rating || 0) * (book.reviewCount || 0) // Calculate score
            }))
            .sort((a, b) => b.score - a.score) // Sort High to Low
            .slice(0, 10); // Take top 10

        res.json(sortedBooks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// B. Featured Books
app.get('/api/books/featured', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const featuredBooks = data.books.filter(book => book.featured === true);
        res.json(featuredBooks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// C. Date Range Search
// Usage: /api/books/date-range?start=2022-01-01&end=2023-12-31
app.get('/api/books/date-range', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ message: "Please provide start and end dates (YYYY-MM-DD)" });

        const data = await readData(BOOKS_FILE);
        const startDate = new Date(start);
        const endDate = new Date(end);

        const filteredBooks = data.books.filter(book => {
            const pubDate = new Date(book.datePublished);
            return pubDate >= startDate && pubDate <= endDate;
        });

        res.json(filteredBooks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// D. Search Books (General)
app.get('/api/books/search', async (req, res) => {
    try {
        const query = req.query.q?.toLowerCase();
        if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });
        const data = await readData(BOOKS_FILE);
        const results = data.books.filter(book =>
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query)
        );
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// E. Get All Books
app.get('/api/books', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        res.json(data.books);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// F. Get Single Book by ID
app.get('/api/books/:id', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const book = data.books.find(b => b.id === req.params.id);
        if (!book) return res.status(404).json({ message: 'Book not found' });
        res.json(book);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// G. POST New Book (SECURED with 'authenticate')
app.post('/api/books', authenticate, async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        // Auto-increment ID
        const ids = data.books.map(b => parseInt(b.id));
        const nextId = (ids.length > 0 ? Math.max(...ids) : 0) + 1;

        const newBook = { id: nextId.toString(), ...req.body };
        data.books.push(newBook);
        await writeData(BOOKS_FILE, data);
        res.status(201).json(newBook);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 4. REVIEW ROUTES ---

// H. Get Reviews for a specific Book ID
app.get('/api/reviews/book/:id', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        // Filter reviews where bookId matches the URL parameter
        const bookReviews = data.reviews.filter(r => r.bookId === req.params.id);
        res.json(bookReviews);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// I. POST New Review (SECURED with 'authenticate')
app.post('/api/reviews', authenticate, async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const newReview = {
            id: `review-${Date.now()}`,
            timestamp: new Date().toISOString(),
            verified: false,
            ...req.body
        };
        data.reviews.push(newReview);
        await writeData(REVIEWS_FILE, data);
        res.status(201).json(newReview);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Amana Bookstore API running on http://localhost:${PORT}`);
});