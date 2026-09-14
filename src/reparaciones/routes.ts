import Reparaciones from './pages/Reparaciones';

export const reparacionesPages = {
  Reparaciones,
};

export const reparacionesRoutes = [
  { path: '/reparaciones', component: Reparaciones, allowedRoles: ['super-administrador', 'administrador'] },
];

export default reparacionesRoutes;
