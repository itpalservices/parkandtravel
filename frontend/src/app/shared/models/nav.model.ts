export interface NavItem {
  label: string;
  route: string;
  icon: string;
  adminOnly?: boolean;
  /** Shown only to super_admin — who in turn sees nothing else. */
  superAdminOnly?: boolean;
}