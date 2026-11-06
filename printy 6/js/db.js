// Local project storage: IndexedDB with a localStorage fallback.
import { uid } from './util.js';
const DB = 'printy', STORE = 'projects';
let dbp = null, useLS = false;
const LSK = 'printy.projects.v1';

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('no idb'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
  dbp.catch(() => { useLS = true; });
  return dbp;
}
const lsAll = () => { try { return JSON.parse(localStorage.getItem(LSK) || '[]'); } catch { return []; } };
const lsSave = (a) => localStorage.setItem(LSK, JSON.stringify(a));

async function run(mode, fn) {
  if (!useLS) {
    try {
      const db = await open();
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, mode); const rq = fn(t.objectStore(STORE));
        t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    } catch (e) { if (!useLS) { useLS = true; } else throw e; }
  }
  return null;
}
export async function listProjects() {
  const r = await run('readonly', s => s.getAll());
  const a = useLS ? lsAll() : (r || []);
  return a.sort((x, y) => (y.opened || y.updated) - (x.opened || x.updated));
}
export async function getProject(id) {
  const r = await run('readonly', s => s.get(id));
  return useLS ? lsAll().find(p => p.id === id) : r;
}
export async function saveProject(p) {
  p.updated = Date.now();
  if (useLS || (await run('readwrite', s => s.put(p)), useLS)) {
    const a = lsAll().filter(x => x.id !== p.id); a.push(p);
    try { lsSave(a); } catch { throw new Error('Storage is full. Delete some projects and try again.'); }
  }
  return p;
}
export async function deleteProject(id) {
  await run('readwrite', s => s.delete(id));
  if (useLS) lsSave(lsAll().filter(p => p.id !== id));
}
export async function clearAll() {
  await run('readwrite', s => s.clear());
  try { localStorage.removeItem(LSK); } catch { /* ignore */ }
}
export async function duplicateProject(p, name) {
  const c = { ...p, id: uid(), name, created: Date.now(), opened: Date.now(), versions: [] };
  return saveProject(c);
}
export async function touchOpened(p) { p.opened = Date.now(); return saveProject(p); }
export const newProject = (name, w, h) => ({ id: uid(), name, w, h, created: Date.now(), updated: Date.now(), opened: Date.now(), json: null, thumb: '', versions: [] });
export const storageMode = () => (useLS ? 'localStorage' : 'IndexedDB');
