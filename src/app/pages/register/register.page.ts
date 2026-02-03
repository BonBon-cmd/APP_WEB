import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class RegisterPage implements OnInit {
  email: string = '';
  password: string = '';
  phoneNumber: string = '';

  constructor(private router: Router) { }

  ngOnInit() {
  }

  register() {
    console.log('Register with:', this.email, this.password, this.phoneNumber);
    // Thêm logic đăng ký ở đây
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
