import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LoginUseCase } from 'lib-ruby-core';
import { AuthTemplateComponent, LoginFormComponent, LoginFormValue } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'rm-login',
  standalone: true,
  imports: [RouterLink, AuthTemplateComponent, LoginFormComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly loginUC   = inject(LoginUseCase);
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);

  loading     = signal(false);
  serverError = signal('');
  readonly mockLoginEnabled = environment.enableMockLogin;

  onMockAccess(): void {
    this.authState.setToken({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    this.router.navigate(['/home']);
  }

  onSubmit(value: LoginFormValue): void {
    if (this.mockLoginEnabled) {
      this.onMockAccess();
      return;
    }

    this.loading.set(true);
    this.serverError.set('');

    this.loginUC.execute(value.email, value.password).subscribe({
      next: token => {
        this.authState.setToken(token);
        this.router.navigate(['/home']);
      },
      error: () => {
        this.serverError.set('Correo o contraseña incorrectos.');
        this.loading.set(false);
      },
    });
  }
}
