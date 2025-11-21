const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// --- Helper Functions for Data Access ---

const BOOKS_FILE = path.join(__dirname, 'data', 'books.json');
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');

// Helper to read data
const readData = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        throw new Error('Database error');
    }
};

// Helper to write data
const writeData = async (filePath, data) => {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        throw new Error('Database error');
    }
};

app.get('/', (req, res) => {
    res.send('Hello World!')
})

// --- BOOKS ENDPOINTS ---

// 1. GET /api/books/featured (Must be before :id)
app.get('/api/books/featured', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const featuredBooks = data.books.filter(book => book.featured === true);
        res.json(featuredBooks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. GET /api/books/search (Must be before :id)
// Usage: /api/books/search?q=quantum
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

// 3. GET /api/books (Get All)
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
        // 1. Read the latest data
        const data = await readData(BOOKS_FILE);

        // 2. Find the book matching the ID from the URL parameters
        // Note: We use req.params.id to access the :id value
        const book = data.books.find(b => b.id === req.params.id);

        // 3. Handle the case where the book doesn't exist
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // 4. Return the found book
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 5. POST /api/books (Add New with Auto-Increment ID)
app.post('/api/books', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);

        // --- NEW ID GENERATION LOGIC ---
        // 1. Convert all string IDs to numbers (e.g., "1" becomes 1)
        const ids = data.books.map(book => parseInt(book.id));

        // 2. Find the highest number (if array is empty, default to 0)
        const maxId = ids.length > 0 ? Math.max(...ids) : 0;

        // 3. Add 1 and convert back to string
        const nextId = (maxId + 1).toString();
        // -------------------------------

        const newBook = {
            id: nextId, // Use the calculated ID
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

// 6. PUT /api/books/:id (Update)
app.put('/api/books/:id', async (req, res) => {
    try {
        const data = await readData(BOOKS_FILE);
        const index = data.books.findIndex(b => b.id === req.params.id);

        if (index === -1) return res.status(404).json({ message: 'Book not found' });

        // Merge existing book with updates
        data.books[index] = { ...data.books[index], ...req.body };

        await writeData(BOOKS_FILE, data);
        res.json(data.books[index]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. DELETE /api/books/:id (Delete)
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

// --- REVIEWS ENDPOINTS ---

// 1. GET /api/reviews (Get All)
app.get('/api/reviews', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        res.json(data.reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. GET /api/reviews/book/:id (Get by Book ID)
app.get('/api/reviews/book/:id', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const bookReviews = data.reviews.filter(r => r.bookId === req.params.id);
        res.json(bookReviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. POST /api/reviews (Add New)
app.post('/api/reviews', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const newReview = {
            id: `review-${Date.now()}`,
            timestamp: new Date().toISOString(),
            verified: false, // Default for new reviews
            ...req.body
        };

        // Basic validation
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

// 4. PUT /api/reviews/:id (Update)
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

// 5. DELETE /api/reviews/:id (Delete)
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const data = await readData(REVIEWS_FILE);
        const initialLength = data.reviews.length;
        const filteredReviews = data.reviews.filter(r => r.id !== req.params.id);

        if (filteredReviews.length === initialLength) {
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