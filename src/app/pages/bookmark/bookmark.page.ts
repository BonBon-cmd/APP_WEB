import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cafe,
  bed,
  locationOutline,
  star,
  heart,
  bookmarkOutline,
  compassOutline
} from 'ionicons/icons';
import { getGooglePlaceResourceByAppId } from '../../data/google-place-id.map';
import { AuthService } from '../../services/auth.service';
import { BookmarkService, UserBookmark } from '../../services/bookmark.service';
import { Subscription } from 'rxjs';

interface BookmarkViewItem {
  id: string;
  appId?: number;
  name: string;
  type: 'cafe' | 'homestay';
  image: string;
  location: string;
  rating: number;
  lat: number;
  lng: number;
  savedDate: string;
  googlePlaceResourceName?: string;
}

@Component({
  selector: 'app-bookmark',
  templateUrl: './bookmark.page.html',
  styleUrls: ['./bookmark.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class BookmarkPage implements OnInit, OnDestroy {
  activeTab = 'all';

  bookmarks: BookmarkViewItem[] = [];

  filteredBookmarks: BookmarkViewItem[] = [];
  private currentSubscriptionUid: string | null = null;
  private bookmarksUnsubscribe: (() => void) | null = null;
  private authSubscription: Subscription | null = null;
  private isVerifyingEmptySnapshot = false;

  constructor(
    private navCtrl: NavController,
    private authService: AuthService,
    private bookmarkService: BookmarkService,
    private ngZone: NgZone
  ) {
    addIcons({
      cafe,
      bed,
      locationOutline,
      star,
      heart,
      bookmarkOutline,
      compassOutline
    });
  }

  async ngOnInit() {
    await this.authService.waitForInit();
    this.authSubscription = this.authService.user$.subscribe(() => {
      this.ensureBookmarkSubscription();
    });
    this.ensureBookmarkSubscription();
  }

  async ionViewWillEnter() {
    await this.authService.waitForInit();
    this.ensureBookmarkSubscription();
  }

  ngOnDestroy() {
    this.authSubscription?.unsubscribe();
    this.authSubscription = null;
    this.stopBookmarkSubscription();
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.filterBookmarks();
  }

  filterBookmarks() {
    if (this.activeTab === 'all') {
      this.filteredBookmarks = [...this.bookmarks];
    } else {
      this.filteredBookmarks = this.bookmarks.filter(b => b.type === this.activeTab);
    }
  }

  async removeBookmark(item: BookmarkViewItem, event: Event) {
    event.stopPropagation();

    const user = this.authService.currentUser;
    if (!user) {
      return;
    }

    try {
      await this.bookmarkService.removeUserBookmark(user.uid, item.type, item.id);
      this.bookmarks = this.bookmarks.filter((bookmark) => !(bookmark.type === item.type && bookmark.id === item.id));
      this.filterBookmarks();
    } catch (error) {
      console.warn('removeBookmark failed:', error);
    }
  }

  private ensureBookmarkSubscription(): void {
    const user = this.authService.currentUser;
    if (!user) {
      this.stopBookmarkSubscription();
      this.bookmarks = [];
      this.filterBookmarks();
      return;
    }

    if (this.bookmarksUnsubscribe && this.currentSubscriptionUid === user.uid) {
      void this.loadBookmarksOnce(user.uid);
      return;
    }

    this.stopBookmarkSubscription();
    this.bookmarks = [];
    this.filterBookmarks();
    this.currentSubscriptionUid = user.uid;
    this.isVerifyingEmptySnapshot = false;
    void this.loadBookmarksOnce(user.uid);
    this.bookmarksUnsubscribe = this.bookmarkService.watchUserBookmarks(user.uid, (bookmarks) => {
      this.ngZone.run(() => {
        void this.handleIncomingBookmarks(user.uid, bookmarks);
      });
    });
  }

  private async handleIncomingBookmarks(uid: string, incoming: UserBookmark[]): Promise<void> {
    const isSuspiciousEmpty = incoming.length === 0 && this.bookmarks.length > 0;
    if (!isSuspiciousEmpty) {
      this.applyBookmarks(incoming);
      return;
    }

    if (this.isVerifyingEmptySnapshot) {
      return;
    }

    this.isVerifyingEmptySnapshot = true;
    try {
      const verified = await this.bookmarkService.getUserBookmarks(uid);
      this.applyBookmarks(verified);
    } catch {
      // Keep current list when verification fails.
    } finally {
      this.isVerifyingEmptySnapshot = false;
    }
  }

  private async loadBookmarksOnce(uid: string): Promise<void> {
    try {
      const bookmarks = await this.bookmarkService.getUserBookmarks(uid);
      this.ngZone.run(() => {
        this.applyBookmarks(bookmarks);
      });
    } catch {
      // Keep existing list if initial load fails.
    }
  }

  private applyBookmarks(bookmarks: UserBookmark[]): void {
    this.bookmarks = bookmarks.map((item) => ({
      id: item.placeId,
      appId: item.appId,
      name: item.name,
      type: item.type,
      image: item.image,
      location: item.location,
      rating: Math.round(item.rating * 10) / 10,
      lat: item.lat,
      lng: item.lng,
      savedDate: this.formatSavedDate(item.savedAtMillis),
      googlePlaceResourceName: item.googlePlaceResourceName,
    }));

    this.filterBookmarks();
  }

  private stopBookmarkSubscription(): void {
    if (this.bookmarksUnsubscribe) {
      this.bookmarksUnsubscribe();
      this.bookmarksUnsubscribe = null;
    }

    this.currentSubscriptionUid = null;
  }

  private formatSavedDate(savedAtMillis: number): string {
    const savedDate = new Date(savedAtMillis);
    if (Number.isNaN(savedDate.getTime())) {
      return 'gần đây';
    }

    return savedDate.toLocaleDateString('vi-VN');
  }

  openDetail(item: BookmarkViewItem) {
    this.navCtrl.navigateForward('/place-detail', {
      state: {
        place: {
          id: item.id,
          appId: item.appId,
          name: item.name,
          type: item.type === 'cafe' ? 'Quán Cafe' : 'Homestay',
          address: item.location,
          image: item.image,
          googlePlaceResourceName: item.googlePlaceResourceName ?? getGooglePlaceResourceByAppId(item.appId),
          rating: item.rating,
          lat: item.lat,
          lng: item.lng,
        },
      },
    });
  }

  goExplore() {
    this.navCtrl.navigateForward('/tabs/home');
  }
}
