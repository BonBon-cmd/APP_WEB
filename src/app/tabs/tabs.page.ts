import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, locationOutline, bookmarkOutline, personOutline } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { AppUserRole } from '../models/user-profile.model';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: true,
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    CommonModule,
    FormsModule
  ]
})
export class TabsPage implements OnInit {
  role: AppUserRole = 'user';
  canAccessBookmark = true;

  constructor(private authService: AuthService) {
    addIcons({ homeOutline, locationOutline, bookmarkOutline, personOutline });
  }

  ngOnInit() {
    this.authService.profile$.subscribe((profile) => {
      this.role = profile?.role ?? 'user';
      this.canAccessBookmark = this.role === 'user';
    });
  }

}
