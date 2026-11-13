import path from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { createEmptyDoc, validateDoc, countEntries } from '../shared/schema.mjs'

const BACKUP_RE = /^app-\d{8}\.json$/

function pad(n) {
  return String(n).padStart(2, '0')
}

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

export function listBackups(backupDir) {
  if (!existsSync(backupDir)) return []
  return readdirSync(backupDir)
    .filter((f) => BACKUP_RE.test(f))
    .map((f) => {
      const st = statSync(path.join(backupDir, f))
      return { file: f, size: st.size, mtime: st.mtime.toISOString() }
    })
    .sort((a, b) => (a.file < b.file ? 1 : -1))
}

export function pruneBackups(backupDir, keep = 14) {
  const items = listBackups(backupDir)
  const removed = []
  for (const item of items.slice(keep)) {
    try {
      unlinkSync(path.join(backupDir, item.file))
      removed.push(item.file)
    } catch {
      /* 忽略单个清理失败 */
    }
  }
  return removed
}

export function createStore(dataDir) {
  const file = path.join(dataDir, 'app-data.json')
  const tmpFile = path.join(dataDir, 'app-data.json.tmp')
  const bakFile = path.join(dataDir, 'app-data.json.bak')
  const backupDir = path.join(dataDir, 'backups')

  let readOnly = false
  let lastError = ''
  let savedAt = null

  function ensureDirs() {
    mkdirSync(dataDir, { recursive: true })
    mkdirSync(backupDir, { recursive: true })
  }

  function readDocFrom(filePath) {
    const raw = readFileSync(filePath, 'utf8')
    const doc = JSON.parse(raw)
    const errors = validateDoc(doc)
    if (errors.length) throw new Error(errors.join('；'))
    return doc
  }

  function ensureDailyBackup() {
    if (!existsSync(file)) return null
    ensureDirs()
    const target = path.join(backupDir, `app-${dayKey()}.json`)
    if (existsSync(target)) return null
    copyFileSync(file, target)
    pruneBackups(backupDir, 14)
    return path.basename(target)
  }

  function load() {
    try {
      ensureDirs()
      if (!existsSync(file)) {
        const doc = createEmptyDoc()
        write(doc)
        return { ok: true, doc, savedAt }
      }
      const doc = readDocFrom(file)
      readOnly = false
      lastError = ''
      savedAt = statSync(file).mtime.toISOString()
      return { ok: true, doc, savedAt }
    } catch (err) {
      readOnly = true
      lastError = String(err && err.message ? err.message : err)
      return { ok: false, code: 'CORRUPT', message: lastError, backups: listBackups(backupDir) }
    }
  }

  function write(doc) {
    const errors = validateDoc(doc)
    if (errors.length) {
      const err = new Error(`数据结构不合法：${errors.join('；')}`)
      err.code = 'INVALID'
      throw err
    }
    if (readOnly) {
      const err = new Error('数据文件损坏，当前处于只读保护状态')
      err.code = 'READONLY'
      throw err
    }
    ensureDirs()
    ensureDailyBackup()
    writeFileSync(tmpFile, JSON.stringify(doc, null, 2), 'utf8')
    JSON.parse(readFileSync(tmpFile, 'utf8'))
    if (existsSync(file)) copyFileSync(file, bakFile)
    try {
      renameSync(tmpFile, file)
    } catch {
      try {
        unlinkSync(file)
      } catch {
        /* 目标不存在时忽略 */
      }
      renameSync(tmpFile, file)
    }
    savedAt = new Date().toISOString()
    return savedAt
  }

  function archiveCurrent(tag) {
    if (!existsSync(file)) return null
    const target = path.join(dataDir, `app-data.${tag}-${Date.now()}.json`)
    try {
      renameSync(file, target)
      return path.basename(target)
    } catch {
      return null
    }
  }

  function status() {
    return {
      ok: !readOnly,
      code: readOnly ? 'CORRUPT' : undefined,
      message: readOnly ? lastError : undefined,
      savedAt,
      backups: listBackups(backupDir),
    }
  }

  function restore(name) {
    if (!BACKUP_RE.test(String(name || ''))) throw new Error('备份文件名不合法')
    const source = path.join(backupDir, name)
    if (!existsSync(source)) throw new Error('备份不存在')
    const doc = readDocFrom(source)
    readOnly = false
    lastError = ''
    write(doc)
    return doc
  }

  function importDoc(doc) {
    const errors = validateDoc(doc)
    if (errors.length) {
      const err = new Error(`导入文件校验失败：${errors.join('；')}`)
      err.code = 'INVALID'
      throw err
    }
    if (existsSync(file)) archiveCurrent('pre-import')
    readOnly = false
    lastError = ''
    write(doc)
    return { counts: countEntries(doc) }
  }

  function reset() {
    const current = readOnly ? null : existsSync(file) ? readDocFrom(file) : null
    archiveCurrent('pre-reset')
    readOnly = false
    lastError = ''
    const doc = createEmptyDoc()
    if (current && current.settings) doc.settings = { ...doc.settings, ...current.settings }
    write(doc)
    return doc
  }

  function rebuild() {
    archiveCurrent('corrupt')
    readOnly = false
    lastError = ''
    const doc = createEmptyDoc()
    write(doc)
    return doc
  }

  return {
    file,
    backupDir,
    load,
    write,
    status,
    listBackups: () => listBackups(backupDir),
    restore,
    importDoc,
    reset,
    rebuild,
    ensureDailyBackup,
    get readOnly() {
      return readOnly
    },
  }
}
