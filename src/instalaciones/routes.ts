import Instalaciones from './pages/Instalaciones';

export const instalacionesPages = {
  Instalaciones,
};

export const instalacionesRoutes = [
  { path: '/instalaciones', component: Instalaciones, allowedRoles: ['super-administrador', 'administrador'] },
];

export default instalacionesRoutes;
