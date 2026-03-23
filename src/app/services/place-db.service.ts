import { Injectable } from '@angular/core';
import {
  Firestore,
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

export interface Place {
  id: string;
  appId?: number;
  name: string;
  type: 'cafe' | 'homestay';
  slug?: string;
  city?: string;
  address: string;
  rating: number;
  price?: string;
  pricePerNight?: number;
  openTime?: string;
  contactPhone?: string;
  distance?: string;
  distanceKm: number;
  lat: number;
  lng: number;
  description?: string;
  heroImage?: string;
  gallery?: string[];
  amenities?: string[];
  isFeatured?: boolean;
  status?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PlaceDbService {
  private readonly db: Firestore = getFirestore();

  async getCafes(): Promise<Place[]> {
    try {
      const coll = collection(this.db, 'cafes');
      const q = query(coll, where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((snapshotDoc) =>
        this.mapCafeToPlace(snapshotDoc.data() as any, snapshotDoc.id)
      );
    } catch {
      return [];
    }
  }

  async getHomestays(): Promise<Place[]> {
    try {
      const coll = collection(this.db, 'homestays');
      const q = query(coll, where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((snapshotDoc) =>
        this.mapHomestayToPlace(snapshotDoc.data() as any, snapshotDoc.id)
      );
    } catch {
      return [];
    }
  }

  async getAllPlaces(): Promise<Place[]> {
    const [cafes, homestays] = await Promise.all([this.getCafes(), this.getHomestays()]);
    return [...cafes, ...homestays];
  }

  async getFeaturedPlaces(): Promise<Place[]> {
    const [cafes, homestays] = await Promise.all([
      this.getCafes(),
      this.getHomestays(),
    ]);
    const featured = [...cafes, ...homestays]
      .filter((p) => p.isFeatured)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return featured;
  }

  async getPlaceById(id: string, type: 'cafe' | 'homestay'): Promise<Place | null> {
    try {
      const collectionName = type === 'cafe' ? 'cafes' : 'homestays';
      const coll = collection(this.db, collectionName);
      const normalizedId = String(id).trim();
      const appIdCandidate = Number(normalizedId);

      const byFieldIdQuery = query(coll, where('id', '==', normalizedId));
      const byFieldIdSnapshot = await getDocs(byFieldIdQuery);
      const firstMatchedDoc = byFieldIdSnapshot.docs[0];
      if (firstMatchedDoc) {
        return type === 'cafe'
          ? this.mapCafeToPlace(firstMatchedDoc.data() as any, firstMatchedDoc.id)
          : this.mapHomestayToPlace(firstMatchedDoc.data() as any, firstMatchedDoc.id);
      }

      if (Number.isFinite(appIdCandidate)) {
        const byAppIdQuery = query(coll, where('appId', '==', appIdCandidate));
        const byAppIdSnapshot = await getDocs(byAppIdQuery);
        const firstByAppIdDoc = byAppIdSnapshot.docs[0];
        if (firstByAppIdDoc) {
          return type === 'cafe'
            ? this.mapCafeToPlace(firstByAppIdDoc.data() as any, firstByAppIdDoc.id)
            : this.mapHomestayToPlace(firstByAppIdDoc.data() as any, firstByAppIdDoc.id);
        }
      }

      const docRef = doc(this.db, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return null;
      }

      return type === 'cafe'
        ? this.mapCafeToPlace(docSnap.data() as any, docSnap.id)
        : this.mapHomestayToPlace(docSnap.data() as any, docSnap.id);
    } catch {
      return null;
    }
  }

  private mapCafeToPlace(doc: any, documentId: string): Place {
    return {
      id: doc.id || documentId,
      appId: this.parseAppId(doc.appId),
      name: doc.name || '',
      type: 'cafe',
      address: doc.address || '',
      rating: doc.rating || 0,
      price: this.toDollarPrice(doc.priceRange),
      openTime: doc.openTime || '',
      contactPhone: doc.contactPhone || '',
      distanceKm: 0,
      lat: this.parseCoordinate(doc.location?.lat, doc.latitude, 11.94),
      lng: this.parseCoordinate(doc.location?.lng, doc.longitude, 108.43),
      description: doc.description || '',
      heroImage: doc.heroImage || 'assets/images/login.jpg',
      gallery: (doc.imageGallery && doc.imageGallery.length ? doc.imageGallery : [doc.heroImage]).filter(Boolean),
      amenities: doc.amenities || [],
      isFeatured: doc.isFeatured || false,
      status: doc.status || 'active',
      slug: doc.slug || '',
      city: doc.city || 'Da Lat',
    };
  }

  private mapHomestayToPlace(doc: any, documentId: string): Place {
    const pricePerNight = Number(doc.pricePerNight || 0);
    return {
      id: doc.id || documentId,
      appId: this.parseAppId(doc.appId),
      name: doc.name || '',
      type: 'homestay',
      address: doc.address || '',
      rating: doc.rating || 0,
      price: pricePerNight > 0 ? `${(pricePerNight / 1000).toLocaleString('en-US')}k $` : '',
      openTime: '',
      contactPhone: doc.contactPhone || '',
      distanceKm: 0,
      lat: this.parseCoordinate(doc.location?.lat, doc.latitude, 11.94),
      lng: this.parseCoordinate(doc.location?.lng, doc.longitude, 108.43),
      description: doc.description || '',
      heroImage: doc.heroImage || 'assets/images/register.jpeg',
      gallery: (doc.imageGallery && doc.imageGallery.length ? doc.imageGallery : [doc.heroImage]).filter(Boolean),
      amenities: doc.amenities || [],
      isFeatured: doc.isFeatured || false,
      status: doc.status || 'active',
      slug: doc.slug || '',
      city: doc.city || 'Da Lat',
      pricePerNight: doc.pricePerNight,
    };
  }

  private toDollarPrice(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .replace(/đ/gi, '$')
      .replace(/\bVND\b/gi, '$')
      .trim();
  }

  private parseCoordinate(primary: unknown, secondary: unknown, fallback: number): number {
    const primaryNumber = Number(primary);
    if (Number.isFinite(primaryNumber)) {
      return primaryNumber;
    }

    const secondaryNumber = Number(secondary);
    if (Number.isFinite(secondaryNumber)) {
      return secondaryNumber;
    }

    return fallback;
  }

  private parseAppId(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
