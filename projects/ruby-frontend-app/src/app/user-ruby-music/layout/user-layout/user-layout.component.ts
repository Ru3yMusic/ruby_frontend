import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LeftSidebarComponent } from '../../components/left-sidebar/left-sidebar.component';
import { TopHeaderComponent } from '../../components/top-header/top-header.component';
import { FooterPlayerComponent } from '../../components/footer-player/footer-player.component';
import { RightPanelComponent } from '../../components/right-panel/right-panel.component';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    LeftSidebarComponent,
    TopHeaderComponent,
    RightPanelComponent,
    FooterPlayerComponent,
  ],
  templateUrl: './user-layout.component.html',
  styleUrls: ['./user-layout.component.scss'],
})
export class UserLayoutComponent {}