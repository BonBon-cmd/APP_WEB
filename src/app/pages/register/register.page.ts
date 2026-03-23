import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonButton,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import { AppUserRole } from '../../models/user-profile.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonInput,
    IonButton,
    IonSelect,
    IonSelectOption,
    CommonModule,
    FormsModule
  ]
})
export class RegisterPage implements OnInit {
  fullName: string = '';
  email: string = '';
  password: string = '';
  phoneNumber: string = '';
  role: AppUserRole = 'user';
  errorMessage = '';
  isSubmitting = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit() {
  }

  async register() {
    this.errorMessage = '';

    if (!this.fullName.trim() || !this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự.';
      return;
    }

    this.isSubmitting = true;

    try {
      await this.authService.register({
        fullName: this.fullName,
        email: this.email,
        password: this.password,
        phone: this.phoneNumber,
        role: this.role,
      });

      await this.router.navigate(['/tabs/home']);
    } catch (error: unknown) {
      this.errorMessage = `Không thể tạo tài khoản: ${this.authService.formatAuthError(error)}`;
    } finally {
      this.isSubmitting = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
