import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Search, Check, ChevronLeft } from 'lucide-angular';
import { LibraryAlbum, LibraryState } from '../../state/library.state';

const ALL_ALBUMS: LibraryAlbum[] = [
  {
    id: 'currents',
    title: 'Currents',
    artist: 'Tame Impala',
    cover: 'linear-gradient(135deg,#c17b2e,#8b3fa8)',
    year: 2015,
    description: 'Tercer álbum de estudio de Tame Impala, un viaje psicodélico al pop moderno.',
    tracks: [
      { id: 'cur1', title: 'Let It Happen', duration: '7:47' },
      { id: 'cur2', title: 'Nangs', duration: '1:47' },
      { id: 'cur3', title: 'The Moment', duration: '4:14' },
      { id: 'cur4', title: 'Yes I\'m Changing', duration: '4:19' },
      { id: 'cur5', title: 'Eventually', duration: '5:17' },
      { id: 'cur6', title: 'Gossip', duration: '0:44' },
      { id: 'cur7', title: 'The Less I Know the Better', duration: '3:36' },
      { id: 'cur8', title: 'Past Life', duration: '3:48' },
      { id: 'cur9', title: 'Disciples', duration: '1:45' },
      { id: 'cur10', title: 'New Person, Same Old Mistakes', duration: '6:03' },
    ],
  },
  {
    id: 'after-hours',
    title: 'After Hours',
    artist: 'The Weeknd',
    cover: 'linear-gradient(135deg,#8b0000,#1a0005)',
    year: 2020,
    description: 'Cuarto álbum de estudio de The Weeknd, una oscura novela noir en forma musical.',
    tracks: [
      { id: 'ah1', title: 'Alone Again', duration: '4:10' },
      { id: 'ah2', title: 'Too Late', duration: '3:59' },
      { id: 'ah3', title: 'Hardest to Love', duration: '3:31' },
      { id: 'ah4', title: 'Scared to Live', duration: '3:12' },
      { id: 'ah5', title: 'Snowchild', duration: '4:08' },
      { id: 'ah6', title: 'Escape from LA', duration: '6:07' },
      { id: 'ah7', title: 'Heartless', duration: '3:18' },
      { id: 'ah8', title: 'Blinding Lights', duration: '3:20' },
    ],
  },
  {
    id: 'melodrama',
    title: 'Melodrama',
    artist: 'Lorde',
    cover: 'linear-gradient(135deg,#1a1a5e,#b5179e)',
    year: 2017,
    description: 'Una noche de fiesta convertida en un álbum que captura la euforia y el desamor.',
    tracks: [
      { id: 'mel1', title: 'Green Light', duration: '3:54' },
      { id: 'mel2', title: 'Sober', duration: '3:14' },
      { id: 'mel3', title: 'Homemade Dynamite', duration: '3:08' },
      { id: 'mel4', title: 'The Louvre', duration: '4:31' },
      { id: 'mel5', title: 'Liability', duration: '3:27' },
      { id: 'mel6', title: 'Hard Feelings', duration: '4:48' },
      { id: 'mel7', title: 'Supercut', duration: '4:15' },
    ],
  },
  {
    id: 'blonde',
    title: 'Blonde',
    artist: 'Frank Ocean',
    cover: 'linear-gradient(135deg,#f4d03f,#e67e22)',
    year: 2016,
    description: 'Obra maestra del R&B alternativo, íntima y fragmentada como un sueño.',
    tracks: [
      { id: 'bl1', title: 'Nikes', duration: '5:14' },
      { id: 'bl2', title: 'Ivy', duration: '4:09' },
      { id: 'bl3', title: 'Pink + White', duration: '3:47' },
      { id: 'bl4', title: 'Solo', duration: '4:25' },
      { id: 'bl5', title: 'Self Control', duration: '4:10' },
      { id: 'bl6', title: 'Nights', duration: '5:07' },
      { id: 'bl7', title: 'White Ferrari', duration: '4:09' },
    ],
  },
  {
    id: 'tv-girl',
    title: 'French Exit',
    artist: 'TV Girl',
    cover: 'linear-gradient(135deg,#1b4f72,#7fb3d3)',
    year: 2014,
    description: 'Indie pop con samples y samplers que hablan de amor y desamor contemporáneo.',
    tracks: [
      { id: 'tv1', title: 'Birds Don\'t Sing', duration: '3:51' },
      { id: 'tv2', title: 'Loving Machine', duration: '3:22' },
      { id: 'tv3', title: 'Cigarettes Out the Window', duration: '3:34' },
      { id: 'tv4', title: 'Taking What\'s Not Yours', duration: '2:58' },
      { id: 'tv5', title: 'Song About Me', duration: '4:01' },
    ],
  },
  {
    id: 'punisher',
    title: 'Punisher',
    artist: 'Phoebe Bridgers',
    cover: 'linear-gradient(135deg,#2c3e50,#95a5a6)',
    year: 2020,
    description: 'Folk indie que equilibra la intimidad con lo espectral en cada acorde.',
    tracks: [
      { id: 'pun1', title: 'Garden Song', duration: '3:45' },
      { id: 'pun2', title: 'Savior Complex', duration: '4:06' },
      { id: 'pun3', title: 'Moon Song', duration: '3:35' },
      { id: 'pun4', title: 'Kyoto', duration: '2:51' },
      { id: 'pun5', title: 'Halloween', duration: '4:29' },
      { id: 'pun6', title: 'Savior Complex', duration: '4:06' },
    ],
  },
  {
    id: 'igor',
    title: 'IGOR',
    artist: 'Tyler, the Creator',
    cover: 'linear-gradient(135deg,#f9ca24,#f0932b)',
    year: 2019,
    description: 'Un álbum conceptual sobre el amor no correspondido narrado por un alter ego.',
    tracks: [
      { id: 'ig1', title: 'IGOR\'S THEME', duration: '2:12' },
      { id: 'ig2', title: 'EARFQUAKE', duration: '3:32' },
      { id: 'ig3', title: 'I THINK', duration: '3:01' },
      { id: 'ig4', title: 'RUNNING OUT OF TIME', duration: '2:46' },
      { id: 'ig5', title: 'NEW MAGIC WAND', duration: '3:07' },
      { id: 'ig6', title: 'A BOY IS A GUN*', duration: '3:46' },
      { id: 'ig7', title: 'PUPPET', duration: '5:01' },
      { id: 'ig8', title: 'WHAT\'S GOOD', duration: '3:09' },
    ],
  },
  {
    id: 'norman',
    title: 'Norman Fucking Rockwell!',
    artist: 'Lana Del Rey',
    cover: 'linear-gradient(135deg,#1a3a5c,#c5a880)',
    year: 2019,
    description: 'El álbum más aclamado de Lana: melancólico, cinéfilo y americano.',
    tracks: [
      { id: 'nor1', title: 'Norman Fucking Rockwell', duration: '5:02' },
      { id: 'nor2', title: 'Mariners Apartment Complex', duration: '4:01' },
      { id: 'nor3', title: 'Venice Bitch', duration: '9:37' },
      { id: 'nor4', title: 'Hope Is a Dangerous Thing...', duration: '3:34' },
      { id: 'nor5', title: 'California', duration: '4:50' },
      { id: 'nor6', title: 'The Greatest', duration: '5:00' },
    ],
  },
];

