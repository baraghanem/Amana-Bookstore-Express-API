const fs = require('fs')
const path = require('path')
const morgan = require('morgan')

// Create log file stream for Morgan
const requestLogPath = path.join(__dirname, 'request-log.txt')
const requestLogStream = fs.createWriteStream(requestLogPath, { flags: 'a' })

// Configure Morgan middleware with combined format
const requestLogger = morgan('combined', { stream: requestLogStream })

module.exports = requestLogger
        const { q, genre, featured, inStock } = req.query;