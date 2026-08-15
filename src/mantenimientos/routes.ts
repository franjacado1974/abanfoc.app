import Planificacion from './pages/Planificacion';
import Partes from './pages/Partes';
import RevisionChecklist from './pages/RevisionChecklist';
import Revisiones from './pages/Revisiones';
import DashboardTecnico from './pages/DashboardTecnico';

export const mantenimientosPages = {
  Planificacion,
  Partes,
  RevisionChecklist,
  Revisiones,
  DashboardTecnico,
};

export const mantenimientosRoutes = [
  { path: '/partes_trabajo', component: Planificacion, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/partes', component: Partes, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador'] },
  { path: '/revision-checklist', component: RevisionChecklist, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
  { path: '/revisiones', component: Revisiones, allowedRoles: ['super-administrador', 'administrador'] },
];

export default mantenimientosRoutes;
