import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { AuthShellBrandingComponent } from '../../components/auth-shell-branding/auth-shell-branding.component';
import { AuthEntryPanelComponent } from '../../components/auth-entry-panel/auth-entry-panel.component';
import { LoginPanelComponent } from '../../components/login-panel/login-panel.component';
import { RegisterEmailStepComponent } from '../../components/register-email-step/register-email-step.component';
import { AuthView } from '../../models/auth-view.type';
import { RegisterPasswordStepComponent } from '../../components/register-password-step/register-password-step.component';
import { RegisterBirthdateStepComponent } from '../../components/register-birthdate-step/register-birthdate-step.component';
import { RegisterGenderStepComponent } from '../../components/register-gender-step/register-gender-step.component';
import { RegisterNameStepComponent } from '../../components/register-name-step/register-name-step.component';
import { AuthState, CurrentUser } from '../../state/auth.state';

interface AuthUser {
  id: string;
  email: string;
  password: string;
  authProvider: 'EMAIL';
  name: string;
  birthDate: string;
  gender: string;
  avatarUrl: string | null;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'BLOCKED' | 'INACTIVE';
  blockReason: string | null;
  blockedAt: string | null;
  onboardingCompleted: boolean;
  selectedStationIds: string[];
  createdAt: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  status: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  createdAt: string;
  reportCount: number;
  blockReason: string | null;
  blockedAt: string | null;
}

