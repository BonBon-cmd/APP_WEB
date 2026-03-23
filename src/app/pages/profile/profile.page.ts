import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline,
  compassOutline,
  documentTextOutline,
  chevronForwardOutline,
  arrowBack,
  cameraOutline
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { AppUserProfile } from '../../models/user-profile.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit {
  @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>;

  isEditing = false;
  isLoading = true;
  isUpdatingAvatar = false;
  errorMessage = '';
  successMessage = '';

  user = {
    name: '',
    gender: '',
    avatar: 'assets/images/register.jpeg',
    email: '',
    birthday: '',
    phone: '',
    role: 'user'
  };

  editForm = {
    name: '',
    email: '',
    birthday: '',
    phone: '',
    gender: ''
  };

  constructor(
    private navCtrl: NavController,
    private authService: AuthService
  ) {
    addIcons({
      createOutline,
      compassOutline,
      documentTextOutline,
      chevronForwardOutline,
      arrowBack,
      cameraOutline
    });
  }

  async ngOnInit() {
    await this.loadProfile();
  }

  openEditProfile() {
    this.isEditing = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.editForm = {
      name: this.user.name,
      email: this.user.email,
      birthday: this.user.birthday,
      phone: this.user.phone,
      gender: this.user.gender
    };
  }

  cancelEdit() {
    this.isEditing = false;
  }

  async saveProfile() {
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const updatedProfile = await this.authService.updateProfile({
        fullName: this.editForm.name,
        email: this.editForm.email,
        birthday: this.editForm.birthday,
        phone: this.editForm.phone,
        gender: this.editForm.gender,
      });

      this.applyProfile(updatedProfile);
      this.isEditing = false;
      this.successMessage = 'Cập nhật thông tin thành công.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.';
      this.errorMessage = message;
    }
  }

  changeAvatar() {
    this.avatarInput?.nativeElement.click();
  }

  async onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (file.size > 2 * 1024 * 1024) {
      this.errorMessage = 'Ảnh đại diện tối đa 2MB.';
      input.value = '';
      return;
    }

    this.isUpdatingAvatar = true;

    try {
      const avatarDataUrl = await this.toDataUrl(file);
      const updatedProfile = await this.authService.updateProfile({
        avatar: avatarDataUrl,
      });
      this.applyProfile(updatedProfile);
      this.successMessage = 'Đã cập nhật avatar.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật avatar.';
      this.errorMessage = message;
    } finally {
      this.isUpdatingAvatar = false;
      input.value = '';
    }
  }

  openGuide() {
    // Navigate to guide page
  }

  openTerms() {
    // Navigate to terms page
  }

  async logout() {
    await this.authService.logout();
    await this.navCtrl.navigateRoot('/login');
  }

  private async loadProfile() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.waitForInit();
      const profile = this.authService.currentProfile;

      if (!profile) {
        await this.navCtrl.navigateRoot('/login');
        return;
      }

      this.applyProfile(profile);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải hồ sơ.';
      this.errorMessage = message;
    } finally {
      this.isLoading = false;
    }
  }

  private applyProfile(profile: AppUserProfile) {
    this.user = {
      name: profile.fullName || 'Người dùng',
      gender: profile.gender || 'Chưa cập nhật',
      avatar: profile.avatar || 'assets/images/register.jpeg',
      email: profile.email,
      birthday: profile.birthday || '',
      phone: profile.phone || '',
      role: profile.role,
    };

    this.editForm = {
      name: this.user.name,
      email: this.user.email,
      birthday: this.user.birthday,
      phone: this.user.phone,
      gender: profile.gender || '',
    };
  }

  private toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
          return;
        }

        reject(new Error('Không đọc được ảnh đại diện.'));
      };

      reader.onerror = () => {
        reject(new Error('Không đọc được ảnh đại diện.'));
      };

      reader.readAsDataURL(file);
    });
  }
}
