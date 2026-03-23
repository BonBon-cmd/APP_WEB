import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { NavController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { getGooglePlaceResourceByAppId } from '../../data/google-place-id.map';
import { PlaceDbService } from '../../services/place-db.service';
import { GoogleReviewCacheService } from '../../services/google-review-cache.service';
import type { GoogleReviewCacheReview } from '../../services/google-review-cache.service';
import { PlaceResourceStoreService } from '../../services/place-resource-store.service';
import { AuthService } from '../../services/auth.service';
import { BookmarkService, BookmarkType } from '../../services/bookmark.service';
import {
  arrowBack,
  heart,
  heartOutline,
  shareSocialOutline,
  star,
  starHalf,
  starOutline,
  locationOutline,
  location,
  timeOutline,
  callOutline,
  navigate,
  wifiOutline,
  carOutline,
  snowOutline,
  tvOutline,
  cafeOutline,
  restaurantOutline,
  pawOutline,
  partlySunnyOutline,
  leafOutline,
  waterOutline,
  thumbsUpOutline,
  createOutline,
  close,
  closeCircle,
  cameraOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-place-detail',
  templateUrl: './place-detail.page.html',
  styleUrls: ['./place-detail.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class PlaceDetailPage implements OnInit {
  isFavorite = false;
  isFavoriteLoading = false;
  currentImageIndex = 0;
  descriptionExpanded = false;
  isLoadingGoogleReviews = false;
  googleReviewsError = '';
  hasLiveGoogleReviews = false;
  private readonly googlePlaceStoreKey = 'googlePlaceResourceByAppId';

  place: {
    id: string | number;
    appId?: number;
    name: string;
    type: string;
    image: string;
    gallery: string[];
    rating: number;
    reviewCount: number;
    distance: string;
    price: string;
    priceUnit: string;
    openTime: string;
    phone: string;
    googlePlaceResourceName: string;
    address: string;
    lat: number;
    lng: number;
    description: string;
    amenities: Array<{ name: string; icon: string }>;
  } = {
    id: 1,
    name: 'The Married Beans Coffee',
    type: 'Quán Cafe',
    image: 'assets/images/login.jpg',
    gallery: [
      'assets/images/login.jpg',
      'assets/images/register.jpeg',
      'assets/images/login.jpg'
    ],
    rating: 4.8,
    reviewCount: 156,
    distance: '500m',
    price: '45.000$',
    priceUnit: 'người',
    openTime: '07:00 - 22:00',
    phone: '0909 123 456',
    googlePlaceResourceName: '',
    address: '12 Trần Phú, Phường 3, Đà Lạt, Lâm Đồng',
    lat: 11.942,
    lng: 108.433,
    description: 'The Married Beans là quán cafe phong cách vintage nằm ngay trung tâm Đà Lạt. Với không gian ấm cúng, view đẹp nhìn ra đồi thông, đây là địa điểm lý tưởng để thư giãn và thưởng thức những ly cafe thơm ngon. Quán được thiết kế theo phong cách Châu Âu cổ điển với những chi tiết gỗ tinh tế và ánh đèn vàng ấm áp.',
    amenities: [
      { name: 'WiFi miễn phí', icon: 'wifi-outline' },
      { name: 'Bãi đỗ xe', icon: 'car-outline' },
      { name: 'Điều hòa', icon: 'snow-outline' },
      { name: 'TV', icon: 'tv-outline' }
    ]
  };

  ratingBars = [
    { stars: 5, percentage: 0, count: 0 },
    { stars: 4, percentage: 0, count: 0 },
    { stars: 3, percentage: 0, count: 0 },
    { stars: 2, percentage: 0, count: 0 },
    { stars: 1, percentage: 0, count: 0 }
  ];

  reviews: Array<{
    id: number;
    name: string;
    avatar: string;
    rating: number;
    date: string;
    title: string;
    content: string;
    images: string[];
    helpfulCount: number;
    source: string;
  }> = [];

  constructor(
    private navCtrl: NavController,
    private router: Router,
    private placeDbService: PlaceDbService,
    private googleReviewCacheService: GoogleReviewCacheService,
    private placeResourceStoreService: PlaceResourceStoreService,
    private authService: AuthService,
    private bookmarkService: BookmarkService,
    private toastController: ToastController
  ) {
    addIcons({
      arrowBack,
      heart,
      heartOutline,
      shareSocialOutline,
      star,
      starHalf,
      starOutline,
      locationOutline,
      location,
      timeOutline,
      callOutline,
      navigate,
      wifiOutline,
      carOutline,
      snowOutline,
      tvOutline,
      cafeOutline,
      restaurantOutline,
      pawOutline,
      partlySunnyOutline,
      leafOutline,
      waterOutline,
      thumbsUpOutline,
      createOutline,
      close,
      closeCircle,
      cameraOutline
    });
  }

  ngOnInit() {
    const navState = history.state as {
      place?: {
        id?: number | string;
        appId?: number;
        name?: string;
        type?: string;
        address?: string;
        googlePlaceResourceName?: string;
        rating?: number;
        reviewCount?: number;
        distance?: string;
        openTime?: string;
        phone?: string;
        price?: string;
        lat?: number;
        lng?: number;
        image?: string;
        gallery?: string[];
        amenities?: Array<{ name: string; icon: string }> | string[];
        description?: string;
      };
    };

    if (navState.place?.name) {
      this.place = {
        ...this.place,
        id: navState.place.id ?? this.place.id,
        appId: navState.place.appId ?? this.place.appId,
        name: navState.place.name ?? this.place.name,
        type: navState.place.type ?? this.place.type,
        address: navState.place.address ?? this.place.address,
        googlePlaceResourceName:
          navState.place.googlePlaceResourceName ??
          getGooglePlaceResourceByAppId(this.toNumericPlaceId(navState.place.id)) ??
          this.place.googlePlaceResourceName,
        rating: navState.place.rating ?? this.place.rating,
        reviewCount: navState.place.reviewCount ?? this.place.reviewCount,
        distance: navState.place.distance ?? this.place.distance,
        openTime: navState.place.openTime ?? this.place.openTime,
        phone: navState.place.phone ?? this.place.phone,
        price: this.normalizePriceToVnd(navState.place.price ?? this.place.price),
        priceUnit: this.inferPriceUnit(navState.place.type ?? this.place.type),
        lat: navState.place.lat ?? this.place.lat,
        lng: navState.place.lng ?? this.place.lng,
        image: navState.place.image ?? this.place.image,
        gallery: navState.place.gallery ?? this.place.gallery,
        amenities: this.normalizeAmenities(navState.place.amenities) ?? this.place.amenities,
        description: navState.place.description ?? this.place.description,
      };
    }

    const loadDataPromise = navState.place?.id
      ? this.loadFullPlaceData(navState.place.id as string | number)
      : Promise.resolve();

    if (!this.place.googlePlaceResourceName) {
      const numericPlaceId = this.toNumericPlaceId(this.place.id);
      this.place.googlePlaceResourceName =
        getGooglePlaceResourceByAppId(numericPlaceId) || this.getStoredGooglePlaceResource(this.place.id);
    }

    if (!this.place.googlePlaceResourceName) {
      void this.getSharedPlaceResource().then((sharedResource) => {
        if (sharedResource) {
          this.place.googlePlaceResourceName = sharedResource;
        }
      });
    }

    void loadDataPromise.finally(() => {
      void this.syncFavoriteState();
      void this.loadGoogleMapReviews();
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  async toggleFavorite() {
    if (this.isFavoriteLoading) {
      return;
    }

    const user = this.authService.currentUser;
    if (!user) {
      await this.presentFavoriteToast('Vui lòng đăng nhập để lưu yêu thích.', 'warning');
      return;
    }

    const placeId = this.toStorageKey(this.place.id);
    if (!placeId) {
      return;
    }

    const bookmarkType = this.toBookmarkType(this.place.type);

    this.isFavoriteLoading = true;
    try {
      if (this.isFavorite) {
        await this.bookmarkService.removeUserBookmark(user.uid, bookmarkType, placeId);
        this.isFavorite = false;
        await this.presentFavoriteToast('Đã bỏ khỏi danh sách yêu thích.', 'medium');
        return;
      }

      await this.bookmarkService.saveUserBookmark(user.uid, {
        placeId,
        appId: this.place.appId ?? this.toNumericPlaceId(this.place.id),
        name: this.place.name,
        type: bookmarkType,
        location: this.place.address,
        rating: Number.isFinite(this.place.rating) ? this.place.rating : 0,
        lat: this.place.lat,
        lng: this.place.lng,
        image: this.place.image || 'assets/images/login.jpg',
        googlePlaceResourceName: this.place.googlePlaceResourceName || '',
      });
      this.isFavorite = true;
      await this.presentFavoriteToast('Đã lưu vào danh sách yêu thích.', 'success');
    } catch {
      await this.presentFavoriteToast('Không thể cập nhật yêu thích. Vui lòng thử lại.', 'danger');
    } finally {
      this.isFavoriteLoading = false;
    }
  }

  private async presentFavoriteToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'medium'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 1600,
      position: 'bottom',
    });

    await toast.present();
  }

  toggleDescription() {
    this.descriptionExpanded = !this.descriptionExpanded;
  }

  viewAllReviews() {
    void this.loadGoogleMapReviews();
  }

  async loadGoogleMapReviews() {
    this.isLoadingGoogleReviews = true;
    this.googleReviewsError = '';
    this.reviews = [];
    this.ratingBars = this.buildRatingBarsFromReviews([]);

    const cached = await this.getCachedGoogleReviews();
    if (cached) {
      this.applyCachedGoogleReviews(cached);
      if (!this.place.googlePlaceResourceName && cached.placeResourceName) {
        this.place.googlePlaceResourceName = cached.placeResourceName;
      }
    }

    const apiKey = (environment.googlePlacesApiKey || '').trim();
    if (!apiKey) {
      if (!cached) {
      //  this.googleReviewsError = 'Chua cau hinh Google Places API key nen chua the dong bo danh gia thuc.';
        this.hasLiveGoogleReviews = false;
      }
      this.isLoadingGoogleReviews = false;
      return;
    }

    try {
      const sharedResource = await this.getSharedPlaceResource();

      const placeResourceName =
        this.place.googlePlaceResourceName ||
        sharedResource ||
        await this.findGooglePlaceResource(
          this.place.name,
          this.place.address,
          this.place.lat,
          this.place.lng,
          apiKey
        );

      if (placeResourceName) {
        this.place.googlePlaceResourceName = placeResourceName;
      }

      if (!placeResourceName) {
        //this.googleReviewsError = 'Khong tim thay dia diem tuong ung tren Google Maps. Hay gan placeId co dinh cho dia diem nay.';
        this.hasLiveGoogleReviews = false;
        return;
      }

      const details = await this.fetchGooglePlaceDetails(placeResourceName, apiKey);
      if (!details) {
       // this.googleReviewsError = '';
        this.hasLiveGoogleReviews = false;
        return;
      }

      if (typeof details.rating === 'number') {
        this.place.rating = Math.round(details.rating * 10) / 10;
      }

      if (typeof details.userRatingCount === 'number') {
        this.place.reviewCount = details.userRatingCount;
      }

      this.storeGooglePlaceResource(this.place.id, placeResourceName);
      await this.savePlaceResourceForLookupKeys(placeResourceName);

      const mappedReviews = (details.reviews ?? []).map((review, index) => {
        const text = review.text?.text ?? '';
        return {
          id: index + 1,
          name: review.authorAttribution?.displayName ?? 'Nguoi dung Google',
          avatar: this.resolveReviewAvatar({
            authorPhotoUri: review.authorAttribution?.photoUri,
          }),
          rating: typeof review.rating === 'number' ? Math.max(1, Math.min(5, Math.round(review.rating))) : 5,
          date: this.formatGooglePublishTime(review.publishTime, review.relativePublishTimeDescription),
          title: text ? this.buildReviewTitle(text) : 'Danh gia tu Google Maps',
          content: text || 'Khong co noi dung chi tiet.',
          images: [],
          helpfulCount: 0,
          source: 'Google Maps'
        };
      });

      this.reviews = mappedReviews;
      this.ratingBars = this.buildRatingBarsFromReviews(mappedReviews);

      const reviewPayload = {
        placeResourceName,
        rating: this.place.rating,
        reviewCount: this.place.reviewCount,
        reviews: (details.reviews ?? []).map((review) => ({
          authorName: review.authorAttribution?.displayName ?? 'Nguoi dung Google',
          authorPhotoUri: review.authorAttribution?.photoUri ?? '',
          avatar: review.authorAttribution?.photoUri ?? '',
          rating: typeof review.rating === 'number' ? review.rating : 5,
          publishTime: review.publishTime,
          relativePublishTimeDescription: review.relativePublishTimeDescription,
          text: review.text?.text ?? '',
        })),
        syncedAtIso: new Date().toISOString(),
      };

      await this.saveCachedReviewsForLookupKeys(reviewPayload);

      if (mappedReviews.length === 0) {
        this.googleReviewsError = 'Dia diem nay tren Google Maps hien chua co noi dung review cong khai.';
        this.hasLiveGoogleReviews = false;
        return;
      }

      this.hasLiveGoogleReviews = true;
    } catch {
      this.googleReviewsError = 'Khong the tai du lieu Google Places. Hay kiem tra Places API da bat, API key duoc cap quyen va placeId co dinh hop le.';
      this.hasLiveGoogleReviews = false;
    } finally {
      this.isLoadingGoogleReviews = false;
    }
  }

  openDirections() {
    const locationType = this.place.type.toLowerCase().includes('cafe') ? 'cafe' : 'homestay';
    const distanceKm = this.parseDistanceToKm(this.place.distance);

    void this.router.navigate(['/tabs/location'], {
      state: {
        directionRequest: {
          id: this.place.id,
          name: this.place.name,
          type: locationType,
          location: this.place.address,
          rating: this.place.rating,
          distanceKm,
          lat: this.place.lat,
          lng: this.place.lng,
        },
        askStartNavigation: false,
        requestKey: `${this.place.id ?? this.place.name}-${Date.now()}`,
      },
    });
  }

  private parseDistanceToKm(distanceText: string): number {
    const normalized = distanceText.trim().toLowerCase();
    if (normalized.endsWith('km')) {
      const kmValue = Number.parseFloat(normalized.replace('km', '').trim());
      return Number.isFinite(kmValue) ? kmValue : 0;
    }

    if (normalized.endsWith('m')) {
      const meterValue = Number.parseFloat(normalized.replace('m', '').trim());
      return Number.isFinite(meterValue) ? Math.round((meterValue / 1000) * 10) / 10 : 0;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async syncFavoriteState(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user) {
      this.isFavorite = false;
      return;
    }

    const placeId = this.toStorageKey(this.place.id);
    if (!placeId) {
      this.isFavorite = false;
      return;
    }

    try {
      this.isFavorite = await this.bookmarkService.isBookmarked(
        user.uid,
        this.toBookmarkType(this.place.type),
        placeId
      );
    } catch {
      this.isFavorite = false;
    }
  }

  private async findGooglePlaceResource(
    name: string,
    address: string,
    lat: number,
    lng: number,
    apiKey: string
  ): Promise<string | null> {
    const endpoint = 'https://places.googleapis.com/v1/places:searchText';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.name',
      },
      body: JSON.stringify({
        textQuery: `${name} ${address}`.trim(),
        languageCode: 'vi',
        regionCode: 'VN',
        locationBias: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: 2500,
          },
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      places?: Array<{ name?: string }>;
    };

    return data.places?.[0]?.name ?? null;
  }

  private async fetchGooglePlaceDetails(placeResourceName: string, apiKey: string): Promise<{
    rating?: number;
    userRatingCount?: number;
    reviews?: Array<{
      rating?: number;
      publishTime?: string;
      relativePublishTimeDescription?: string;
      text?: { text?: string };
      authorAttribution?: {
        displayName?: string;
        photoUri?: string;
      };
    }>;
  } | null> {
    const endpoint = `https://places.googleapis.com/v1/${placeResourceName}?languageCode=vi`;
    const response = await fetch(endpoint, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as {
      rating?: number;
      userRatingCount?: number;
      reviews?: Array<{
        rating?: number;
        publishTime?: string;
        relativePublishTimeDescription?: string;
        text?: { text?: string };
        authorAttribution?: {
          displayName?: string;
          photoUri?: string;
        };
      }>;
    };
  }

  private formatGooglePublishTime(publishTime?: string, relative?: string): string {
    if (relative) {
      return relative;
    }

    if (!publishTime) {
      return 'Gan day';
    }

    const parsed = new Date(publishTime);
    if (Number.isNaN(parsed.getTime())) {
      return 'Gan day';
    }

    return parsed.toLocaleDateString('vi-VN');
  }

  private buildReviewTitle(content: string): string {
    const clean = content.replace(/\s+/g, ' ').trim();
    if (!clean) {
      return 'Danh gia tu Google Maps';
    }

    return clean.length > 44 ? `${clean.slice(0, 44)}...` : clean;
  }

  private buildRatingBarsFromReviews(
    reviews: Array<{ rating: number }>
  ): Array<{ stars: number; percentage: number; count: number }> {
    const total = reviews.length;
    const counts = new Map<number, number>([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);

    for (const review of reviews) {
      const current = counts.get(review.rating) ?? 0;
      counts.set(review.rating, current + 1);
    }

    return [5, 4, 3, 2, 1].map((stars) => {
      const count = counts.get(stars) ?? 0;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { stars, percentage, count };
    });
  }

  private getStoredGooglePlaceResource(placeId: string | number): string {
    const key = this.toStorageKey(placeId);
    if (!key) {
      return '';
    }

    try {
      const raw = localStorage.getItem(this.googlePlaceStoreKey);
      if (!raw) {
        return '';
      }

      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed[key] ?? '';
    } catch {
      return '';
    }
  }

  private storeGooglePlaceResource(placeId: string | number, placeResourceName: string) {
    const key = this.toStorageKey(placeId);
    if (!key || !placeResourceName) {
      return;
    }

    try {
      const raw = localStorage.getItem(this.googlePlaceStoreKey);
      const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
      parsed[key] = placeResourceName;
      localStorage.setItem(this.googlePlaceStoreKey, JSON.stringify(parsed));
    } catch {
      // Ignore storage errors on restricted environments.
    }
  }

  private async loadFullPlaceData(placeId: string | number) {
    try {
      const dbPlace = await this.placeDbService.getPlaceById(
        String(placeId),
        this.place.type?.toLowerCase() === 'quán cafe' ? 'cafe' : 'homestay'
      );
      if (!dbPlace) {
        return;
      }

      this.place = {
        ...this.place,
        id: dbPlace.id || this.place.id,
        appId: dbPlace.appId ?? this.place.appId,
        name: dbPlace.name || this.place.name,
        type: this.toDisplayType(dbPlace.type),
        address: dbPlace.address || this.place.address,
        lat: dbPlace.lat || this.place.lat,
        lng: dbPlace.lng || this.place.lng,
        description: dbPlace.description || this.place.description,
        image: dbPlace.heroImage || this.place.image,
        gallery: dbPlace.gallery?.length ? dbPlace.gallery : dbPlace.heroImage ? [dbPlace.heroImage] : this.place.gallery,
        amenities: this.normalizeAmenities(dbPlace.amenities) || this.place.amenities,
        price: this.normalizePriceToVnd(dbPlace.price || this.place.price),
        priceUnit: this.inferPriceUnit(this.toDisplayType(dbPlace.type)),
        openTime: dbPlace.openTime || this.place.openTime,
        phone: dbPlace.contactPhone || this.place.phone,
        rating: dbPlace.rating || this.place.rating,
      };
    } catch {
      // Keep using defaults if Firebase fetch fails
    }
  }

  private getLookupKeys(): Array<string | number> {
    const values: Array<string | number | undefined> = [
      this.place.id,
      this.place.appId,
      this.toNumericPlaceId(this.place.id),
    ];

    const dedup = new Map<string, string | number>();
    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }

      const key = String(value).trim();
      if (!key) {
        continue;
      }

      dedup.set(key, value);
    }

    return Array.from(dedup.values());
  }

  private normalizePriceToVnd(value: unknown): string {
    if (typeof value !== 'string') {
      return 'Đang cập nhật';
    }

    const raw = value.trim();
    if (!raw) {
      return 'Đang cập nhật';
    }

    const compactRegex = /(\d+(?:[.,]\d+)?)\s*([kKmM])/g;
    const expanded = raw.replace(compactRegex, (_match, amountText: string, unitText: string) => {
      const amount = Number.parseFloat(amountText.replace(',', '.'));
      if (!Number.isFinite(amount)) {
        return amountText;
      }

      const multiplier = unitText.toLowerCase() === 'm' ? 1_000_000 : 1_000;
      return String(Math.round(amount * multiplier));
    });

    const numericParts = expanded.match(/\d+(?:[.,]\d+)*/g) ?? [];
    const parsedValues = numericParts
      .map((part) => Number.parseFloat(part.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.')))
      .filter((numberValue) => Number.isFinite(numberValue) && numberValue > 0)
      .map((numberValue) => Math.round(numberValue));

    if (parsedValues.length === 0) {
      return 'Đang cập nhật';
    }

    const formatter = new Intl.NumberFormat('vi-VN');
    if (parsedValues.length >= 2) {
      const min = Math.min(...parsedValues);
      const max = Math.max(...parsedValues);
      if (min === max) {
        return `${formatter.format(min)} VND`;
      }

      return `${formatter.format(min)} - ${formatter.format(max)} VND`;
    }

    return `${formatter.format(parsedValues[0])} VND`;
  }

  private inferPriceUnit(type: string | undefined): string {
    return (type ?? '').toLowerCase().includes('home') ? 'đêm' : 'người';
  }

  private async getCachedGoogleReviews() {
    const keys = this.getLookupKeys();
    for (const key of keys) {
      const cached = await this.googleReviewCacheService.getByAppId(key);
      if (cached) {
        return cached;
      }
    }

    return null;
  }

  private async saveCachedReviewsForLookupKeys(payload: {
    placeResourceName: string;
    rating: number;
    reviewCount: number;
    reviews: Array<{
      authorName: string;
      authorPhotoUri: string;
      rating: number;
      publishTime?: string;
      relativePublishTimeDescription?: string;
      text: string;
    }>;
    syncedAtIso: string;
  }) {
    const keys = this.getLookupKeys();
    for (const key of keys) {
      await this.googleReviewCacheService.save({
        appId: key,
        ...payload,
      });
    }
  }

  private async getSharedPlaceResource(): Promise<string> {
    const keys = this.getLookupKeys();
    for (const key of keys) {
      const resource = await this.placeResourceStoreService.getPlaceResource(key);
      if (resource) {
        return resource;
      }
    }

    return '';
  }

  private async savePlaceResourceForLookupKeys(placeResourceName: string): Promise<void> {
    const keys = this.getLookupKeys();
    for (const key of keys) {
      await this.placeResourceStoreService.savePlaceResource(key, placeResourceName);
    }
  }

  private getIconForAmenity(name: string): string {
    const iconMap: Record<string, string> = {
      'wifi': 'wifi-outline',
      'parking': 'car-outline',
      'ac': 'snow-outline',
      'tv': 'tv-outline',
      'cafe': 'cafe-outline',
      'restaurant': 'restaurant-outline',
      'garden': 'leaf-outline',
      'pool': 'water-outline',
      'outdoor-seating': 'partly-sunny-outline',
      'table-service': 'restaurant-outline',
      'pet-friendly': 'paw-outline',
      'takeaway': 'cafe-outline',
    };

    const key = name.toLowerCase();
    for (const [k, icon] of Object.entries(iconMap)) {
      if (key.includes(k)) {
        return icon;
      }
    }
    return 'star-outline';
  }

  private getAmenityDisplayName(value: string): string {
    const labelMap: Record<string, string> = {
      'outdoor-seating': 'Chỗ ngồi ngoài trời',
      'parking': 'Bãi đỗ xe',
      'table-service': 'Phục vụ tại bàn',
      'pet-friendly': 'Thân thiện thú cưng',
      'wifi': 'WiFi miễn phí',
      'ac': 'Điều hòa',
      'tv': 'TV',
      'garden': 'Không gian sân vườn',
      'pool': 'Hồ bơi',
      'takeaway': 'Mua mang đi',
    };

    const key = (value || '').toLowerCase();
    if (labelMap[key]) {
      return labelMap[key];
    }

    return value
      .replace(/[-_]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private normalizeAmenities(
    amenities: Array<{ name: string; icon: string }> | string[] | undefined
  ): Array<{ name: string; icon: string }> | null {
    if (!amenities || amenities.length === 0) {
      return null;
    }

    if (typeof amenities[0] === 'string') {
      return (amenities as string[]).map((value) => ({
        name: this.getAmenityDisplayName(value),
        icon: this.getIconForAmenity(value),
      }));
    }

    return amenities as Array<{ name: string; icon: string }>;
  }

  private toDisplayType(type: string | undefined): string {
    if (type === 'cafe') {
      return 'Quán Cafe';
    }

    if (type === 'homestay') {
      return 'Homestay';
    }

    return this.place.type;
  }

  private toBookmarkType(type: string): BookmarkType {
    return type.toLowerCase().includes('cafe') ? 'cafe' : 'homestay';
  }

  private toNumericPlaceId(value: string | number | undefined): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private toStorageKey(value: string | number): string {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return '';
  }

  private applyCachedGoogleReviews(cached: {
    rating: number;
    reviewCount: number;
    reviews: Array<GoogleReviewCacheReview | Record<string, unknown>>;
  }) {
    if (typeof cached.rating === 'number' && cached.rating > 0) {
      this.place.rating = Math.round(cached.rating * 10) / 10;
    }

    if (typeof cached.reviewCount === 'number' && cached.reviewCount >= 0) {
      this.place.reviewCount = cached.reviewCount;
    }

    const mapped = (cached.reviews ?? []).map((review, index) => {
      const reviewData = review as Record<string, unknown>;
      const content = typeof reviewData['text'] === 'string' ? reviewData['text'].trim() : '';
      const authorName = this.resolveReviewAuthorName(reviewData);
      const ratingValue = typeof reviewData['rating'] === 'number' ? reviewData['rating'] : NaN;
      return {
        id: index + 1,
        name: authorName,
        avatar: this.resolveReviewAvatar(reviewData),
        rating: Number.isFinite(ratingValue)
          ? Math.max(1, Math.min(5, Math.round(ratingValue)))
          : 5,
        date: this.formatGooglePublishTime(
          typeof reviewData['publishTime'] === 'string' ? reviewData['publishTime'] : undefined,
          typeof reviewData['relativePublishTimeDescription'] === 'string'
            ? reviewData['relativePublishTimeDescription']
            : undefined
        ),
        title: content ? this.buildReviewTitle(content) : 'Danh gia tu Google Maps',
        content: content || 'Khong co noi dung chi tiet.',
        images: [],
        helpfulCount: 0,
        source: 'Google Maps'
      };
    });

    this.reviews = mapped;
    this.ratingBars = this.buildRatingBarsFromReviews(mapped);
    this.hasLiveGoogleReviews = mapped.length > 0;
  }

  private resolveReviewAvatar(review: Record<string, unknown>): string {
    const candidates = [
      review['authorPhotoUri'],
      review['avatar'],
      review['photoUri'],
      review['authorAvatar'],
      review['userAvatar'],
      review['authorPhotoURL'],
      review['photoURL'],
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return 'assets/icon/Icon_app.png';
  }

  private resolveReviewAuthorName(review: Record<string, unknown>): string {
    const candidates = [
      review['authorName'],
      review['name'],
      review['userName'],
      review['displayName'],
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return 'Nguoi dung Google';
  }
}
