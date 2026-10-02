import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'Admin' | 'Librarian' | 'Student';
  avatar?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLibrarian: boolean;
  apiUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('lib_token'));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('lib_user') ? JSON.parse(localStorage.getItem('lib_user')!) : null
  );

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('lib_token', newToken);
    localStorage.setItem('lib_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('lib_token');
    localStorage.removeItem('lib_user');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'Admin';
  const isLibrarian = user?.role === 'Librarian' || user?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated, isAdmin, isLibrarian, apiUrl }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
