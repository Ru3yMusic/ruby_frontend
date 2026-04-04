import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Gender } from 'lib-ruby-core';
import { AuthTemplateComponent, ButtonComponent, GenderChipComponent } from 'lib-ruby-core-ui';
import { AuthState } from '../../state/auth.state';

interface GenderOption { label: string; value: Gender; }

@Component({
  selector: 'rm-register-gender',
  standalone: true,
  imports: [AuthTemplateComponent, GenderChipComponent, ButtonComponent],
  templateUrl: './register-gender.page.html',
  styleUrl: './register-gender.page.scss',
})
export class RegisterGenderPage {
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);

  selected = signal<Gender | null>(null);

  readonly options: GenderOption[] = [
    { label: 'Hombre',                value: 'MALE'              },
    { label: 'Mujer',                 value: 'FEMALE'            },
    { label: 'No binario',            value: 'NON_BINARY'        },
    { label: 'Otro',                  value: 'OTHER'             },
    { label: 'Prefiero no compartirlo', value: 'PREFER_NOT_TO_SAY' },
  ];

  select(g: Gender): void { this.selected.set(g); }

  onContinue(): void {
    if (!this.selected()) return;
    this.authState.patchDraft({ gender: this.selected()! });
    this.router.navigate(['/auth/register/name']);
  }
}
