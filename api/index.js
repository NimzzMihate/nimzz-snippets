require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { getAllSnippets, getFile } = require('./github')
const { initBot, handleUpdate } = require('./bot')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// Init Telegram bot
const bot = initBot()

// ========== TELEGRAM WEBHOOK ==========
app.post(`/webhook/${process.env.TELEGRAM_TOKEN}`, async (req, res) => {
  res.sendStatus(200)
  await handleUpdate(req.body)
})

// ========== API ROUTES ==========

// GET semua snippets
app.get('/api/snippets', async (req, res) => {
  try {
    const snippets = await getAllSnippets()
    const { category, search, q } = req.query
    let result = snippets

    if (category && category !== 'All') {
      result = result.filter(s => s.category.toLowerCase() === category.toLowerCase())
    }

    const keyword = search || q
    if (keyword) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(keyword.toLowerCase()) ||
        s.category.toLowerCase().includes(keyword.toLowerCase()) ||
        s.author.toLowerCase().includes(keyword.toLowerCase())
      )
    }

    res.json({ status: true, total: result.length, data: result })
  } catch (e) {
    res.status(500).json({ status: false, error: e.message })
  }
})

// GET detail snippet + code
app.get('/api/snippets/:id', async (req, res) => {
  try {
    const snippets = await getAllSnippets()
    const snippet = snippets.find(s => s.id === req.params.id)
    if (!snippet) return res.status(404).json({ status: false, error: 'Snippet tidak ditemukan' })

    const file = await getFile(`data/snippets/${snippet.id}.js`)
    const code = file ? Buffer.from(file.content, 'base64').toString('utf-8') : null

    // Kalau protected, jangan kasih code dulu
    if (snippet.protected) {
      return res.json({ status: true, data: { ...snippet, code: null, locked: true } })
    }

    res.json({ status: true, data: { ...snippet, code, locked: false } })
  } catch (e) {
    res.status(500).json({ status: false, error: e.message })
  }
})

// POST unlock snippet
app.post('/api/snippets/:id/unlock', async (req, res) => {
  try {
    const snippets = await getAllSnippets()
    const snippet = snippets.find(s => s.id === req.params.id)
    if (!snippet) return res.status(404).json({ status: false, error: 'Snippet tidak ditemukan' })
    if (!snippet.protected) return res.json({ status: true, message: 'Snippet tidak terkunci' })

    const { password } = req.body
    if (password !== snippet.password) {
      return res.status(401).json({ status: false, error: 'Password salah!' })
    }

    const file = await getFile(`data/snippets/${snippet.id}.js`)
    const code = file ? Buffer.from(file.content, 'base64').toString('utf-8') : null

    res.json({ status: true, data: { ...snippet, code, locked: false } })
  } catch (e) {
    res.status(500).json({ status: false, error: e.message })
  }
})

// GET kategori
app.get('/api/categories', async (req, res) => {
  try {
    const snippets = await getAllSnippets()
    const cats = ['All', ...new Set(snippets.map(s => s.category))]
    res.json({ status: true, data: cats })
  } catch (e) {
    res.status(500).json({ status: false, error: e.message })
  }
})

// ========== PAGE ROUTES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')))
app.get('/explore', (req, res) => res.sendFile(path.join(__dirname, '../public/explore.html')))
app.get('/snippet/:id', (req, res) => res.sendFile(path.join(__dirname, '../public/detail.html')))

app.listen(PORT, () => {
  console.log(`\x1b[32m🚀 Nimzz Snippets running on port ${PORT}\x1b[0m`)
})

module.exports = app
