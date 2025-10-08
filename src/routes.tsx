import { createBrowserRouter, Outlet } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LiveDetection from './pages/LiveDetection';
import ImageUpload from './pages/ImageUpload';
import Settings from './pages/Settings';
import About from './pages/About';
import Layout from './components/layout/Layout';

export const routes = [
  {
    path: '/',
    component: Dashboard,
    name: 'Dashboard',
  },
  {
    path: '/live',
    component: LiveDetection,
    name: 'Live Detection',
  },
  {
    path: '/upload',
    component: ImageUpload,
    name: 'Image Upload',
  },
  {
    path: '/settings',
    component: Settings,
    name: 'Settings',
  },
  {
    path: '/about',
    component: About,
    name: 'About',
  },
];

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout><Outlet /></Layout>,
      children: [
        {
          path: '',
          element: <Dashboard />,
        },
        {
          path: 'live',
          element: <LiveDetection />,
        },
        {
          path: 'upload',
          element: <ImageUpload />,
        },
        {
          path: 'settings',
          element: <Settings />,
        },
        {
          path: 'about',
          element: <About />,
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true
    }
  }
);