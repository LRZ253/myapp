// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import { createAppServer } from '../server/index.mjs'

let dir = ''
let server: Server
let base = ''

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'desk-p0-'))
  mkdirSync(path.join(dir, 'dist'), { recursive: true })
  writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html><title>工作台</title>')
  writeFileSync(path.join(dir, 'dist', 'app.js'), 'console.log(1)')

  server = createAppServer({ root: dir }) as Server
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('未取得端口')
  base = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(dir, { recursive: true, force: true })
})

describe('本地服务骨架', () => {
  it('健康检查返回 ok 与版本号', async () => {
    const res = await fetch(`${base}/api/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.version).toBeTruthy()
  })

  it('根路径返回首页 HTML', async () => {
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('工作台')
  })

  it('无扩展名路径回退到 index.html，支持前端路由', async () => {
    const res = await fetch(`${base}/consult/followups`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('工作台')
  })

  it('静态资源按扩展名返回正确的 content-type', async () => {
    const res = await fetch(`${base}/app.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
  })

  it('缺失的带扩展名文件返回 404', async () => {
    const res = await fetch(`${base}/nope.css`)
    expect(res.status).toBe(404)
  })

  it('未知接口返回 JSON 404 而不是首页', async () => {
    const res = await fetch(`${base}/api/nothing`)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('拒绝路径穿越，不返回 200', async () => {
    const res = await fetch(`${base}/%2e%2e%2f%2e%2e%2fetc%2fpasswd`)
    expect([403, 404]).toContain(res.status)
  })
})
