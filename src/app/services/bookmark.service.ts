import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

export type BookmarkType = 'cafe' | 'homestay';

export interface UserBookmark {
  placeId: string;
  appId?: number;
  name: string;
  type: BookmarkType;
  location: string;
  rating: number;
  lat: number;
  lng: number;
  image: string;
  googlePlaceResourceName?: string;
  savedAtMillis: number;
}

interface BookmarkPayload {
  placeId: string;
  appId?: number;
  name: string;
  type: BookmarkType;
  location: string;
  rating: number;
  lat: number;
  lng: number;
  image: string;
  googlePlaceResourceName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BookmarkService {
  private readonly db: Firestore = getFirestore();
  private readonly cacheKeyPrefix = 'user-bookmarks-cache:';

  watchUserBookmarks(uid: string, onChange: (bookmarks: UserBookmark[]) => void): () => void {
    const bookmarksRef = collection(this.db, 'users', uid, 'bookmarks');

    const unsubscribe = onSnapshot(
      bookmarksRef,
      (snapshot) => {
        const mapped = this.mapBookmarks(
          snapshot.docs.map((item) => ({
            ...(item.data() as Record<string, unknown>),
            __docId: item.id,
          }))
        );
        this.saveCache(uid, mapped);
        onChange(mapped);
      },
      (error) => {
        console.warn('watchUserBookmarks error:', error);
        onChange(this.getCache(uid));
      }
    );

    return unsubscribe;
  }

  async getUserBookmarks(uid: string): Promise<UserBookmark[]> {
    const cachedBookmarks = this.getCache(uid);

    try {
      const bookmarksRef = collection(this.db, 'users', uid, 'bookmarks');
      const snapshot = await getDocs(bookmarksRef);
      const mapped = this.mapBookmarks(
        snapshot.docs.map((item) => ({
          ...(item.data() as Record<string, unknown>),
          __docId: item.id,
        }))
      );
      this.saveCache(uid, mapped);
      return mapped;
    } catch {
      return cachedBookmarks;
    }
  }

  async isBookmarked(uid: string, type: BookmarkType, placeId: string | number): Promise<boolean> {
    const normalizedPlaceId = this.normalizePlaceId(placeId);
    if (!normalizedPlaceId) {
      return false;
    }

    try {
      const bookmarkRef = doc(this.db, 'users', uid, 'bookmarks', this.buildBookmarkDocId(type, normalizedPlaceId));
      const snapshot = await getDoc(bookmarkRef);
      if (snapshot.exists()) {
        return true;
      }
    } catch {
      // Fallback to local cache below.
    }

    return this.getCache(uid).some((item) => item.type === type && item.placeId === normalizedPlaceId);
  }

  async saveUserBookmark(uid: string, payload: BookmarkPayload): Promise<void> {
    const placeId = this.normalizePlaceId(payload.placeId);
    if (!placeId) {
      return;
    }

    const cached = this.getCache(uid);
    const nextItem: UserBookmark = {
      placeId,
      appId: payload.appId,
      name: payload.name,
      type: payload.type,
      location: payload.location,
      rating: payload.rating,
      lat: payload.lat,
      lng: payload.lng,
      image: payload.image,
      googlePlaceResourceName: payload.googlePlaceResourceName,
      savedAtMillis: Date.now(),
    };

    const merged = [nextItem, ...cached.filter((item) => !(item.type === nextItem.type && item.placeId === nextItem.placeId))];
    this.saveCache(uid, merged);

    try {
      const bookmarkRef = doc(this.db, 'users', uid, 'bookmarks', this.buildBookmarkDocId(payload.type, placeId));
      await setDoc(
        bookmarkRef,
        {
          ...payload,
          placeId,
          savedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      this.saveCache(uid, cached);
      console.warn('saveUserBookmark error:', error);
      throw error;
    }
  }

  async removeUserBookmark(uid: string, type: BookmarkType, placeId: string | number): Promise<void> {
    const normalizedPlaceId = this.normalizePlaceId(placeId);
    if (!normalizedPlaceId) {
      return;
    }

    const next = this.getCache(uid).filter((item) => !(item.type === type && item.placeId === normalizedPlaceId));
    const previous = this.getCache(uid);
    this.saveCache(uid, next);

    try {
      const bookmarkRef = doc(this.db, 'users', uid, 'bookmarks', this.buildBookmarkDocId(type, normalizedPlaceId));
      await deleteDoc(bookmarkRef);
    } catch (error) {
      this.saveCache(uid, previous);
      console.warn('removeUserBookmark error:', error);
      throw error;
    }
  }

  private getCache(uid: string): UserBookmark[] {
    if (!uid) {
      return [];
    }

    try {
      const raw = localStorage.getItem(`${this.cacheKeyPrefix}${uid}`);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return this.mapBookmarks(parsed as Array<Record<string, unknown>>);
    } catch {
      return [];
    }
  }

  private saveCache(uid: string, bookmarks: UserBookmark[]): void {
    if (!uid) {
      return;
    }

    try {
      localStorage.setItem(`${this.cacheKeyPrefix}${uid}`, JSON.stringify(bookmarks));
    } catch {
      // Ignore local storage restrictions.
    }
  }

  private mapBookmarks(items: Array<Record<string, unknown>>): UserBookmark[] {
    const mapped: UserBookmark[] = [];

    for (const item of items) {
      const docId = this.parseString(item['__docId'], '');
      const placeId =
        this.normalizePlaceId(item['placeId']) ||
        this.normalizePlaceId(item['id']) ||
        this.normalizePlaceId(item['appId']) ||
        this.extractPlaceIdFromDocId(docId) ||
        docId;
      if (!placeId) {
        continue;
      }

      mapped.push({
        placeId,
        appId: this.parseOptionalNumber(item['appId']),
        name: this.parseString(item['name'], 'Địa điểm yêu thích'),
        type: this.parseType(item['type'], docId),
        location: this.parseString(item['location'], this.parseString(item['address'], 'Đà Lạt')),
        rating: this.parseNumber(item['rating'], 0),
        lat: this.parseNumber(item['lat'], 11.9404),
        lng: this.parseNumber(item['lng'], 108.4583),
        image: this.parseString(item['image'], this.parseString(item['heroImage'], 'assets/images/login.jpg')),
        googlePlaceResourceName: this.parseString(item['googlePlaceResourceName'], ''),
        savedAtMillis: this.parseSavedAt(item['savedAt']),
      });
    }

    return mapped.sort((a, b) => b.savedAtMillis - a.savedAtMillis);
  }

  private parseSavedAt(value: unknown): number {
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const toDate = (value as { toDate?: () => Date }).toDate;
      if (typeof toDate === 'function') {
        const date = toDate();
        const time = date.getTime();
        if (!Number.isNaN(time)) {
          return time;
        }
      }
    }

    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      const seconds = (value as { seconds?: unknown }).seconds;
      if (typeof seconds === 'number' && Number.isFinite(seconds)) {
        return seconds * 1000;
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const fromText = Number(value);
      if (Number.isFinite(fromText)) {
        return fromText;
      }
    }

    return Date.now();
  }

  private parseType(value: unknown, docId: string): BookmarkType {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'homestay' || normalized.includes('home')) {
        return 'homestay';
      }

      if (normalized === 'cafe' || normalized.includes('cafe') || normalized.includes('quán')) {
        return 'cafe';
      }
    }

    if (docId.startsWith('homestay-')) {
      return 'homestay';
    }

    return 'cafe';
  }

  private parseString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private parseNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private parseOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private normalizePlaceId(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return '';
  }

  private buildBookmarkDocId(type: BookmarkType, placeId: string): string {
    const safePlaceId = placeId.replace(/\//g, '_');
    return `${type}-${safePlaceId}`;
  }

  private extractPlaceIdFromDocId(docId: string): string {
    if (!docId) {
      return '';
    }

    if (docId.startsWith('cafe-')) {
      return docId.slice('cafe-'.length);
    }

    if (docId.startsWith('homestay-')) {
      return docId.slice('homestay-'.length);
    }

    return '';
  }
}