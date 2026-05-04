const TelegramBot = require('node-telegram-bot-api')
const { getAllSnippets, saveIndex, getFile, pushFile, deleteFile } = require('./github')

const TOKEN = process.env.TELEGRAM_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

let bot = null

function initBot() {
  if (!TOKEN) return null
  bot = new TelegramBot(TOKEN, { polling: false })
  setupCommands()
  return bot
}

function sendLog(text) {
  if (!bot || !CHAT_ID) return
  bot.sendMessage(CHAT_ID, text, { parse_mode: 'HTML' }).catch(() => {})
}

function setupCommands() {
  // Webhook handler dipanggil dari express route
}

async function handleUpdate(update) {
  if (!update.message) return
  const msg = update.message
  const chatId = msg.chat.id.toString()
  const text = msg.text || ''

  // Hanya owner yang bisa akses
  if (chatId !== CHAT_ID) {
    return bot.sendMessage(chatId, '❌ Kamu tidak punya akses!')
  }

  const args = text.trim().split(/\s+/)
  const cmd = args[0]

  // /list — list semua snippet
  if (cmd === '/list') {
    const snippets = await getAllSnippets()
    if (!snippets.length) return bot.sendMessage(chatId, '📭 Belum ada snippet.')
    const list = snippets.map((s, i) =>
      `${i + 1}. <code>${s.id}</code> — <b>${s.name}</b>\n   📁 ${s.category} | 🔒 ${s.protected ? 'Protected' : 'Public'}`
    ).join('\n\n')
    return bot.sendMessage(chatId, `📦 <b>Daftar Snippets (${snippets.length})</b>\n\n${list}`, { parse_mode: 'HTML' })
  }

  // /get <id> — lihat detail snippet
  if (cmd === '/get') {
    const id = args[1]
    if (!id) return bot.sendMessage(chatId, '❌ Format: /get <id>')
    const snippets = await getAllSnippets()
    const snippet = snippets.find(s => s.id === id)
    if (!snippet) return bot.sendMessage(chatId, `❌ Snippet <code>${id}</code> tidak ditemukan.`, { parse_mode: 'HTML' })
    const file = await getFile(`data/snippets/${id}.js`)
    const code = file ? Buffer.from(file.content, 'base64').toString('utf-8') : '-'
    return bot.sendMessage(chatId,
      `📄 <b>${snippet.name}</b>\n\n` +
      `🆔 ID: <code>${snippet.id}</code>\n` +
      `👤 Author: ${snippet.author}\n` +
      `📁 Category: ${snippet.category}\n` +
      `🔒 Protected: ${snippet.protected ? 'Ya' : 'Tidak'}\n` +
      `📅 Date: ${snippet.date}\n\n` +
      `<pre>${code.slice(0, 3000)}</pre>`,
      { parse_mode: 'HTML' }
    )
  }

  // /del <id> — hapus snippet
  if (cmd === '/del') {
    const id = args[1]
    if (!id) return bot.sendMessage(chatId, '❌ Format: /del <id>')
    const snippets = await getAllSnippets()
    const idx = snippets.findIndex(s => s.id === id)
    if (idx === -1) return bot.sendMessage(chatId, `❌ Snippet <code>${id}</code> tidak ditemukan.`, { parse_mode: 'HTML' })

    const file = await getFile(`data/snippets/${id}.js`)
    if (file) await deleteFile(`data/snippets/${id}.js`, `🗑️ delete: ${id}`, file.sha)

    snippets.splice(idx, 1)
    await saveIndex(snippets)

    sendLog(`🗑️ <b>Snippet Dihapus</b>\nID: <code>${id}</code>`)
    return bot.sendMessage(chatId, `✅ Snippet <code>${id}</code> berhasil dihapus!`, { parse_mode: 'HTML' })
  }

  // /add — tambah snippet (kirim file .js)
  if (cmd === '/add') {
    return bot.sendMessage(chatId,
      `📤 <b>Cara tambah snippet:</b>\n\n` +
      `Kirim file .js dengan caption format:\n` +
      `<code>nama|kategori|author|protected(true/false)|password(opsional)</code>\n\n` +
      `Contoh caption:\n` +
      `<code>genius.js|Tools|Nimzz|false</code>\n` +
      `<code>secret.js|AI|Nimzz|true|password123</code>\n\n` +
      `Kategori: Tools, AI, Canvas, Downloader, Scraper, Anime, Utils`,
      { parse_mode: 'HTML' }
    )
  }

  // Handle file upload untuk add snippet
  if (update.message?.document) {
    return handleFileUpload(update.message)
  }

  // /help
  return bot.sendMessage(chatId,
    `🤖 <b>Nimzz Snippets Bot</b>\n\n` +
    `/list — Lihat semua snippet\n` +
    `/get &lt;id&gt; — Detail snippet\n` +
    `/add — Cara tambah snippet\n` +
    `/del &lt;id&gt; — Hapus snippet`,
    { parse_mode: 'HTML' }
  )
}

async function handleFileUpload(msg) {
  const chatId = msg.chat.id.toString()
  const doc = msg.document
  const caption = msg.caption || ''

  if (!doc.file_name.endsWith('.js')) {
    return bot.sendMessage(chatId, '❌ Hanya file .js yang diterima!')
  }

  const parts = caption.split('|')
  if (parts.length < 4) {
    return bot.sendMessage(chatId, '❌ Caption tidak valid!\nFormat: nama|kategori|author|protected|password(opsional)')
  }

  const [name, category, author, isProtected, password] = parts
  const id = name.replace('.js', '').toLowerCase().replace(/[^a-z0-9]/g, '-')
  const date = new Date().toISOString().split('T')[0]

  // Download file dari Telegram
  const fileLink = await bot.getFileLink(doc.file_id)
  const { data: code } = await require('axios').get(fileLink)

  // Push file ke GitHub
  const existingFile = await getFile(`data/snippets/${id}.js`)
  await pushFile(
    `data/snippets/${id}.js`,
    typeof code === 'string' ? code : JSON.stringify(code),
    `✨ add: snippet ${id}`,
    existingFile?.sha || null
  )

  // Update index
  const snippets = await getAllSnippets()
  const existing = snippets.findIndex(s => s.id === id)
  const snippet = {
    id,
    name,
    category: category.trim(),
    author: author.trim(),
    language: 'Javascript',
    date,
    protected: isProtected.trim() === 'true',
    password: isProtected.trim() === 'true' ? (password?.trim() || '') : null
  }

  if (existing !== -1) snippets[existing] = snippet
  else snippets.unshift(snippet)

  await saveIndex(snippets)

  sendLog(`✨ <b>Snippet Ditambah</b>\nID: <code>${id}</code>\nNama: ${name}\nKategori: ${category}`)
  return bot.sendMessage(chatId, `✅ Snippet <b>${name}</b> berhasil ditambahkan!\nID: <code>${id}</code>`, { parse_mode: 'HTML' })
}

module.exports = { initBot, handleUpdate, sendLog }