interface ReportItem {
  id: string;
  reportedUserId: string;
  reason: string;
  createdAt: string;
}

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [
    CommonModule,
    AuthShellBrandingComponent,
    AuthEntryPanelComponent,
    LoginPanelComponent,
    RegisterEmailStepComponent,
    RegisterPasswordStepComponent,
    RegisterBirthdateStepComponent,
    RegisterGenderStepComponent,
    RegisterNameStepComponent,
  ],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {
  private readonly authState = inject(AuthState);

  private readonly AUTH_USERS_KEY = 'ruby_auth_users';
  private readonly ADMIN_USERS_KEY = 'ruby_users';
  private readonly REPORTS_KEY = 'ruby_reports';
  private readonly SEED_REPORTS_FLAG = '__seed_reports_done__';

  view: AuthView = 'entry';

  // =========================
  // ESTADO UI LOGIN BLOQUEADO
  // =========================
  readonly isBlockedAccountModalOpen = signal(false);
  readonly blockedAccountReason = signal('');
  readonly blockedAccountSupportEmail = 'soporte@rubytune.com';

  constructor() {
    this.ensureAdminSeed();
    this.seedTestReportUsers();
  }

  // =========================
  // NAVEGACIÓN BÁSICA
  // =========================
  goToEntry(): void {
    this.view = 'entry';
  }

  goToLogin(): void {
    this.closeBlockedAccountModal();
    this.view = 'login';
    console.log('Ir a login');
  }

  goToRegister(): void {
    this.authState.resetDraft();
    this.closeBlockedAccountModal();
    this.view = 'register-email';
    console.log('Ir a register email');
  }

  // =========================
  // LOGIN REAL
  // =========================
  onLoginSuccess(payload: { email: string; password: string }): void {
    this.closeBlockedAccountModal();

    const authUsers = this.loadAuthUsers();

    const user = authUsers.find(
      item => item.email.trim().toLowerCase() === payload.email.trim().toLowerCase()
    );

    if (!user) {
      console.warn('Usuario no encontrado');
      return;
    }

    if (user.password !== payload.password) {
      console.warn('Contraseña incorrecta');
      return;
    }

    if (user.status === 'BLOCKED') {
      this.blockedAccountReason.set(user.blockReason ?? 'Sin motivo especificado');
      this.isBlockedAccountModalOpen.set(true);

      console.warn(`Usuario bloqueado. Motivo: ${user.blockReason ?? 'Sin motivo'}`);
      return;
    }

    if (user.status === 'INACTIVE') {
      console.warn('Usuario inactivo');
      return;
    }

    const currentUser: CurrentUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      onboardingCompleted: user.onboardingCompleted,
      selectedStationIds: user.selectedStationIds,
    };

    this.authState.setCurrentUser(currentUser);
    this.authState.setPendingEmail(user.email);

    console.log('Login exitoso:', currentUser);

    if (user.role === 'ADMIN') {
      window.location.href = '/admin/dashboard';
      return;
    }

    if (!user.onboardingCompleted) {
      window.location.href = '/onboarding/stations';
      return;
    }

    window.location.href = '/user/home';
  }

  closeBlockedAccountModal(): void {
    this.isBlockedAccountModalOpen.set(false);
    this.blockedAccountReason.set('');
  }

  // =========================
  // FLUJO REGISTER + DRAFT
  // =========================
  goToRegisterPassword(data?: { email?: string }): void {
    if (data?.email) {
      this.authState.patchDraft({
        email: data.email,
      });
      console.log('Email capturado:', data);
    }

    this.view = 'register-password';
  }

  goToRegisterBirthdate(data: { password: string; confirmPassword: string }): void {
    this.authState.patchDraft({
      password: data.password,
      confirmPassword: data.confirmPassword,
    });

    console.log('Password step:', data);
    this.view = 'register-birthdate';
  }

  goToRegisterGender(data?: { birthDate?: string }): void {
    if (data?.birthDate) {
      this.authState.patchDraft({
        birthDate: data.birthDate,
      });
      console.log('Birthdate step:', data);
    }

    this.view = 'register-gender';
  }

  goToRegisterName(data: { gender: string }): void {
    this.authState.patchDraft({
      gender: data.gender,
    });

    console.log('Gender step:', data);
    this.view = 'register-name';
  }

  // =========================
  // FINALIZAR REGISTRO
  // =========================
  onRegisterComplete(data: {
    name: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
  }): void {
    this.authState.patchDraft({
      name: data.name,
      termsAccepted: data.termsAccepted,
      privacyAccepted: data.privacyAccepted,
    });

    const draft = this.authState.draft();
    const authUsers = this.loadAuthUsers();
    const normalizedEmail = (draft.email ?? '').trim().toLowerCase();

    const emailAlreadyExists = authUsers.some(
      user => user.email.trim().toLowerCase() === normalizedEmail
    );

    if (emailAlreadyExists) {
      console.warn('El correo ya existe:', normalizedEmail);
      return;
    }

    const now = new Date().toISOString();
    const id = this.generateId();

    const newAuthUser: AuthUser = {
      id,
      email: normalizedEmail,
      password: draft.password ?? '',
      authProvider: 'EMAIL',
      name: draft.name ?? '',
      birthDate: draft.birthDate ?? '',
      gender: draft.gender ?? '',
      avatarUrl: null,
      role: 'USER',
      status: 'ACTIVE',
      blockReason: null,
      blockedAt: null,
      onboardingCompleted: false,
      selectedStationIds: [],
      createdAt: now,
    };

    authUsers.push(newAuthUser);
    localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(authUsers));

    this.syncUserToAdmin(newAuthUser);

    const currentUser: CurrentUser = {
      id: newAuthUser.id,
      email: newAuthUser.email,
      name: newAuthUser.name,
      role: newAuthUser.role,
      status: newAuthUser.status,
      avatarUrl: newAuthUser.avatarUrl,
      onboardingCompleted: newAuthUser.onboardingCompleted,
      selectedStationIds: newAuthUser.selectedStationIds,
    };

    this.authState.setCurrentUser(currentUser);
    this.authState.setPendingEmail(newAuthUser.email);

    console.log('Registro completo:', newAuthUser);

    window.location.href = '/onboarding/stations';
  }

  // =========================
  // SEED ADMIN
  // =========================
  private ensureAdminSeed(): void {
    const authUsers = this.loadAuthUsers();

    const adminExists = authUsers.some(
      user => user.email.trim().toLowerCase() === 'admin@rubytune.com'
    );

    if (adminExists) return;

    const now = new Date().toISOString();

    const adminUser: AuthUser = {
      id: 'admin-seed-1',
      email: 'admin@rubytune.com',
      password: 'Admin123',
      authProvider: 'EMAIL',
      name: 'Administrador RubyTune',
      birthDate: '2000-01-01',
      gender: 'PREFIERO_NO_DECIR',
      avatarUrl: null,
      role: 'ADMIN',
      status: 'ACTIVE',
      blockReason: null,
      blockedAt: null,
      onboardingCompleted: true,
      selectedStationIds: [],
      createdAt: now,
    };

    authUsers.push(adminUser);
    localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(authUsers));

    this.syncUserToAdmin(adminUser);
  }

  // =========================
  // SEED USUARIOS + REPORTES DE PRUEBA
  // =========================
  private seedTestReportUsers(): void {
    const alreadySeeded = localStorage.getItem(this.SEED_REPORTS_FLAG);
    if (alreadySeeded) return;

    const authUsers = this.loadAuthUsers();
    const reports = this.loadReports();

    const createAuthUser = (
      id: string,
      name: string,
      email: string,
      createdAt: string
    ): AuthUser => ({
      id,
      email,
      password: 'Prueba12345678',
      authProvider: 'EMAIL',
      name,
      birthDate: '2000-01-01',
      gender: 'PREFIERO_NO_DECIR',
      avatarUrl: null,
      role: 'USER',
      status: 'ACTIVE',
      blockReason: null,
      blockedAt: null,
      onboardingCompleted: true,
      selectedStationIds: [],
      createdAt,
    });

    const reportUsersSeed: AuthUser[] = [
      createAuthUser('seed-user-1', 'Carlos Test', 'carlos@test.com', new Date().toISOString()),
      createAuthUser('seed-user-2', 'Andrea Test', 'andrea@test.com', new Date(Date.now() - 60_000).toISOString()),
      createAuthUser('seed-user-3', 'Luis Test', 'luis@test.com', new Date(Date.now() - 120_000).toISOString()),
      createAuthUser('seed-user-4', 'Camila Test', 'camila@test.com', new Date(Date.now() - 180_000).toISOString()),
      createAuthUser('seed-user-5', 'Diego Test', 'diego@test.com', new Date(Date.now() - 240_000).toISOString()),
    ];

    const usersToInsert = reportUsersSeed.filter(
      seedUser =>
        !authUsers.some(existing => existing.email.trim().toLowerCase() === seedUser.email.toLowerCase())
    );

    if (usersToInsert.length > 0) {
      const updatedAuthUsers = [...authUsers, ...usersToInsert];
      localStorage.setItem(this.AUTH_USERS_KEY, JSON.stringify(updatedAuthUsers));

      usersToInsert.forEach(user => this.syncUserToAdmin(user));
    }

    const existingReports = this.loadReports();
    const reportIds = new Set(existingReports.map(report => report.id));

    const now = new Date();

    const createReportDate = (offsetMinutes: number): string => {
      const d = new Date(now.getTime() - offsetMinutes * 60_000);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      return `${day}/${month}/${year}, ${hours}:${minutes}`;
    };

    const seededReports: ReportItem[] = [
      {
        id: 'seed-report-1',
        reportedUserId: 'seed-user-1',
        reason: 'Acoso o bullying',
        createdAt: createReportDate(10),
      },
      {
        id: 'seed-report-2',
        reportedUserId: 'seed-user-2',
        reason: 'Spam o publicidad',
        createdAt: createReportDate(20),
      },
      {
        id: 'seed-report-3',
        reportedUserId: 'seed-user-3',
        reason: 'Contenido inapropiado',
        createdAt: createReportDate(30),
      },
      {
        id: 'seed-report-4',
        reportedUserId: 'seed-user-3',
        reason: 'Contenido inapropiado',
        createdAt: createReportDate(40),
      },
      {
        id: 'seed-report-5',
        reportedUserId: 'seed-user-4',
        reason: 'Incita a la violencia',
        createdAt: createReportDate(50),
      },
      {
        id: 'seed-report-6',
        reportedUserId: 'seed-user-4',
        reason: 'Acoso o bullying',
        createdAt: createReportDate(60),
      },
      {
        id: 'seed-report-7',
        reportedUserId: 'seed-user-5',
        reason: 'Acoso o bullying',
        createdAt: createReportDate(70),
      },
      {
        id: 'seed-report-8',
        reportedUserId: 'seed-user-5',
        reason: 'Contenido inapropiado',
        createdAt: createReportDate(80),
      },
      {
        id: 'seed-report-9',
        reportedUserId: 'seed-user-5',
        reason: 'Incita a la violencia',
        createdAt: createReportDate(90),
      },
      {
        id: 'seed-report-10',
        reportedUserId: 'seed-user-5',
        reason: 'Spam o publicidad',
        createdAt: createReportDate(100),
      },
    ];

    const reportsToInsert = seededReports.filter(report => !reportIds.has(report.id));
    const updatedReports = [...reports, ...reportsToInsert];
    localStorage.setItem(this.REPORTS_KEY, JSON.stringify(updatedReports));

    this.syncAdminReportCounts(updatedReports);

    localStorage.setItem(this.SEED_REPORTS_FLAG, 'true');
    console.log('Seed de usuarios con reportes creado');
  }

  // =========================
  // HELPERS STORAGE
  // =========================
  private loadAuthUsers(): AuthUser[] {
    try {
      const raw = localStorage.getItem(this.AUTH_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadAdminUsers(): AdminUser[] {
    try {
      const raw = localStorage.getItem(this.ADMIN_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadReports(): ReportItem[] {
    try {
      const raw = localStorage.getItem(this.REPORTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private syncUserToAdmin(authUser: AuthUser): void {
    const adminUsers = this.loadAdminUsers();

    const existingIndex = adminUsers.findIndex(user => user.id === authUser.id);

    const reportCount = this.loadReports().filter(
      report => report.reportedUserId === authUser.id
    ).length;

    const adminUser: AdminUser = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      avatarUrl: authUser.avatarUrl ?? '',
      status: this.mapAuthStatusToAdminStatus(authUser.status),
      createdAt: authUser.createdAt,
      reportCount,
      blockReason: authUser.blockReason,
      blockedAt: authUser.blockedAt,
    };

    if (existingIndex >= 0) {
      adminUsers[existingIndex] = adminUser;
    } else {
      adminUsers.push(adminUser);
    }

    localStorage.setItem(this.ADMIN_USERS_KEY, JSON.stringify(adminUsers));
  }

  private syncAdminReportCounts(reportItems: ReportItem[]): void {
    const adminUsers = this.loadAdminUsers();

    const updatedAdminUsers = adminUsers.map(user => {
      const reportCount = reportItems.filter(
        report => report.reportedUserId === user.id
      ).length;

      return {
        ...user,
        reportCount,
      };
    });

    localStorage.setItem(this.ADMIN_USERS_KEY, JSON.stringify(updatedAdminUsers));
  }

  private mapAuthStatusToAdminStatus(
    status: AuthUser['status']
  ): AdminUser['status'] {
    if (status === 'BLOCKED') return 'BLOQUEADO';
    if (status === 'INACTIVE') return 'INACTIVO';
    return 'ACTIVO';
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}