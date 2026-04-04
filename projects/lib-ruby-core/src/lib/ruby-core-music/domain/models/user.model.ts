export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BLOCKED';
export type AuthProvider = 'EMAIL' | 'GOOGLE';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface User {
  id: string;
  email: string;
  displayName: string;
  profilePhotoUrl: string | null;
  role: UserRole;
  status: UserStatus;
  authProvider: AuthProvider;
  isEmailVerified: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  birthDate: string; // ISO date YYYY-MM-DD
  gender: Gender;
  acceptedTerms: boolean;
  acceptedPrivacyPolicy: boolean;
}
