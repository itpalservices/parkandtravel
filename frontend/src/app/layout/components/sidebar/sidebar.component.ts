import { Component, Input, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  navItems: NavItem[] = [
    { label: 'Home', route: '/admin/dashboard', icon: 'home' },
    { label: 'Bookings', route: '/admin/bookings', icon: 'bookings' },
    { label: 'Customers', route: '/admin/customers', icon: 'customers' },
    { label: 'Reports', route: '/admin/reports', icon: 'reports' }
  ];

  onClose(): void {
    this.closeSidebar.emit();
  }

  onNavClick(): void {
    if (window.innerWidth < 768) {
      this.closeSidebar.emit();
    }
  }
}
