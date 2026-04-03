import fs from 'fs/promises';
import path from 'path';

// Define the schema
export interface StoryChapter {
  chapter_title: string;
  image_prompt: string;
  image_url: string;
  content: string;
  glossary: any[];
}

export type StoryStore = Record<string, StoryChapter[]>;

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'stories.json');

// Ensure database file exists
async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DB_FILE);
    } catch {
      await fs.writeFile(DB_FILE, '{}', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to initialize local DB:', error);
  }
}

// Read the whole store
async function readDb(): Promise<StoryStore> {
  await initDb();
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data) as StoryStore;
  } catch (error) {
    console.error('Error reading DB:', error);
    return {};
  }
}

// Write the whole store
async function writeDb(store: StoryStore): Promise<void> {
  await initDb();
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

export async function getStoryChapters(storyId: string): Promise<StoryChapter[]> {
  const store = await readDb();
  return store[storyId] || [];
}

export async function saveStoryChapter(storyId: string, newChapter: StoryChapter): Promise<void> {
  const store = await readDb();
  if (!store[storyId]) {
    store[storyId] = [];
  }
  store[storyId].push(newChapter);
  await writeDb(store);
}
