"use client";

import Dexie, { type Table } from "dexie";

export interface UserHighlight {
  id?: number;
  verse_id: string;
  start_offset: number;
  end_offset: number;
  color: string;
  date: string;
}

export interface UserNote {
  id?: number;
  verse_id: string;
  content_html: string;
  tags: string[];
  updated_at: string;
}

class UserDatabase extends Dexie {
  highlights!: Table<UserHighlight, number>;
  user_notes!: Table<UserNote, number>;

  constructor() {
    super("alethia-bridge-user");
    this.version(1).stores({
      highlights: "++id, verse_id, color, date",
      user_notes: "++id, verse_id, updated_at, *tags",
    });
  }
}

export const userDb = new UserDatabase();

export async function addHighlight(h: Omit<UserHighlight, "id">): Promise<number> {
  return userDb.highlights.add(h);
}

export async function addNote(n: Omit<UserNote, "id">): Promise<number> {
  return userDb.user_notes.add(n);
}

export async function notesForVerse(verseId: string): Promise<UserNote[]> {
  return userDb.user_notes.where("verse_id").equals(verseId).toArray();
}

export async function highlightsForVerse(verseId: string): Promise<UserHighlight[]> {
  return userDb.highlights.where("verse_id").equals(verseId).toArray();
}
