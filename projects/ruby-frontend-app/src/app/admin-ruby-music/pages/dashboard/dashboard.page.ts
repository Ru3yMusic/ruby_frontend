import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import {
  LucideAngularModule,
  LucideIconData,
  Users,
  Flag,
  Music,
  Mic2,
  Menu,
  MoreVertical,
  Eye,
  Trash2,
  UserX,
  CheckCircle,
} from 'lucide-angular';
import { Chart, registerables } from 'chart.js';
import { AdminSidebarComponent } from '../../components/admin-sidebar/admin-sidebar.component';

Chart.register(...registerables);

export interface StatCard {
  label: string;
  value: string | number;
  color: string;
  bg: string;
  icon: LucideIconData;
}

export interface RecentUser {
  id: string;
  name: string;
  email: string;
  date: string;
  initials: string;
  avatarColor: string;
}

export interface RecentSong {
  id: string;
  title: string;
  artist: string;
  genre: string;
  cover: string;
}

@Component({
  selector: 'rm-dashboard-page',
  standalone: true,
  imports: [LucideAngularModule, AdminSidebarComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements AfterViewInit, OnDestroy {
  @ViewChild('barChartCanvas')  barCanvas!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('donutChartCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;

  readonly sidebarOpen = signal(false);
  readonly openMenuId  = signal<string | null>(null);

  // Icons
  readonly Users        = Users;
  readonly Flag         = Flag;
  readonly Music        = Music;
  readonly Mic2         = Mic2;
  readonly Menu         = Menu;
  readonly MoreVertical = MoreVertical;
  readonly Eye          = Eye;
  readonly Trash2       = Trash2;
  readonly UserX        = UserX;
  readonly CheckCircle  = CheckCircle;

  private barChart?:   Chart;
  private donutChart?: Chart;

  // ── Stat cards ──────────────────────────────────────────────────────────
  readonly stats: StatCard[] = [
    {
      label: 'Usuarios Activos',
      value: '1,284',
      icon: Users,
      color: '#4ade80',
      bg:    'rgba(74, 222, 128, 0.12)',
    },
    {
      label: 'Reportes Pendientes',
      value: '37',
      icon: Flag,
      color: '#a78bfa',
      bg:    'rgba(167, 139, 250, 0.12)',
    },
    {
      label: 'Canciones Totales',
      value: '8,512',
      icon: Music,
      color: '#38bdf8',
      bg:    'rgba(56, 189, 248, 0.12)',
    },
    {
      label: 'Artistas Registrados',
      value: '342',
      icon: Mic2,
      color: '#fb923c',
      bg:    'rgba(251, 146, 60, 0.12)',
    },
  ];

  // ── Recent users ─────────────────────────────────────────────────────────
  readonly recentUsers: RecentUser[] = [
    { id: '1', name: 'Valentina García',  email: 'vgarcia@mail.com',   date: '04 Abr 2026', initials: 'VG', avatarColor: '#7c3aed' },
    { id: '2', name: 'Carlos Mendoza',    email: 'cmendoza@mail.com',  date: '03 Abr 2026', initials: 'CM', avatarColor: '#0891b2' },
    { id: '3', name: 'Sofía Torres',      email: 'storres@mail.com',   date: '03 Abr 2026', initials: 'ST', avatarColor: '#be185d' },
    { id: '4', name: 'Andrés Ramírez',    email: 'aramirez@mail.com',  date: '02 Abr 2026', initials: 'AR', avatarColor: '#b45309' },
    { id: '5', name: 'Luciana Herrera',   email: 'lherrera@mail.com',  date: '01 Abr 2026', initials: 'LH', avatarColor: '#15803d' },
  ];

  // ── Recent songs ─────────────────────────────────────────────────────────
  readonly recentSongs: RecentSong[] = [
    { id: 's1', title: 'Blinding Lights',   artist: 'The Weeknd',    genre: 'Pop',     cover: 'https://picsum.photos/seed/s1/48/48' },
    { id: 's2', title: 'Tití Me Preguntó',  artist: 'Bad Bunny',     genre: 'Reguetón', cover: 'https://picsum.photos/seed/s2/48/48' },
    { id: 's3', title: 'Enemy',             artist: 'Imagine Dragons',genre: 'Rock',    cover: 'https://picsum.photos/seed/s3/48/48' },
    { id: 's4', title: 'Hawái',             artist: 'Maluma',        genre: 'Pop',     cover: 'https://picsum.photos/seed/s4/48/48' },
    { id: 's5', title: 'Tusa',              artist: 'Karol G',       genre: 'Trap',    cover: 'https://picsum.photos/seed/s5/48/48' },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.buildBarChart();
    this.buildDonutChart();
  }

  ngOnDestroy(): void {
    this.barChart?.destroy();
    this.donutChart?.destroy();
  }

  // ── Chart builders ────────────────────────────────────────────────────────
  private buildBarChart(): void {
    const ctx = this.barCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Rock', 'Pop', 'Trap', 'Reguetón', 'Balada'],
        datasets: [
          {
            data: [42, 35, 28, 22, 15],
            backgroundColor: [
              '#d70013',
              '#e8314a',
              '#ff6b35',
              '#ff8c42',
              '#c4a058',
            ],
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw}%`,
            },
          },
        },
        scales: {
          x: {
            grid:   { color: 'rgba(255,255,255,0.06)' },
            border: { color: 'transparent' },
            ticks:  { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
            max: 50,
          },
          y: {
            grid:   { display: false },
            border: { color: 'transparent' },
            ticks:  { color: 'rgba(255,255,255,0.8)', font: { size: 13, weight: 500 } },
          },
        },
      },
    });
  }

  private buildDonutChart(): void {
    const ctx = this.donutCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Leve', 'Moderado', 'Grave', 'Crítico'],
        datasets: [
          {
            data: [45, 28, 15, 12],
            backgroundColor: ['#4ade80', '#facc15', '#fb923c', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color:    'rgba(255,255,255,0.85)',
              padding:  16,
              font:     { size: 13 },
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw}%`,
            },
          },
        },
      },
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  toggleMenu(songId: string): void {
    this.openMenuId.update(id => (id === songId ? null : songId));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  onMenuAction(action: string, song: RecentSong): void {
    console.log(`Acción: ${action} → ${song.title}`);
    this.closeMenu();
  }
}
