import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

/**
 * Reemplaza el src de una <img> por un placeholder cuando la URL externa
 * (Cloudinary, avatar de auth-service, etc.) responde error de carga
 * (404, network fail, CORS). Sin esto, el img queda con icono roto.
 *
 * Uso:
 *   <img [src]="album.coverUrl || defaultAlbumCover"
 *        [imgFallback]="defaultAlbumCover" alt="..." />
 *
 * El check `endsWith(fallback)` evita un loop si el fallback mismo falla
 * (no debería, son assets locales, pero es defensa barata).
 */
@Directive({
  selector: 'img[imgFallback]',
  standalone: true,
})
export class ImgFallbackDirective {
  @Input('imgFallback') fallback = '/assets/icons/playlist-cover-placeholder.png';

  private readonly el = inject(ElementRef<HTMLImageElement>);

  @HostListener('error')
  onError(): void {
    const img = this.el.nativeElement;
    if (img.src.endsWith(this.fallback)) return;
    img.src = this.fallback;
  }
}
