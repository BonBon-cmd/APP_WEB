import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import * as L from 'leaflet';
import { getGooglePlaceResourceByAppId } from '../../data/google-place-id.map';
import { PlaceDbService } from '../../services/place-db.service';
import {
  searchOutline,
  locationOutline,
  navigateOutline,
  cafeOutline,
  bedOutline,
  star,
  walkOutline,
  flagOutline,
  closeCircleOutline
} from 'ionicons/icons';

interface Place {
  id: string;
  appId?: number;
  name: string;
  type: 'cafe' | 'homestay';
  address: string;
  rating: number;
  distanceKm: number;
  lat: number;
  lng: number;
  slug?: string;
}

interface NavigationSummary {
  destinationName: string;
  instruction: string;
  distanceKm: number;
  etaMinutes: number;
  speedKmh: number;
  speedSource: 'device' | 'default';
}

interface RouteData {
  coordinates: L.LatLngExpression[];
  distanceKm: number | null;
}

interface DrawRouteResult {
  distanceKm: number | null;
  initialHeading: number | null;
}

@Component({
  selector: 'app-location',
  templateUrl: './location.page.html',
  styleUrls: ['./location.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class LocationPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  searchText = '';
  mapLoadError = '';
  selectedPlace: Place | null = null;
  isNavigating = false;
  navigationSummary: NavigationSummary | null = null;
  currentPosition: { lat: number; lng: number } | null = null;
  currentSpeedKmh: number | null = null;
  private pendingAutoStartDestination: Place | null = null;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private tileLoadSucceeded = false;
  private tileLoadedCount = 0;
  private tileErrorCount = 0;
  private tileProviderIndex = 0;
  private tileSwitchAttempts = 0;
  private tileFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private placeMarkers = new Map<string, L.CircleMarker>();
  private userMarker: L.CircleMarker | null = null;
  private routeLine: L.Polyline | null = null;
  private lastProcessedRequestKey: string | null = null;
  private legacyDirectionStateHandled = false;
  private popupActionClickHandler: ((event: Event) => void) | null = null;

  private readonly defaultLat = 11.9404;
  private readonly defaultLng = 108.4583;
  private readonly defaultZoom = 12;
  private readonly fallbackDrivingSpeedKmh = 30;
  private readonly roadRouteProviders = [
    'https://routing.openstreetmap.de/routed-car/route/v1/driving',
    'https://router.project-osrm.org/route/v1/driving',
  ];
  private readonly tileProviders: Array<{
    url: string;
    attribution: string;
    subdomains?: string;
  }> = [
    {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
    },
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
    },
    {
      url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
  ];

  places: Place[] = [];

  filteredPlaces: Place[] = [];

  constructor(
    private router: Router,
    private alertController: AlertController,
    private placeDbService: PlaceDbService,
    private ngZone: NgZone
  ) {
    addIcons({
      searchOutline,
      locationOutline,
      navigateOutline,
      cafeOutline,
      bedOutline,
      star,
      walkOutline,
      flagOutline,
      closeCircleOutline
    });
  }

  ngOnInit() {
    this.registerPopupActionHandler();
    void this.loadPlacesFromFirebase();
    void this.handleDirectionRequest();
    void this.refreshCurrentPosition();
  }

  private async loadPlacesFromFirebase() {
    try {
      const allPlaces = await this.placeDbService.getAllPlaces();
      this.places = allPlaces.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        address: p.address,
        rating: p.rating,
        distanceKm: this.calculateDistance(this.currentPosition, { lat: p.lat, lng: p.lng }),
        appId: p.appId,
        lat: p.lat,
        lng: p.lng,
        slug: p.slug,
      }));
      this.applyFilters();
    } catch {
      console.warn('Failed to load places from Firebase, using empty list');
      this.places = [];
      this.applyFilters();
    }
  }

  private calculateDistance(
    from: { lat: number; lng: number } | null,
    to: { lat: number; lng: number }
  ): number {
    const start = from || { lat: this.defaultLat, lng: this.defaultLng };
    const R = 6371;
    const dLat = ((to.lat - start.lat) * Math.PI) / 180;
    const dLng = ((to.lng - start.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((start.lat * Math.PI) / 180) *
        Math.cos((to.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  ngAfterViewInit() {
    void this.safeInitializeMap().then(() => {
      if (this.pendingAutoStartDestination) {
        const destination = this.pendingAutoStartDestination;
        this.pendingAutoStartDestination = null;
        void this.startInAppNavigation(destination);
      }
    });
  }

  ionViewDidEnter() {
    void this.handleDirectionRequest();

    requestAnimationFrame(() => {
      this.map?.invalidateSize();

      if (this.pendingAutoStartDestination) {
        const destination = this.pendingAutoStartDestination;
        this.pendingAutoStartDestination = null;
        void this.startInAppNavigation(destination);
      }
    });

    setTimeout(() => this.map?.invalidateSize(), 180);
    setTimeout(() => this.map?.invalidateSize(), 450);
  }

  ngOnDestroy() {
    this.unregisterPopupActionHandler();
    this.isNavigating = false;
    if (this.tileFallbackTimer) {
      clearTimeout(this.tileFallbackTimer);
      this.tileFallbackTimer = null;
    }
    this.map?.remove();
    this.map = null;
  }

  applyFilters() {
    this.filteredPlaces = [...this.places];

    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase();
      this.filteredPlaces = this.filteredPlaces.filter(place =>
        place.name.toLowerCase().includes(search) ||
        place.address.toLowerCase().includes(search)
      );
    }

    this.filteredPlaces = this.filteredPlaces.sort((a, b) => a.distanceKm - b.distanceKm);

    if (this.selectedPlace && !this.filteredPlaces.some((place) => place.id === this.selectedPlace?.id)) {
      this.selectedPlace = null;
      this.stopNavigation();
    }

    if (this.filteredPlaces.length > 0) {
      if (!this.selectedPlace && !this.isNavigating) {
        const nearestPlace = this.filteredPlaces[0];
        this.selectedPlace = nearestPlace;
        this.zoomToCoordinates(nearestPlace.lat, nearestPlace.lng, 15);
      }

      this.syncPlaceMarkers();
    } else {
      this.syncPlaceMarkers();
      this.centerToCurrentOrDefault();
    }
  }

  centerToCurrentOrDefault() {
    this.stopNavigation();
    const center = this.currentPosition ?? { lat: this.defaultLat, lng: this.defaultLng };
    this.zoomToCoordinates(center.lat, center.lng, this.defaultZoom);
  }

  selectPlace(place: Place) {
    this.selectedPlace = place;
    this.syncPlaceMarkers();
    this.zoomToCoordinates(place.lat, place.lng, 15);
    this.openMarkerPopup(place.id);
  }

  selectPlaceById(placeId: string) {
    const place = this.filteredPlaces.find((item) => item.id === placeId);
    if (!place) {
      return;
    }

    this.selectPlace(place);
  }

  openDetail(place: Place) {
    const typeLabel = place.type === 'cafe' ? 'Quán Cafe' : 'Homestay';
    const parsedAppId = Number.parseInt(place.id, 10);
    const appId = Number.isFinite(parsedAppId) ? parsedAppId : undefined;
    void this.router.navigate(['/place-detail'], {
      state: {
        place: {
          id: place.id,
          appId: place.appId,
          name: place.name,
          type: typeLabel,
          address: place.address,
          googlePlaceResourceName: getGooglePlaceResourceByAppId(appId),
          rating: place.rating,
          distance: `${place.distanceKm}km`,
          lat: place.lat,
          lng: place.lng,
        },
      },
    });
  }

  async promptNavigationConfirm() {
    if (!this.selectedPlace) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Bắt đầu chỉ đường?',
      message: `Bắt đầu chỉ đường đến ${this.selectedPlace.name}?`,
      buttons: [
        {
          text: 'Hủy',
          role: 'cancel',
        },
        {
          text: 'Bắt đầu',
          handler: () => {
            void this.startInAppNavigation(this.selectedPlace!);
          },
        },
      ],
    });

    await alert.present();
  }

  stopNavigation() {
    this.isNavigating = false;
    this.navigationSummary = null;
    this.clearRoute();
  }

  private async handleDirectionRequest() {
    const navState = history.state as {
      directionRequest?: Partial<Place>;
      askStartNavigation?: boolean;
      requestKey?: string;
    };

    if (!navState.directionRequest?.name) {
      return;
    }

    const requestKey = typeof navState.requestKey === 'string' ? navState.requestKey : '';
    if (requestKey) {
      if (requestKey === this.lastProcessedRequestKey) {
        return;
      }
      this.lastProcessedRequestKey = requestKey;
    } else {
      if (this.legacyDirectionStateHandled) {
        return;
      }
      this.legacyDirectionStateHandled = true;
    }

    const destination = this.upsertDirectionPlace(navState.directionRequest);
    this.focusPlace(destination);

    // Keep destination synced from other tabs, but always let user tap "Bat dau" manually.
    this.pendingAutoStartDestination = null;
  }

  private focusPlace(place: Place) {
    this.selectedPlace = place;
    this.searchText = place.name;
    this.applyFilters();
    this.zoomToCoordinates(place.lat, place.lng, 15);
  }

  private upsertDirectionPlace(directionRequest: Partial<Place>): Place {
    const fallbackType: Place['type'] = directionRequest.type === 'homestay' ? 'homestay' : 'cafe';
    const fallbackPlace: Place = {
      id: directionRequest.id ?? String(Date.now()),
      name: directionRequest.name ?? 'Điểm đến',
      type: fallbackType,
      address: directionRequest.address ?? 'Đà Lạt',
      rating: directionRequest.rating ?? 4.5,
      distanceKm: directionRequest.distanceKm ?? 1,
      lat: directionRequest.lat ?? this.defaultLat,
      lng: directionRequest.lng ?? this.defaultLng,
    };

    const existing = this.places.find(
      (place) => place.id === fallbackPlace.id || place.name === fallbackPlace.name
    );

    if (!existing) {
      this.places = [fallbackPlace, ...this.places];
      return fallbackPlace;
    }

    existing.type = fallbackPlace.type;
    existing.address = fallbackPlace.address;
    existing.rating = fallbackPlace.rating;
    existing.distanceKm = fallbackPlace.distanceKm;
    existing.lat = fallbackPlace.lat;
    existing.lng = fallbackPlace.lng;
    return existing;
  }

  private async startInAppNavigation(destination: Place) {
    const current = await this.refreshCurrentPosition();
    const route = await this.drawNavigationRoute(current, destination);
    const fallbackHeading = this.calculateBearing(current.lat, current.lng, destination.lat, destination.lng);
    const instruction = this.buildDirectionInstruction(route?.initialHeading ?? fallbackHeading);
    const routeDistanceKm = route?.distanceKm ?? null;
    const distanceKm = routeDistanceKm ?? this.calculateDistanceKm(current.lat, current.lng, destination.lat, destination.lng);
    const speed = this.resolveDrivingSpeed();
    const etaMinutes = Math.max(1, Math.round((distanceKm / Math.max(speed.speedKmh, 5)) * 60));

    this.navigationSummary = {
      destinationName: destination.name,
      instruction,
      distanceKm: Math.round(distanceKm * 10) / 10,
      etaMinutes,
      speedKmh: speed.speedKmh,
      speedSource: speed.speedSource,
    };
    this.isNavigating = true;
  }

  async refreshCurrentPosition(): Promise<{ lat: number; lng: number }> {
    const current = await this.getCurrentPosition();
    this.currentPosition = { lat: current.lat, lng: current.lng };
    this.currentSpeedKmh = current.speedKmh;
    this.updateUserMarker();

    if (!this.selectedPlace && !this.isNavigating) {
      this.zoomToCoordinates(current.lat, current.lng, this.defaultZoom);
    }

    return current;
  }

  private getCurrentPosition(): Promise<{ lat: number; lng: number; speedKmh: number | null }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const fallback = { lat: this.defaultLat, lng: this.defaultLng, speedKmh: null };
        resolve(fallback);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const speedKmh =
            typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
              ? Math.max(0, position.coords.speed * 3.6)
              : null;

          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speedKmh,
          });
        },
        () => {
          resolve({ lat: this.defaultLat, lng: this.defaultLng, speedKmh: null });
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        }
      );
    });
  }

  private calculateDistanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadian(toLat - fromLat);
    const dLng = this.toRadian(toLng - fromLng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadian(fromLat)) * Math.cos(this.toRadian(toLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private buildDirectionInstruction(bearing: number): string {
    const normalized = (bearing + 360) % 360;
    const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
    const index = Math.round(normalized / 45) % 8;
    return `Di chuyển theo hướng ${directions[index]} đến ${this.selectedPlace?.name ?? 'điểm đến'}.`;
  }

  private calculateBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const y = Math.sin(this.toRadian(toLng - fromLng)) * Math.cos(this.toRadian(toLat));
    const x =
      Math.cos(this.toRadian(fromLat)) * Math.sin(this.toRadian(toLat)) -
      Math.sin(this.toRadian(fromLat)) * Math.cos(this.toRadian(toLat)) *
      Math.cos(this.toRadian(toLng - fromLng));

    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  private toRadian(value: number): number {
    return (value * Math.PI) / 180;
  }

  private initializeMap() {
    if (this.map || !this.mapContainer) {
      return;
    }

    const center = this.currentPosition ?? {
      lat: this.selectedPlace?.lat ?? this.defaultLat,
      lng: this.selectedPlace?.lng ?? this.defaultLng,
    };

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      minZoom: 5,
      maxZoom: 19,
    }).setView([center.lat, center.lng], this.defaultZoom);

    this.addBaseTileLayer();

    this.syncPlaceMarkers();
    this.updateUserMarker();

    if (this.selectedPlace) {
      this.zoomToCoordinates(this.selectedPlace.lat, this.selectedPlace.lng, 15);
    }

    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });
  }

  private async safeInitializeMap() {
    try {
      this.initializeMap();
      this.mapLoadError = '';
    } catch {
      this.mapLoadError = 'Không thể tải bản đồ lúc này. Vui lòng thử lại sau.';
    }
  }

  private addBaseTileLayer() {
    if (!this.map) {
      return;
    }

    this.tileProviderIndex = 0;
    this.tileSwitchAttempts = 0;
    this.applyTileProvider(this.tileProviderIndex);
  }

  private applyTileProvider(providerIndex: number) {
    if (!this.map) {
      return;
    }

    if (this.tileProviders.length === 0) {
      this.mapLoadError = 'Không thể tải nền bản đồ. Vui lòng kiểm tra kết nối mạng.';
      return;
    }

    const normalizedIndex = ((providerIndex % this.tileProviders.length) + this.tileProviders.length) % this.tileProviders.length;
    const provider = this.tileProviders[normalizedIndex];
    this.tileProviderIndex = normalizedIndex;

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
      this.tileLayer = null;
    }

    this.tileLoadSucceeded = false;
    this.tileLoadedCount = 0;
    this.tileErrorCount = 0;
    if (this.tileFallbackTimer) {
      clearTimeout(this.tileFallbackTimer);
      this.tileFallbackTimer = null;
    }

    const tileOptions: L.TileLayerOptions = {
      maxZoom: 19,
      attribution: provider.attribution,
    };

    if (provider.subdomains) {
      tileOptions.subdomains = provider.subdomains;
    }

    this.tileLayer = L.tileLayer(provider.url, tileOptions);

    this.tileLayer.on('tileload', () => {
      this.tileLoadSucceeded = true;
      this.tileLoadedCount += 1;
      if (this.tileLoadedCount >= 8 && this.tileErrorCount <= Math.floor(this.tileLoadedCount / 2)) {
        this.tileSwitchAttempts = 0;
      }
      this.mapLoadError = '';
    });

    this.tileLayer.on('tileerror', () => {
      this.tileErrorCount += 1;

      // Switch provider when current source keeps failing and leaves blank blocks.
      if (this.tileErrorCount < 8 && this.tileErrorCount < this.tileLoadedCount * 2) {
        return;
      }

      this.switchTileProvider();
    });

    this.tileLayer.addTo(this.map);

    this.tileFallbackTimer = setTimeout(() => {
      if (this.tileLoadedCount > 6 && this.tileErrorCount <= this.tileLoadedCount) {
        return;
      }

      this.switchTileProvider();
    }, 3200);
  }

  private switchTileProvider() {
    if (!this.map) {
      return;
    }

    this.tileSwitchAttempts += 1;
    const maxAttempts = this.tileProviders.length * 3;

    if (this.tileSwitchAttempts > maxAttempts) {
      this.mapLoadError = 'Mạng hiện tại đang không ổn định, bản đồ có thể hiển thị thiếu một vài ô.';
      this.tileLayer?.redraw();
      this.map.invalidateSize();
      return;
    }

    this.applyTileProvider(this.tileProviderIndex + 1);
  }

  private syncPlaceMarkers() {
    if (!this.map) {
      return;
    }

    const visibleIds = new Set(this.filteredPlaces.map((place) => place.id));

    for (const [placeId, marker] of this.placeMarkers.entries()) {
      if (!visibleIds.has(placeId)) {
        this.map.removeLayer(marker);
        this.placeMarkers.delete(placeId);
      }
    }

    for (const place of this.filteredPlaces) {
      let marker = this.placeMarkers.get(place.id);
      if (!marker) {
        marker = L.circleMarker([place.lat, place.lng], {
          radius: 8,
          color: '#ffffff',
          weight: 2,
          fillColor: place.type === 'cafe' ? '#8a5f3d' : '#7a5f4e',
          fillOpacity: 0.95,
        });

        marker.on('click', () => {
          this.selectPlace(place);
          marker?.openPopup();
        });

        marker.bindPopup(this.buildPlacePopupContent(place), {
          className: 'place-mini-popup',
          closeButton: false,
          autoPan: true,
          offset: [0, -10],
          maxWidth: 250,
        });

        marker.addTo(this.map);
        this.placeMarkers.set(place.id, marker);
      }

      const isActive = this.selectedPlace?.id === place.id;
      marker.setStyle({
        radius: isActive ? 11 : 8,
        weight: isActive ? 3 : 2,
      });
      marker.setPopupContent(this.buildPlacePopupContent(place));
    }
  }

  private registerPopupActionHandler() {
    if (this.popupActionClickHandler || typeof document === 'undefined') {
      return;
    }

    this.popupActionClickHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('.mini-open-detail-btn') as HTMLButtonElement | null;
      if (!button) {
        return;
      }

      const placeId = button.dataset['placeId']?.trim();
      if (!placeId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const place = this.filteredPlaces.find((item) => item.id === placeId)
        ?? this.places.find((item) => item.id === placeId);

      if (!place) {
        return;
      }

      this.ngZone.run(() => {
        this.openDetail(place);
      });
    };

    document.addEventListener('click', this.popupActionClickHandler, true);
  }

  private unregisterPopupActionHandler() {
    if (!this.popupActionClickHandler || typeof document === 'undefined') {
      return;
    }

    document.removeEventListener('click', this.popupActionClickHandler, true);
    this.popupActionClickHandler = null;
  }

  private openMarkerPopup(placeId: string) {
    const marker = this.placeMarkers.get(placeId);
    marker?.openPopup();
  }

  private buildPlacePopupContent(place: Place): string {
    const typeLabel = place.type === 'cafe' ? 'Quán Cafe' : 'Homestay';
    const safeName = this.escapeHtml(place.name);
    const safeAddress = this.escapeHtml(place.address);
    const safeRating = Number.isFinite(place.rating) ? place.rating.toFixed(1) : '0.0';

    return `
      <div class="place-mini-card">
        <div class="mini-type">${typeLabel}</div>
        <div class="mini-name">${safeName}</div>
        <div class="mini-address">${safeAddress}</div>
        <div class="mini-meta">⭐ ${safeRating}</div>
        <button type="button" class="mini-open-detail-btn" data-place-id="${this.escapeHtml(place.id)}">Xem chi tiết</button>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private updateUserMarker() {
    if (!this.map || !this.currentPosition) {
      return;
    }

    const latLng: L.LatLngExpression = [this.currentPosition.lat, this.currentPosition.lng];

    if (!this.userMarker) {
      this.userMarker = L.circleMarker(latLng, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
      })
        .bindTooltip('Vị trí của bạn', {
          direction: 'top',
          offset: [0, -8],
        })
        .addTo(this.map);
      return;
    }

    this.userMarker.setLatLng(latLng);
  }

  private async drawNavigationRoute(from: { lat: number; lng: number }, destination: Place): Promise<DrawRouteResult | null> {
    if (!this.map) {
      return null;
    }

    const routeData = await this.fetchRouteData(from, {
      lat: destination.lat,
      lng: destination.lng,
    });

    this.clearRoute();

    if (!routeData) {
      this.mapLoadError = 'Không lấy được tuyến đường theo đường phố. Vui lòng thử lại.';
      return null;
    }

    this.mapLoadError = '';

    this.routeLine = L.polyline(routeData.coordinates, {
      color: '#1d4ed8',
      weight: 5,
      opacity: 0.9,
    }).addTo(this.map);

    this.map.fitBounds(this.routeLine.getBounds(), {
      padding: [30, 30],
    });

    return {
      distanceKm: routeData.distanceKm,
      initialHeading: this.resolveInitialRouteHeading(routeData.coordinates),
    };
  }

  private clearRoute() {
    if (this.routeLine && this.map) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  private async fetchRouteData(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): Promise<RouteData | null> {
    for (const baseUrl of this.roadRouteProviders) {
      const route = await this.fetchRouteFromProvider(baseUrl, from, to);
      if (route) {
        return route;
      }
    }

    return null;
  }

  private async fetchRouteFromProvider(
    baseUrl: string,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): Promise<RouteData | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    try {
      const response = await fetch(
        `${baseUrl}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
        {
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        routes?: Array<{
          distance?: number;
          geometry?: {
            coordinates?: number[][];
          };
        }>;
      };

      const route = data.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) {
        return null;
      }

      return {
        coordinates: coordinates.map(([lng, lat]) => [lat, lng]),
        distanceKm: typeof route?.distance === 'number' ? route.distance / 1000 : null,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveInitialRouteHeading(coordinates: L.LatLngExpression[]): number | null {
    for (let index = 1; index < coordinates.length; index += 1) {
      const previous = this.toLatLngPair(coordinates[index - 1]);
      const current = this.toLatLngPair(coordinates[index]);
      if (!previous || !current) {
        continue;
      }

      const segmentDistanceKm = this.calculateDistanceKm(previous.lat, previous.lng, current.lat, current.lng);
      if (segmentDistanceKm < 0.01) {
        continue;
      }

      return this.calculateBearing(previous.lat, previous.lng, current.lat, current.lng);
    }

    return null;
  }

  private toLatLngPair(value: L.LatLngExpression): { lat: number; lng: number } | null {
    if (value instanceof L.LatLng) {
      return { lat: value.lat, lng: value.lng };
    }

    if (Array.isArray(value) && value.length >= 2) {
      const [lat, lng] = value;
      if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    return null;
  }

  private resolveDrivingSpeed(): { speedKmh: number; speedSource: 'device' | 'default' } {
    if (typeof this.currentSpeedKmh === 'number' && this.currentSpeedKmh >= 5) {
      return {
        speedKmh: Math.round(this.currentSpeedKmh),
        speedSource: 'device',
      };
    }

    return {
      speedKmh: this.fallbackDrivingSpeedKmh,
      speedSource: 'default',
    };
  }

  private zoomToCoordinates(lat: number, lng: number, zoom: number) {
    if (!this.map) {
      return;
    }

    this.map.setView([lat, lng], zoom, {
      animate: true,
    });
  }
}
