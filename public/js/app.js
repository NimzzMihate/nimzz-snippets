function openSidebar() {
  document.getElementById('sidebar').classList.add('open')
  document.getElementById('overlay').classList.add('open')
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('overlay').classList.remove('open')
}

async function loadRecent() {
  const grid = document.getElementById('recentGrid')
  if (!grid) return
  try {
    const res = await fetch('/api/snippets')
    const { data, total } = await res.json()
    const cats = [...new Set(data.map(s => s.category))].length
    document.getElementById('totalSnippets').textContent = total
    document.getElementById('totalCats').textContent = cats
    const recent = data.slice(0, 6)
    if (!recent.length) { grid.innerHTML = '<p class="empty">Belum ada snippet.</p>'; return }
    grid.innerHTML = recent.map(s => `
      <a href="/detail.html?id=${s.id}" class="snippet-card">
        <div class="card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
        <div class="card-name">${s.name}</div>
        <div class="card-meta">
          <span class="tag tag-lang">${s.language}</span>
          <span class="tag tag-cat">${s.category}</span>
          ${s.protected ? '<span class="tag tag-lock">🔒 Protected</span>' : ''}
        </div>
        <span class="card-arrow">→</span>
      </a>`).join('')
  } catch { grid.innerHTML = '<p class="empty">Gagal memuat snippets.</p>' }
}

loadRecent()
