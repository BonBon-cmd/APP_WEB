import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonInput, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { HomeCafeItem, HomeHomestayItem, PlaceDataService } from '../services/place-data.service';
import { PlaceDbService } from '../services/place-db.service';
import { getGooglePlaceResourceByAppId } from '../data/google-place-id.map';
import {
  notificationsOutline,
  searchOutline,
  optionsOutline,
  cafeOutline,
  bedOutline,
  restaurantOutline,
  mapOutline,
  cameraOutline,
  star,
  heartOutline,
  locationOutline,
  timeOutline,
  location,
  chevronDownOutline,
  navigateOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonContent, IonIcon, IonInput, CommonModule, FormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  searchText: string = '';
  userName = 'Coffee Lover';
  userAvatar = 'assets/icon/Icon_app.png';
  private profileSubscription?: Subscription;

  banners = [
    {
      image: 'assets/images/login.jpg',
      tag: 'Nổi bật',
      title: 'Homestay Đà Lạt',
      subtitle: 'Nghỉ dưỡng giữa thiên nhiên'
    },
    {
      image: 'assets/images/register.jpeg',
      tag: 'Mới',
      title: 'Coffee & Chill',
      subtitle: 'Những quán cafe view đẹp nhất'
    },
    {
      image: 'assets/images/login.jpg',
      tag: 'Hot',
      title: 'Weekend Getaway',
      subtitle: 'Trốn phố cuối tuần'
    },
  ];

  categories = [
    { name: 'Cafes', icon: 'cafe-outline', active: true },
    { name: 'Hotels', icon: 'bed-outline', active: false },
    { name: 'Food', icon: 'restaurant-outline', active: false },
    { name: 'Explore', icon: 'map-outline', active: false },
    { name: 'Photos', icon: 'camera-outline', active: false },
  ];

  featuredHomestays: HomeHomestayItem[] = [
    {
      id: '101',
      name: 'The Dalat House',
      image: 'assets/images/login.jpg',
      location: 'Hồ Tuyền Lâm',
      rating: 4.9,
      price: '800.000 VND/đêm',
      lat: 11.908,
      lng: 108.456
    },
    {
      id: '102',
      name: 'Pine Hill Homestay',
      image: 'assets/images/register.jpeg',
      location: 'Phường 4, Đà Lạt',
      rating: 4.7,
      price: '650.000 VND/đêm',
      lat: 11.918,
      lng: 108.43
    },
    {
      id: '103',
      name: 'Valley View Villa',
      image: 'assets/images/login.jpg',
      location: 'Cầu Đất',
      rating: 4.8,
      price: '1.200.000 VND/đêm',
      lat: 11.84,
      lng: 108.56
    },
    {
      id: '104',
      name: 'Cozy Garden Stay',
      image: 'assets/images/register.jpeg',
      location: 'Phường 8',
      rating: 4.6,
      price: '550.000 VND/đêm',
      lat: 11.969,
      lng: 108.464
    },
  ];

  recommendedCafes: HomeCafeItem[] = [
    {
      id: '1',
      name: 'The Married Beans',
      image: 'assets/images/login.jpg',
      address: '12 Trần Phú, Đà Lạt',
      rating: 4.9,
      openTime: '7:00 - 22:00',
      phone: '0909 123 456',
      lat: 11.942,
      lng: 108.433
    },
    {
      id: '3',
      name: 'Là Việt Coffee',
      image: 'assets/images/register.jpeg',
      address: '200 Nguyễn Công Trứ',
      rating: 4.8,
      openTime: '6:30 - 21:30',
      phone: '0909 111 222',
      lat: 11.952,
      lng: 108.447
    },
    {
      id: '5',
      name: 'Windmills Coffee',
      image: 'assets/images/login.jpg',
      address: 'Hồ Tuyền Lâm',
      rating: 4.7,
      openTime: '7:00 - 23:00',
      phone: '0909 333 444',
      lat: 11.904,
      lng: 108.462
    },
  ];

  constructor(
    private navCtrl: NavController,
    private authService: AuthService,
    private placeDataService: PlaceDataService,
    private placeDbService: PlaceDbService
  ) {
    addIcons({
      notificationsOutline,
      searchOutline,
      optionsOutline,
      cafeOutline,
      bedOutline,
      restaurantOutline,
      mapOutline,
      cameraOutline,
      star,
      heartOutline,
      locationOutline,
      timeOutline,
      location,
      chevronDownOutline,
      navigateOutline
    });
  }

  ngOnInit() {
    this.profileSubscription = this.authService.profile$.subscribe((profile) => {
      if (!profile) {
        this.userName = 'Coffee Lover';
        this.userAvatar = 'assets/icon/Icon_app.png';
        return;
      }

      this.userName = profile.fullName || 'Coffee Lover';
      this.userAvatar = profile.avatar || 'assets/icon/Icon_app.png';
    });

    void this.loadHomeDataFromFirebase();
  }

  ngOnDestroy() {
    this.profileSubscription?.unsubscribe();
  }

  get filteredHomestays() {
    const keyword = this.searchText.trim().toLowerCase();
    if (!keyword) {
      return this.featuredHomestays;
    }

    return this.featuredHomestays.filter((item) =>
      item.name.toLowerCase().includes(keyword) ||
      item.location.toLowerCase().includes(keyword) ||
      item.price.toLowerCase().includes(keyword)
    );
  }

  get filteredCafes() {
    const keyword = this.searchText.trim().toLowerCase();
    if (!keyword) {
      return this.recommendedCafes;
    }

    return this.recommendedCafes.filter((item) =>
      item.name.toLowerCase().includes(keyword) ||
      item.address.toLowerCase().includes(keyword) ||
      item.openTime.toLowerCase().includes(keyword)
    );
  }

  selectCategory(category: any) {
    this.categories.forEach(cat => cat.active = false);
    category.active = true;
  }

  openPlaceDetail(place: any, type: 'cafe' | 'homestay') {
    const typeLabel = type === 'cafe' ? 'Quán Cafe' : 'Homestay';
    const address = place.address ?? place.location ?? 'Đà Lạt';

    this.navCtrl.navigateForward('/place-detail', {
      state: {
        place: {
          id: place.id,
          appId: this.resolveAppIdForPlace(place),
          name: place.name,
          type: typeLabel,
          address,
          googlePlaceResourceName:
            place.googlePlaceResourceName ??
            getGooglePlaceResourceByAppId(this.resolveAppIdForPlace(place)),
          rating: place.rating,
          distance: place.distance ?? 'Đang cập nhật',
          lat: place.lat,
          lng: place.lng,
          openTime: place.openTime,
          phone: place.phone,
          price: place.price,
        },
      },
    });
  }

  openDirections(place: any, type: 'cafe' | 'homestay', event?: Event) {
    event?.stopPropagation();

    const location = place.address ?? place.location ?? 'Đà Lạt';
    const normalizedType: 'cafe' | 'homestay' = type === 'homestay' ? 'homestay' : 'cafe';

    this.navCtrl.navigateForward('/tabs/location', {
      state: {
        directionRequest: {
          id: place.id,
          name: place.name,
          type: normalizedType,
          location,
          rating: place.rating,
          distanceKm: this.parseDistanceKm(place.distance),
          lat: place.lat,
          lng: place.lng,
        },
        askStartNavigation: false,
        requestKey: `${place.id ?? place.name}-${Date.now()}`,
      },
    });
  }

  private parseDistanceKm(distanceValue: unknown): number {
    if (typeof distanceValue === 'number' && Number.isFinite(distanceValue)) {
      return distanceValue;
    }

    if (typeof distanceValue !== 'string') {
      return 0;
    }

    const normalized = distanceValue.trim().toLowerCase();
    if (!normalized) {
      return 0;
    }

    if (normalized.endsWith('km')) {
      const kmValue = Number.parseFloat(normalized.replace('km', '').trim());
      return Number.isFinite(kmValue) ? kmValue : 0;
    }

    if (normalized.endsWith('m')) {
      const meterValue = Number.parseFloat(normalized.replace('m', '').trim());
      return Number.isFinite(meterValue) ? meterValue / 1000 : 0;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async loadHomeDataFromFirebase(): Promise<void> {
    try {
      const [cafes, homestays] = await Promise.all([
        this.placeDataService.getHomeCafes(),
        this.placeDataService.getHomeHomestays(),
      ]);

      if (cafes.length > 0) {
        this.recommendedCafes = cafes;
      }

      if (homestays.length > 0) {
        this.featuredHomestays = homestays;
      }
    } catch {
    }
  }

  private resolveAppIdForPlace(place: { appId?: number; id?: string | number }): number | undefined {
    if (typeof place.appId === 'number' && Number.isFinite(place.appId)) {
      return place.appId;
    }

    if (typeof place.id === 'number' && Number.isFinite(place.id)) {
      return place.id;
    }

    if (typeof place.id === 'string') {
      const parsed = Number(place.id);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }
}
