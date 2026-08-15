import Clientes from './pages/Clientes';
import Centros from './pages/Centros';
import ClientesCentros from './pages/ClientesCentros';
import Presupuestos from './pages/Presupuestos';
import Pedidos from './pages/Pedidos';
import Albaranes from './pages/Albaranes';
import Certificados from './pages/Certificados';
import Catalogo from './pages/Catalogo';
import Articulos from './pages/Articulos';
import Servicios from './pages/Servicios';
import ConfiguracionEmpresa from './pages/ConfiguracionEmpresa';
import Ajustes from './pages/Ajustes';
import Buzon from './pages/Buzon';

export const oficinaPages = {
  Clientes,
  Centros,
  ClientesCentros,
  Presupuestos,
  Pedidos,
  Albaranes,
  Certificados,
  Catalogo,
  Articulos,
  Servicios,
  ConfiguracionEmpresa,
  Ajustes,
  Buzon,
};

export const oficinaRoutes = [
  { path: '/clientes', component: Clientes, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
  { path: '/centros', component: Centros, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/clientes-centros', component: ClientesCentros, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
  { path: '/presupuestos', component: Presupuestos, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/pedidos', component: Pedidos, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/albaranes', component: Albaranes, allowedRoles: ['super-administrador', 'administrador', 'visualizador'] },
  { path: '/certificados', component: Certificados, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/catalogo', component: Catalogo, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
  { path: '/articulos', component: Articulos, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
  { path: '/servicios', component: Servicios, allowedRoles: ['super-administrador', 'administrador', 'editor'] },
  { path: '/configuracion-datos', component: ConfiguracionEmpresa, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/ajustes', component: Ajustes, allowedRoles: ['super-administrador', 'administrador'] },
  { path: '/buzon', component: Buzon, allowedRoles: ['super-administrador', 'administrador', 'editor', 'visualizador', 'tecnico'] },
];

export default oficinaRoutes;
