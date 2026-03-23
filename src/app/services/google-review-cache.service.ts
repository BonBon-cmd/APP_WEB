import { Injectable } from '@angular/core';
import {
  Firestore,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';

export interface GoogleReviewCacheReview {
  authorName: string;
  authorPhotoUri: string;
  rating: number;
  publishTime?: string;
  relativePublishTimeDescription?: string;
  text: string;
}

export interface GoogleReviewCacheRecord {
  appId: number | string;
  placeResourceName: string;
  rating: number;
  reviewCount: number;
  reviews: GoogleReviewCacheReview[];
  syncedAtIso: string;
}

@Injectable({
  providedIn: 'root',
})
export class GoogleReviewCacheService {
  private readonly db: Firestore = getFirestore();
  private readonly baseCollection = 'shared_google_place_reviews';

  async getByAppId(appId: number | string): Promise<GoogleReviewCacheRecord | null> {
    const docId = this.toDocId(appId);
    if (!docId) {
      return null;
    }

    try {
      const snapshot = await getDoc(doc(this.db, this.baseCollection, docId));
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data() as {
        appId?: number | string;
        placeResourceName?: string;
        rating?: number;
        reviewCount?: number;
        reviews?: GoogleReviewCacheReview[];
        syncedAtIso?: string;
        updatedAt?: Timestamp;
      };

      const syncedAtIso =
        typeof data.syncedAtIso === 'string'
          ? data.syncedAtIso
          : data.updatedAt?.toDate()?.toISOString() ?? new Date().toISOString();

      return {
        appId:
          typeof data.appId === 'number' || typeof data.appId === 'string'
            ? data.appId
            : appId,
        placeResourceName: typeof data.placeResourceName === 'string' ? data.placeResourceName : '',
        rating: typeof data.rating === 'number' ? data.rating : 0,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        syncedAtIso,
      };
    } catch {
      return null;
    }
  }

  async save(record: GoogleReviewCacheRecord): Promise<void> {
    const docId = this.toDocId(record.appId);
    if (!docId || !record.placeResourceName) {
      return;
    }

    try {
      await setDoc(
        doc(this.db, this.baseCollection, docId),
        {
          appId: record.appId,
          placeResourceName: record.placeResourceName,
          rating: record.rating,
          reviewCount: record.reviewCount,
          reviews: record.reviews,
          syncedAtIso: record.syncedAtIso,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Ignore write errors to avoid blocking UI flow.
    }
  }

  private toDocId(appId: number | string): string {
    if (typeof appId === 'number') {
      return Number.isFinite(appId) ? String(appId) : '';
    }

    if (typeof appId === 'string') {
      return appId.trim();
    }

    return '';
  }
}