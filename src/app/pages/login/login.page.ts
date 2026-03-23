import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonInput,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class LoginPage implements OnInit {
  email: string = '';
  password: string = '';
  errorMessage = '';
  infoMessage = '';
  isSubmitting = false;
  isGoogleSubmitting = false;
  locationPermission: 'unknown' | 'granted' | 'denied' = 'unknown';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    void this.requestLocationPermission(false);
  }

  async login() {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Vui lòng nhập email và mật khẩu.';
      return;
    }

    this.isSubmitting = true;
    try {
      await this.requestLocationPermission(false);
      await this.authService.signIn(this.email, this.password);
      await this.router.navigate(['/tabs/home']);
    } catch (error: unknown) {
      this.errorMessage = `Không thể đăng nhập: ${this.authService.formatAuthError(error)}`;
    } finally {
      this.isSubmitting = false;
    }
  }

  async loginWithGoogle() {
    this.errorMessage = '';
    this.infoMessage = '';

    this.isGoogleSubmitting = true;
    try {
      await this.requestLocationPermission(false);
      const profile = await this.authService.signInWithGoogle();

      if (profile) {
        await this.router.navigate(['/tabs/home']);
      } else {
        this.infoMessage = 'Đang chuyển đến trang đăng nhập Google...';
      }
    } catch (error: unknown) {
      this.errorMessage = `Không thể đăng nhập Google: ${this.authService.formatAuthError(error)}`;
    } finally {
      this.isGoogleSubmitting = false;
    }
  }

  async requestLocationPermission(showSuccessMessage: boolean = true): Promise<boolean> {
    if (!navigator.geolocation) {
      this.locationPermission = 'denied';
      this.errorMessage = 'Thiết bị không hỗ trợ định vị.';
      return false;
    }

    const granted = await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        }
      );
    });

    this.locationPermission = granted ? 'granted' : 'denied';

    if (granted && showSuccessMessage) {
      this.infoMessage = 'Đã cấp quyền vị trí. Bạn có thể dùng tính năng chỉ đường.';
    }

    if (!granted) {
      this.infoMessage = 'Bạn chưa cấp quyền vị trí. Một số tính năng định vị có thể không hoạt động.';
    }

    return granted;
  }

  async forgotPassword() {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Nhập email trước khi dùng chức năng quên mật khẩu.';
      return;
    }

    try {
      await this.authService.sendResetPassword(this.email);
      this.infoMessage = 'Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.';
    } catch (error: unknown) {
      this.errorMessage = this.authService.formatAuthError(error);
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}
