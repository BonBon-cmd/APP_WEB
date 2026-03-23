import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs, getFirestore } from 'firebase/firestore';

export interface HomeCafeItem {
  id: string;
  appId?: number;
  name: string;
  image: string;
  address: string;
  rating: number;
  openTime: string;
  phone: string;
  lat: number;
  lng: number;
}

export interface HomeHomestayItem {
  id: string;
  appId?: number;
  name: string;
  image: string;
  location: string;
  rating: number;
  price: string;
  lat: number;
  lng: number;
}

@Injectable({
  providedIn: 'root',
})
export class PlaceDataService {
  private readonly db: Firestore = getFirestore();

  private readonly cafeAppIdByName: Record<string, number> = {
    'The Married Beans': 1,
    'Là Việt Coffee': 3,
    'Windmills Coffee': 5,
    'The Wilder Nest Ta Nung': 10,
    'Cafe Dũng Bụi': 11,
    'S Coffee Roastery': 12,
    'Vườn Sen Coffee': 13,
    'Tiệm cafe Người Thương Ơi': 14,
  };

  private readonly homestayAppIdByName: Record<string, number> = {
    'The Dalat House': 101,
    'Pine Hill Homestay': 102,
    'Valley View Villa': 103,
    'Cozy Garden Stay': 104,
  };

  async getHomeCafes(): Promise<HomeCafeItem[]> {
    const snapshot = await getDocs(collection(this.db, 'cafes'));
    const cafes = snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() as Record<string, unknown>;
        const location = (data['location'] as { lat?: number; lng?: number } | undefined) ?? {};
        const name = this.readText(data['name'], 'Địa điểm cafe');
        const appId = this.resolveCafeAppId(data['appId'], name);

        return {
          id: this.readText(data['id'], docSnapshot.id),
          appId,
          name,
          image: this.readText(data['heroImage'], 'assets/images/login.jpg'),
          address: this.readText(data['address'], 'Đà Lạt'),
          rating: this.readNumber(data['rating'], 4.5),
          openTime: this.readText(data['openTime'], 'Đang cập nhật'),
          phone: this.readText(data['contactPhone'], 'Đang cập nhật'),
          lat: this.readNumber(location.lat, 11.9404),
          lng: this.readNumber(location.lng, 108.4583),
          isFeatured: Boolean(data['isFeatured']),
        };
      })
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1;
        }
        return b.rating - a.rating;
      })
      .map(({ isFeatured, ...item }) => item);

    return cafes;
  }

  async getHomeHomestays(): Promise<HomeHomestayItem[]> {
    const snapshot = await getDocs(collection(this.db, 'homestays'));
    const homestays = snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() as Record<string, unknown>;
        const location = (data['location'] as { lat?: number; lng?: number } | undefined) ?? {};
        const name = this.readText(data['name'], 'Homestay');
        const appId = this.resolveHomestayAppId(data['appId'], name);

        return {
          id: this.readText(data['id'], docSnapshot.id),
          appId,
          name,
          image: this.readText(data['heroImage'], 'assets/images/login.jpg'),
          location: this.toShortAddress(this.readText(data['address'], 'Đà Lạt')),
          rating: this.readNumber(data['rating'], 4.5),
          price: this.toPricePerNight(data['pricePerNight']),
          lat: this.readNumber(location.lat, 11.9404),
          lng: this.readNumber(location.lng, 108.4583),
          isFeatured: Boolean(data['isFeatured']),
        };
      })
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1;
        }
        return b.rating - a.rating;
      })
      .map(({ isFeatured, ...item }) => item);

    return homestays;
  }

  private resolveCafeAppId(appIdValue: unknown, name: string): number {
    const parsed = this.readNumber(appIdValue, NaN);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return this.cafeAppIdByName[name] ?? 1;
  }

  private resolveHomestayAppId(appIdValue: unknown, name: string): number {
    const parsed = this.readNumber(appIdValue, NaN);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return this.homestayAppIdByName[name] ?? 101;
  }

  private readText(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private readNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return fallback;
  }

  private toShortAddress(address: string): string {
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length <= 2) {
      return address;
    }

    return `${parts[0]}, ${parts[1]}`;
  }

  private toPricePerNight(priceValue: unknown): string {
    if (typeof priceValue === 'number' && Number.isFinite(priceValue)) {
      return `${priceValue.toLocaleString('vi-VN')} VND/đêm`;
    }

    return 'Đang cập nhật';
  }
}