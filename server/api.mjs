import { sendJson, readJsonBody } from './http.mjs'

export function createApiHandler(store) {
  return async function handleApi(req, res, url, pathname) {
    const method = req.method || 'GET'

    if (pathname === '/api/data' && method === 'GET') {
      const result = store.load()
      if (!result.ok) return sendJson(res, 409, result), true
      return sendJson(res, 200, { ok: true, doc: result.doc, savedAt: result.savedAt }), true
    }

    if (pathname === '/api/data' && method === 'PUT') {
      const body = await readJsonBody(req)
      if (!body || typeof body !== 'object' || !body.doc) {
        return sendJson(res, 400, { ok: false, message: '缺少 doc 字段' }), true
      }
      try {
        const savedAt = store.write(body.doc)
        return sendJson(res, 200, { ok: true, savedAt }), true
      } catch (err) {
        const status = err.code === 'READONLY' ? 409 : 400
        return sendJson(res, status, { ok: false, code: err.code || 'INVALID', message: String(err.message || err) }), true
      }
    }

    if (pathname === '/api/backups' && method === 'GET') {
      return sendJson(res, 200, { ok: true, items: store.listBackups() }), true
    }

    if (pathname === '/api/backups/restore' && method === 'POST') {
      const body = await readJsonBody(req)
      try {
        const doc = store.restore(body?.file)
        return sendJson(res, 200, { ok: true, doc, savedAt: store.status().savedAt }), true
      } catch (err) {
        return sendJson(res, 400, { ok: false, message: String(err.message || err) }), true
      }
    }

    if (pathname === '/api/export' && method === 'GET') {
      const result = store.load()
      if (!result.ok) return sendJson(res, 409, result), true
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const buf = Buffer.from(JSON.stringify(result.doc, null, 2), 'utf8')
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': buf.length,
        'content-disposition': `attachment; filename="desk-${stamp}.json"; filename*=UTF-8''${encodeURIComponent(
          `工作生活台-${stamp}.json`,
        )}`,
        'cache-control': 'no-store',
      })
      res.end(buf)
      return true
    }

    if (pathname === '/api/import' && method === 'POST') {
      const body = await readJsonBody(req)
      const doc = body?.doc ?? body
      try {
        const { counts } = store.importDoc(doc)
        return sendJson(res, 200, { ok: true, counts, savedAt: store.status().savedAt }), true
      } catch (err) {
        return sendJson(res, 400, { ok: false, code: err.code || 'INVALID', message: String(err.message || err) }), true
      }
    }

    if (pathname === '/api/reset' && method === 'POST') {
      const body = await readJsonBody(req)
      if (body?.confirm !== '清空') {
        return sendJson(res, 400, { ok: false, message: '需要确认词「清空」' }), true
      }
      const doc = store.reset()
      return sendJson(res, 200, { ok: true, doc, savedAt: store.status().savedAt }), true
    }

    if (pathname === '/api/rebuild' && method === 'POST') {
      const body = await readJsonBody(req)
      if (body?.confirm !== true) {
        return sendJson(res, 400, { ok: false, message: '需要确认' }), true
      }
      const doc = store.rebuild()
      return sendJson(res, 200, { ok: true, doc, savedAt: store.status().savedAt }), true
    }

    return false
  }
}
