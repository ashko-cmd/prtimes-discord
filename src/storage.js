import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const NOTIFIED_FILE = path.join(DATA_DIR, 'notified.json');
const CACHE_FILE = path.join(DATA_DIR, 'http-cache.json');
const INSPECTED_FILE = path.join(DATA_DIR, 'inspected.json');
const SNAPSHOT_FILES = {
  'news-sitemap': path.join(DATA_DIR, 'last-good-news-sitemap.xml'),
  rss: path.join(DATA_DIR, 'last-good-rss.xml'),
};

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`${file} の読み込みに失敗しました: ${error.message}`, { cause: error });
  }
}

async function writeJsonAtomic(file, value) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

export const loadNotified = async () => new Set(await readJson(NOTIFIED_FILE, []));
export const saveNotified = async (set) => writeJsonAtomic(NOTIFIED_FILE, [...set]);
export const loadHttpCache = async () => readJson(CACHE_FILE, {});
export const saveHttpCache = async (cache) => writeJsonAtomic(CACHE_FILE, cache);
export const loadInspected = async () => new Set(await readJson(INSPECTED_FILE, []));
export const saveInspected = async (set) => writeJsonAtomic(INSPECTED_FILE, [...set]);

export async function loadSnapshot(sourceName) {
  const file = SNAPSHOT_FILES[sourceName];
  if (!file) return null;
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveSnapshot(sourceName, xml) {
  const file = SNAPSHOT_FILES[sourceName];
  if (!file) return;
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, xml, 'utf8');
  await rename(temporary, file);
}
