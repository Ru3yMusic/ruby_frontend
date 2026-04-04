import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Camera, ChevronLeft } from 'lucide-angular';
import { UserProfileState } from '../../state/user-profile.state';

@Component({
  selector: 'rm-editar-perfil-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './editar-perfil.page.html',
  styleUrl: './editar-perfil.page.scss',
})
export class EditarPerfilPage {
  readonly Camera      = Camera;
  readonly ChevronLeft = ChevronLeft;
  private readonly router = inject(Router);
  readonly profileState = inject(UserProfileState);

  readonly displayName = signal(this.profileState.profile().displayName);
  readonly photoPreview = signal<string | null>(this.profileState.profile().photoUrl);

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  save(): void {
    const name = this.displayName().trim();
    if (!name) return;
    this.profileState.updateProfile({
      displayName: name,
      photoUrl: this.photoPreview(),
    });
    this.router.navigate(['/home']);
  }
}