export const NEW_RELEASES = ALL_ALBUMS.slice(0, 5);
export const FEATURED = ALL_ALBUMS.slice(5, 7);
export const SUGGESTIONS = ALL_ALBUMS.slice(7);

@Component({
  selector: 'rm-album-explorer-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './album-explorer.page.html',
  styleUrl: './album-explorer.page.scss',
})
export class AlbumExplorerPage {
  readonly Search      = Search;
  readonly Check       = Check;
  readonly ChevronLeft = ChevronLeft;
  private readonly router = inject(Router);
  private readonly state = inject(LibraryState);

  readonly search = signal('');
  readonly selectedIds = signal<Record<string, boolean>>({});

  readonly newReleases = NEW_RELEASES;
  readonly featured = FEATURED;

  readonly suggestions = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return SUGGESTIONS;
    return ALL_ALBUMS.filter(
      a => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q),
    );
  });

  toggle(album: LibraryAlbum): void {
    this.selectedIds.update(s => ({ ...s, [album.id]: !s[album.id] }));
  }

  isSelected(id: string): boolean {
    return !!this.selectedIds()[id];
  }

  save(): void {
    const selected = ALL_ALBUMS.filter(a => this.selectedIds()[a.id]);
    if (selected.length === 0) return;
    this.state.addAlbums(selected);
    this.router.navigate(['/library/add-albums/success']);
  }
}
