import { Injectable, computed, inject, signal } from '@angular/core';
import {
  PlaylistResponse,
  PlaylistsApi,
} from 'lib-ruby-sdks/playlist-service';

/**
 * Global state para playlists que el usuario actual guardó (saved) de OTROS
 * usuarios. Usa los endpoints F2 cerrados en backend:
 *   - GET    /api/v1/playlists/my/saved
 *   - POST   /api/v1/playlists/{id}/save
 *   - DELETE /api/v1/playlists/{id}/save
 *
 * Carga inicial: hay que llamar `loadSavedPlaylists()` post-login (lo dispara
 * `user-layout` cuando hay sesión).
 *
 * Optimistic updates: `savePlaylist` y `unsavePlaylist` mueven el id en el
 * Set local antes de la respuesta HTTP. Si el server falla, se revierte.
 *
 * Importante — este state es complementario a `PlaylistState`. NO se mezcla
 * con `getMyPlaylists()` (esas son SOLO las propias). Las saved viven acá
 * para que la UI pueda preguntar `isPlaylistSaved(id)` desde cualquier lado.
 */
@Injectable({ providedIn: 'root' })
export class SavedPlaylistsState {
  private readonly playlistsApi = inject(PlaylistsApi);

  private readonly _savedIds = signal<Set<string>>(new Set());
  private readonly _savedList = signal<PlaylistResponse[]>([]);
  private readonly _loading = signal(false);
  private loaded = false;

  readonly savedList = this._savedList.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly savedCount = computed(() => this._savedIds().size);

  /**
   * Idempotente — solo dispara el GET una vez por sesión. Llamar al login.
   * Si querés forzar un refetch (e.g. después de un cascade de privacy=false
   * que limpia rows en el backend), pasá `force: true`.
   */
  loadSavedPlaylists(opts?: { force?: boolean }): void {
    if (this.loaded && !opts?.force) return;
    this._loading.set(true);
    this.playlistsApi.getMySavedPlaylists().subscribe({
      next: (list) => {
        this._savedList.set(list ?? []);
        this._savedIds.set(new Set((list ?? []).map(p => p.id ?? '').filter(Boolean)));
        this.loaded = true;
        this._loading.set(false);
      },
      error: () => {
        this._loading.set(false);
      },
    });
  }

  isPlaylistSaved(playlistId: string | undefined): boolean {
    if (!playlistId) return false;
    return this._savedIds().has(playlistId);
  }

  /**
   * Optimistic save: agrega el id al Set local, dispara POST, revierte si falla.
   * Acepta la `PlaylistResponse` para hidratar también `_savedList` en caliente
   * (así si la página de "mi biblioteca" lista las saved, aparece sin refetch).
   */
  savePlaylist(playlist: PlaylistResponse): void {
    const id = playlist.id;
    if (!id) return;
    if (this._savedIds().has(id)) return;

    this._savedIds.update(set => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
    this._savedList.update(list =>
      list.some(p => p.id === id) ? list : [...list, playlist],
    );

    this.playlistsApi.savePublicPlaylist(id).subscribe({
      error: () => this.revertSave(id),
    });
  }

  /**
   * Optimistic unsave: quita del Set local, dispara DELETE, revierte si falla.
   */
  unsavePlaylist(playlistId: string): void {
    if (!playlistId) return;
    if (!this._savedIds().has(playlistId)) return;

    const previousPlaylist = this._savedList().find(p => p.id === playlistId);

    this._savedIds.update(set => {
      const next = new Set(set);
      next.delete(playlistId);
      return next;
    });
    this._savedList.update(list => list.filter(p => p.id !== playlistId));

    this.playlistsApi.unsavePublicPlaylist(playlistId).subscribe({
      error: () => {
        if (previousPlaylist) this.revertUnsave(previousPlaylist);
      },
    });
  }

  clear(): void {
    this._savedIds.set(new Set());
    this._savedList.set([]);
    this.loaded = false;
  }

  private revertSave(id: string): void {
    this._savedIds.update(set => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this._savedList.update(list => list.filter(p => p.id !== id));
  }

  private revertUnsave(playlist: PlaylistResponse): void {
    const id = playlist.id;
    if (!id) return;
    this._savedIds.update(set => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
    this._savedList.update(list =>
      list.some(p => p.id === id) ? list : [...list, playlist],
    );
  }
}
