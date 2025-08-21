import { useState, useCallback } from 'react';
import { NavigationState, User } from '../types';

export const useNavigation = () => {
  const [state, setState] = useState<NavigationState>({
    currentScreen: 'dashboard', // Start directly at dashboard
    history: [],
    user: null
  });

  const navigateTo = useCallback((screen: string) => {
    setState(prev => ({
      ...prev,
      currentScreen: screen,
      history: [...prev.history, prev.currentScreen]
    }));
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      const newHistory = [...prev.history];
      const previousScreen = newHistory.pop() || 'dashboard';
      return {
        ...prev,
        currentScreen: previousScreen,
        history: newHistory
      };
    });
  }, []);

  const login = useCallback((user: User) => {
    setState(prev => ({
      ...prev,
      user,
      currentScreen: 'dashboard'
    }));
  }, []);

  const logout = useCallback(() => {
    setState({
      currentScreen: 'dashboard', // Stay on dashboard instead of going to login
      history: [],
      user: null
    });
  }, []);

  return {
    ...state,
    navigateTo,
    goBack,
    login,
    logout
  };
};