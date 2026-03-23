import { Injectable } from '@angular/core';
import { getDatabase, ref, get, set } from 'firebase/database';

@Injectable({
  providedIn: 'root',
})
export class PlaceResourceStoreService {
  private readonly basePath = 'shared/googlePlaceResourceByAppId';

  async getPlaceResource(appId: number | string): Promise<string> {
    const key = this.toKey(appId);
    if (!key) {
      return '';
    }

    try {
      const db = getDatabase();
      const snapshot = await get(ref(db, `${this.basePath}/${key}`));
      const value = snapshot.val();
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  }

  async savePlaceResource(appId: number | string, placeResourceName: string): Promise<void> {
    const key = this.toKey(appId);
    if (!key || !placeResourceName) {
      return;
    }

    try {
      const db = getDatabase();
      await set(ref(db, `${this.basePath}/${key}`), placeResourceName);
    } catch {
      // Ignore write failures to avoid breaking review loading flow.
    }
  }

  private toKey(appId: number | string): string {
    if (typeof appId === 'number') {
      return Number.isFinite(appId) ? String(appId) : '';
    }

    if (typeof appId === 'string') {
      return appId.trim();
    }

    return '';
  }
}
