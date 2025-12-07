export type UserRole = 'manager' | 'designer' | 'production_staff' | 'owner';

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
  auto_clock_in?: string;
  auto_clock_out?: string;
  created_at?: string;
  last_login?: string;
  password?: string;
}
