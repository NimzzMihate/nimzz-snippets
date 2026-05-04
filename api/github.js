const axios = require('axios')

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const BASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents`

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github.v3+json'
}

async function getFile(path) {
  try {
    const { data } = await axios.get(`${BASE_URL}/${path}`, { headers })
    return data
  } catch {
    return null
  }
}

async function pushFile(path, content, message, sha = null) {
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: GITHUB_BRANCH
  }
  if (sha) body.sha = sha
  const { data } = await axios.put(`${BASE_URL}/${path}`, body, { headers })
  return data
}

async function deleteFile(path, message, sha) {
  const { data } = await axios.delete(`${BASE_URL}/${path}`, {
    headers,
    data: { message, sha, branch: GITHUB_BRANCH }
  })
  return data
}

async function listFiles(dir) {
  try {
    const { data } = await axios.get(`${BASE_URL}/${dir}`, { headers })
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function getAllSnippets() {
  const indexFile = await getFile('data/index.json')
  if (!indexFile) return []
  const content = Buffer.from(indexFile.content, 'base64').toString('utf-8')
  return JSON.parse(content)
}

async function saveIndex(snippets) {
  const indexFile = await getFile('data/index.json')
  return pushFile(
    'data/index.json',
    JSON.stringify(snippets, null, 2),
    '📦 update: snippet index',
    indexFile?.sha || null
  )
}

module.exports = { getFile, pushFile, deleteFile, listFiles, getAllSnippets, saveIndex }

