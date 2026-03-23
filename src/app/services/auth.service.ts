import { Injectable } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateEmail,
} from 'firebase/auth';
import {
  Firestore,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import { AppUserProfile, AppUserRole, RegisterPayload } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = getAuth();
  private readonly db: Firestore = getFirestore();
  private readonly googleProvider = new GoogleAuthProvider();

  private readonly userSubject = new BehaviorSubject<User | null>(this.auth.currentUser);
  private readonly profileSubject = new BehaviorSubject<AppUserProfile | null>(null);

  private readonly initPromise: Promise<void>;

  constructor() {
    this.googleProvider.setCustomParameters({
      prompt: 'select_account',
    });

    void this.handleGoogleRedirectResult();

    this.initPromise = new Promise((resolve) => {
      let firstAuthStateHandled = false;

      onAuthStateChanged(this.auth, async (user) => {
        this.userSubject.next(user);

        if (user) {
          const profile = await this.loadProfile(user.uid);
          this.profileSubject.next(profile);
        } else {
          this.profileSubject.next(null);
        }

        if (!firstAuthStateHandled) {
          firstAuthStateHandled = true;
          resolve();
        }
      });
    });
  }

  get user$() {
    return this.userSubject.asObservable();
  }

  get profile$() {
    return this.profileSubject.asObservable();
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  get currentProfile(): AppUserProfile | null {
    return this.profileSubject.value;
  }

  get currentRole(): AppUserRole | null {
    return this.profileSubject.value?.role ?? null;
  }

  waitForInit(): Promise<void> {
    return this.initPromise;
  }

  async signIn(email: string, password: string): Promise<AppUserProfile | null> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const profile = await this.loadProfile(credential.user.uid);
    this.profileSubject.next(profile);
    return profile;
  }

  async signInWithGoogle(): Promise<AppUserProfile | null> {
    try {
      const credential = await signInWithPopup(this.auth, this.googleProvider);
      const profile = await this.syncGoogleProfile(credential.user);
      this.profileSubject.next(profile);
      return profile;
    } catch (error: unknown) {
      if (error instanceof FirebaseError && error.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(this.auth, this.googleProvider);
        return null;
      }

      throw error;
    }
  }

  async register(payload: RegisterPayload): Promise<AppUserProfile> {
    const credential = await createUserWithEmailAndPassword(
      this.auth,
      payload.email.trim(),
      payload.password
    );

    const profile: AppUserProfile = {
      uid: credential.user.uid,
      fullName: payload.fullName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      role: payload.role,
      status: 'active',
      avatar: 'assets/images/register.jpeg',
      birthday: '',
      gender: '',
    };

    await setDoc(doc(this.db, 'users', credential.user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (payload.role === 'admin') {
      await setDoc(doc(this.db, 'admins', credential.user.uid), {
        uid: credential.user.uid,
        fullName: payload.fullName.trim(),
        email: payload.email.trim(),
        phone: payload.phone.trim(),
        role: 'admin',
        status: 'active',
        permissions: ['manage_users', 'manage_cafes', 'manage_homestays'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    this.profileSubject.next(profile);
    return profile;
  }

  async sendResetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email.trim());
  }

  async updateProfile(
    updates: Partial<Pick<AppUserProfile, 'fullName' | 'phone' | 'birthday' | 'gender' | 'avatar' | 'email'>>
  ): Promise<AppUserProfile> {
    const user = this.currentUser;
    if (!user) {
      throw new Error('Bạn chưa đăng nhập.');
    }

    const current = this.currentProfile;
    const merged: AppUserProfile = {
      uid: user.uid,
      fullName: updates.fullName?.trim() || current?.fullName || '',
      email: updates.email?.trim() || current?.email || user.email || '',
      phone: updates.phone?.trim() || current?.phone || '',
      role: current?.role || 'user',
      status: current?.status || 'active',
      birthday: updates.birthday ?? current?.birthday ?? '',
      gender: updates.gender ?? current?.gender ?? '',
      avatar: updates.avatar ?? current?.avatar ?? 'assets/images/register.jpeg',
    };

    if (updates.email && updates.email.trim() && updates.email.trim() !== user.email) {
      await updateEmail(user, updates.email.trim());
    }

    await updateDoc(doc(this.db, 'users', user.uid), {
      fullName: merged.fullName,
      email: merged.email,
      phone: merged.phone,
      birthday: merged.birthday,
      gender: merged.gender,
      avatar: merged.avatar,
      updatedAt: serverTimestamp(),
    });

    if (merged.role === 'admin') {
      await updateDoc(doc(this.db, 'admins', user.uid), {
        fullName: merged.fullName,
        email: merged.email,
        phone: merged.phone,
        updatedAt: serverTimestamp(),
      });
    }

    this.profileSubject.next(merged);
    return merged;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.profileSubject.next(null);
  }

  formatAuthError(error: unknown): string {
    if (!(error instanceof FirebaseError)) {
      return error instanceof Error ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.';
    }

    switch (error.code) {
      case 'auth/configuration-not-found':
        return 'Firebase Authentication chưa được cấu hình cho project. Hãy vào Firebase Console > Authentication > Get started và bật Email/Password.';
      case 'auth/operation-not-allowed':
        return 'Phương thức đăng nhập Email/Password chưa được bật.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email hoặc mật khẩu không đúng.';
      case 'auth/email-already-in-use':
        return 'Email đã tồn tại, vui lòng dùng email khác.';
      case 'auth/invalid-email':
        return 'Địa chỉ email không hợp lệ.';
      case 'auth/weak-password':
        return 'Mật khẩu quá yếu, vui lòng dùng ít nhất 6 ký tự.';
      case 'auth/too-many-requests':
        return 'Bạn thao tác quá nhiều lần, vui lòng thử lại sau.';
      case 'auth/network-request-failed':
        return 'Không có kết nối mạng hoặc mạng không ổn định.';
      case 'auth/popup-closed-by-user':
        return 'Bạn đã đóng cửa sổ đăng nhập Google.';
      case 'auth/popup-blocked':
        return 'Trình duyệt chặn cửa sổ đăng nhập Google. Vui lòng cho phép pop-up và thử lại.';
      case 'auth/cancelled-popup-request':
        return 'Đã hủy yêu cầu đăng nhập Google trước đó.';
      default:
        return error.message || 'Đã có lỗi xác thực, vui lòng thử lại.';
    }
  }

  private async handleGoogleRedirectResult(): Promise<void> {
    try {
      const result = await getRedirectResult(this.auth);
      if (!result?.user) {
        return;
      }

      const profile = await this.syncGoogleProfile(result.user);
      this.profileSubject.next(profile);
    } catch {
      // Ignore redirect errors here to avoid interrupting auth state init.
    }
  }

  private async syncGoogleProfile(user: User): Promise<AppUserProfile> {
    const current = await this.loadProfile(user.uid);
    const userRef = doc(this.db, 'users', user.uid);

    const fallbackName = user.displayName?.trim() || 'Người dùng Google';
    const fallbackEmail = user.email?.trim() || '';
    const fallbackAvatar = user.photoURL || 'assets/images/register.jpeg';

    const profile: AppUserProfile = {
      uid: user.uid,
      fullName: current?.fullName || fallbackName,
      email: current?.email || fallbackEmail,
      phone: current?.phone || '',
      role: current?.role || 'user',
      status: current?.status || 'active',
      birthday: current?.birthday || '',
      gender: current?.gender || '',
      avatar: current?.avatar || fallbackAvatar,
    };

    if (current?.role !== 'admin') {
      await setDoc(
        userRef,
        {
          uid: profile.uid,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
          status: profile.status,
          birthday: profile.birthday,
          gender: profile.gender,
          avatar: profile.avatar,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return profile;
  }

  private async loadProfile(uid: string): Promise<AppUserProfile | null> {
    const userRef = doc(this.db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        uid,
        fullName: (data['fullName'] as string) ?? '',
        email: (data['email'] as string) ?? '',
        phone: (data['phone'] as string) ?? '',
        role: ((data['role'] as AppUserRole) ?? 'user'),
        status: ((data['status'] as 'active' | 'inactive') ?? 'active'),
        birthday: (data['birthday'] as string | undefined) ?? '',
        gender: (data['gender'] as string | undefined) ?? '',
        avatar: (data['avatar'] as string | undefined) ?? 'assets/images/register.jpeg',
      };
    }

    const adminRef = doc(this.db, 'admins', uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      return null;
    }

    const adminData = adminSnap.data();
    return {
      uid,
      fullName: (adminData['fullName'] as string) ?? '',
      email: (adminData['email'] as string) ?? '',
      phone: (adminData['phone'] as string) ?? '',
      role: 'admin',
      status: ((adminData['status'] as 'active' | 'inactive') ?? 'active'),
      birthday: '',
      gender: '',
      avatar: 'assets/images/register.jpeg',
    };
  }
}
