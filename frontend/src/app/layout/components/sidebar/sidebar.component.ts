import { Component, Input, EventEmitter, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RoleService, UserRoleInfo } from '../../../core/services/role.service';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { NavItem } from '../../../shared/models/nav.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() isOpen = false;
  @Output() closeSidebar = new EventEmitter<void>();

  private roleService = inject(RoleService);

  private allNavItems: NavItem[] = [
    { label: 'Home', route: '/admin/dashboard', icon: 'home', adminOnly: true },
    { label: 'Bookings', route: '/admin/bookings', icon: 'bookings' },
    { label: 'Customers', route: '/admin/customers', icon: 'customers', adminOnly: true },
    { label: 'Reports', route: '/admin/reports', icon: 'reports', adminOnly: true },
    { label: 'Drivers', route: '/admin/drivers', icon: 'drivers', adminOnly: true }
  ];

  navItems$: Observable<NavItem[]> = of([]);
  userRole$: Observable<UserRoleInfo> = of({ role: 'user', isAdmin: false, isDriver: false, isUser: true });

  ngOnInit(): void {
    this.userRole$ = this.roleService.getUserRole();
    this.navItems$ = this.userRole$.pipe(
      map(roleInfo => {
        if (roleInfo.isAdmin) {
          return this.allNavItems;
        }
        return this.allNavItems.filter(item => !item.adminOnly);
      })
    );
  }

  onClose(): void {
    this.closeSidebar.emit();
  }

  onNavClick(): void {
    if (window.innerWidth < 768) {
      this.closeSidebar.emit();
    }
  }
}
