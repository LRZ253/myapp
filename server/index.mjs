import http from 'node:http'
import path from 'node:path'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exec } from 'node:child_process'
import { sendJson } from './http.mjs'
import { createStore } from './store.mjs'
import { createApiHandler } from './api.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const PORT = Number(process.env.PORT || 4173)
const HOST = '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-store' : 'no-cache',
  })
  createReadStream(file).pipe(res)
}

function serveStatic(res, dist, pathname) {
  const target = path.resolve(dist, '.' + pathname)
  const inside = target === dist || target.startsWith(dist + path.sep)
  if (!inside) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('禁止访问')
  }
  if (existsSync(target) && statSync(target).isFile()) return sendFile(res, target)

  const indexFile = path.join(dist, 'index.html')
  if (!path.extname(pathname) && existsSync(indexFile)) return sendFile(res, indexFile)

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('未找到')
}

export function createAppServer(options = {}) {
  const root = options.root || ROOT
  const dist = path.join(root, 'dist')
  const handleApi = options.handleApi

  return http.createServer(async (req, res) => {
    let url
    try {
      url = new URL(req.url || '/', 'http://127.0.0.1')
    } catch {
      res.writeHead(400).end()
      return
    }
    let pathname = url.pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      pathname = url.pathname
    }

    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/health') return sendJson(res, 200, { ok: true, version: '1.0.0' })
      if (handleApi) {
        try {
          const handled = await handleApi(req, res, url, pathname)
          if (handled !== false) return
        } catch (err) {
          if (!res.headersSent) sendJson(res, 500, { ok: false, message: String(err?.message || err) })
          return
        }
      }
      return sendJson(res, 404, { ok: false, message: '接口不存在' })
    }

    return serveStatic(res, dist, pathname)
  })
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd, () => {})
}

export function start(options = {}) {
  const port = options.port || PORT
  const root = options.root || ROOT
  const store = options.store || createStore(path.join(root, 'data'))
  const server = createAppServer({ root, handleApi: createApiHandler(store) })

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const url = `http://${HOST}:${port}`
      console.log(`工作台已经在运行：${url}`)
      if (!process.argv.includes('--no-open')) openBrowser(url)
      process.exit(0)
    }
    console.error('启动失败：', err)
    process.exit(1)
  })

  server.listen(port, HOST, () => {
    const url = `http://${HOST}:${port}`
    console.log(`工作台已启动：${url}`)
    console.log(`数据文件：${store.file}`)
    if (!process.argv.includes('--no-open')) openBrowser(url)
  })

  return server
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) start()
