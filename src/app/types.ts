export interface User {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    role: 'admin' | 'driver' | 'super_admin';
  };
}
