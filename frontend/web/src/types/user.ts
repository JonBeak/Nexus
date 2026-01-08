export type UserRole = 'manager' | 'designer' | 'production_staff' | 'owner';
export type ThemePreference = 'industrial' | 'light';

export interface AccountUser {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  user_group?: string;
  hourly_wage?: number;
  is_active: boolean;
  show_in_time_calendar: boolean;
  theme_preference: ThemePreference;
  auto_clock_in?: string;
  auto_clock_out?: string;
  production_roles?: string[];  // Array of production role keys (e.g., ["designer", "vinyl_applicator"])
  created_at?: string;
  last_login?: string;
  password?: string;
}

// Production role definition (from settings)
export interface ProductionRole {
  role_id: number;
  role_key: string;
  display_name: string;
  display_order: number;
  color_hex?: string;
  color_bg_class?: string;
  color_text_class?: string;
  is_active: boolean;
  description?: string;
}
