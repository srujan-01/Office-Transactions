const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database setup
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'transactions.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      running_balance REAL NOT NULL
    )
  `);
});

const calculateRunningBalance = (type, amount, lastBalance) => {
  if (type === 'credit') {
    return lastBalance + amount;
  } else if (type === 'debit') {
    return lastBalance - amount;
  }
  return lastBalance;
};

// API Endpoints
app.get('/transactions', (req, res) => {
  db.all('SELECT * FROM transactions', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});



app.post('/transactions', (req, res) => {
  const { type, amount, description, date } = req.body;

  // Get the last running balance
  db.get(`SELECT running_balance FROM transactions ORDER BY date DESC LIMIT 1`, [], (err, row) => {
    if (err) {
      return res.status(500).send(err.message);
    }

    const lastBalance = row ? row.running_balance : 0;
    const runningBalance = calculateRunningBalance(type, amount, lastBalance);

    db.run(`INSERT INTO transactions (type, amount, description, date, running_balance) VALUES (?, ?, ?, ?, ?)`, [type, amount, description, date, runningBalance], function(err) {
      if (err) {
        return res.status(500).send(err.message);
      }
      res.status(201).send({ id: this.lastID });
    });
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
