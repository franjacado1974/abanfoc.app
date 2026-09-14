export interface Cliente {
  id: string;
  nombre: string;
  cif: string;
  direccion: string;
  poblacion: string;
  cp: string;
  provincia: string;
  telefono: string;
  contacto: string;
  correo: string;
  correoGeneral?: string;
  correoAdministracion?: string;
  correoFacturacion?: string;
  correoMantenimiento?: string;
  correoCompras?: string;
  correoPedidos?: string;
  correoOtro?: string;
  formaPago?: string;
  vencimiento?: string;
  iban?: string;
  notas?: string;
}

export interface Centro {
  _docId?: string;
  id: string;
  clienteId: string;
  customIdPart: string;
  nombre: string;
  direccion: string;
  poblacion: string;
  cp: string;
  provincia: string;
  telefono: string;
  contacto: string;
  correo: string;
  correoGeneral?: string;
  correoAdministracion?: string;
  correoFacturacion?: string;
  correoMantenimiento?: string;
  correoCompras?: string;
  correoPedidos?: string;
  correoOtro?: string;
  periodicidad?: string[];
  mesesRevision?: string[];
  tecnicoId?: string;
  empresaId?: string;
  numeroContrato?: string;
  fechaInicioContrato?: string;
  fechaFinContrato?: string;
  importeAnualContrato?: string;
  observacionesContrato?: string;
  sistemasContrato?: string[];
  precioAnualContrato?: string;
  precioTrimestralContrato?: string;
  precioMensualContrato?: string;
  comentariosTecnico?: string;
  comentariosPrivados?: string;
  formaPago?: string;
  vencimiento?: string;
  iban?: string;
  notas?: string;
}

export interface CentroSistema {
  id: string;
  centroId: string;
  tipo: string;
  familia: string;
  descripcion: string;
}

export interface EquipoInstalado {
  id: string;
  centroId: string;
  sistemaId: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  revisable?: boolean;
  revisado?: boolean;
  placa?: string;
  clase?: string;
  fabricante?: string;
  fechaFabricacion?: string;
  ultimoRetimbre?: string;
  pesoCapacidad?: string;
  anomalias?: string;
  longitud?: string;
  pruebaHidraulica?: string;
  checkAcceso?: boolean | null;
  checkAltura?: boolean | null;
  checkSoporte?: boolean | null;
  checkSenalizacion?: boolean | null;
  checkManguera?: boolean | null;
  checkPeso?: boolean | null;
  checkManometro?: boolean | null;
  checkMarcado?: boolean | null;
  checkEtiquetas?: boolean | null;
  checkRetimbre?: boolean | null;
  checkRiesgo?: boolean | null;
  checkDistancia?: boolean | null;
  checkPasador?: boolean | null;
  checkMovilidad?: boolean | null;
  foto?: string;
  [key: string]: any;
}

export interface Parte {
  id: string;
  centroId: string;
  clienteId: string;
  fechaCreacion: string;
  tecnicoId: string;
  periodicidad: string;
  mesesRevision: string;
  estado: 'Planificado' | 'Abierto' | 'En revisión' | 'Descargado (Offline)' | 'Finalizado' | 'Cerrado' | 'Pre-Cerrado' | 'Retimbrando';
  tipoTrabajo?: string;
  numeroMantenimiento?: string;
  fechaProgramada?: string;
  empresaId?: string;
  firmaCliente?: string;
  firmaTecnico?: string;
  nombreFirmante?: string;
  retirarExtintoresRetimbrado?: boolean;
  dejarExtintoresDeposito?: boolean;
  cantidadExtintoresDeposito?: number;
  retimbradoReiniciado?: boolean;
  observacionesTecnico?: string;
  cantidadRetimbrados?: number;
  comentariosPrivados?: string;
  equiposRetirados?: boolean;
  retimbrado?: boolean;
}

export interface Revision {
  id: string;
  parteId: string;
  centroId: string;
  clienteId: string;
  fecha: string;
  tecnicoId: string;
  estado: string;
  anomaliasCount: number;
  observaciones?: string;
}

export interface Instalacion {
  id: string;
  clienteId: string;
  centroId?: string;
  comercial: string;
  tecnicoId?: string;
  estado: string;
  fechaInicio: string;
  observaciones?: string;
}

export interface Reparacion {
  id: string;
  clienteId: string;
  centroId?: string;
  comercial: string;
  tecnicoId?: string;
  estado: string;
  fecha: string;
  observaciones?: string;
}

export interface Albaran {
  id: string;
  numeroAlbaran?: string;
  empresaId?: string;
  clienteId: string;
  centroId: string;
  parteId?: string;
  fecha: string;
  fechaCreacion?: string;
  tecnicoId?: string;
  firmaCliente?: string;
  firmaTecnico?: string;
  nombreFirmante?: string;
  elementos?: any[];
  items?: any[];
  facturado?: boolean;
  [key: string]: any;
}

export interface Presupuesto {
  id: string;
  numeroPresupuesto?: string;
  titulo?: string;
  clienteId: string;
  centroId?: string;
  fecha: string;
  fechaCreacion?: string;
  total: number;
  subtotal?: number;
  iva?: number;
  lineas?: any[];
  estado: 'Borrador' | 'Enviado' | 'En espera' | 'Aprobado' | 'Rechazado' | string;
  [key: string]: any;
}

export interface Certificado {
  id: string;
  numeroCertificado: string;
  clienteId: string;
  centroId: string;
  parteId: string;
  fecha: string;
  resultado: 'Favorable' | 'No favorable';
  ingenieroId?: string;
}

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  familiaId?: string;
  familia: string;
  precioCompra: number;
  precioVenta: number;
  revisable: boolean;
  fotoUrl?: string;
}

export interface Familia {
  id: string;
  nombre: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
  password?: string;
}

export interface Tecnico {
  id: string;
  nombre: string;
  apellidos: string;
  _docId?: string;
  habilitacion?: string;
  [key: string]: any;
}

export interface EmpresaData {
  _docId?: string;
  nombre: string;
  cif?: string;
  localidad?: string;
  direccion?: string;
}

export interface SistemaCategoria {
  id: string;
  nombre: string;
  imagenUrl?: string;
  tipos?: { id: string; nombre: string }[];
}

export interface SistemaEquipo {
  id: string;
  idCategoria: string;
  codigo: string;
  nombre: string;
  familia: string;
  revisable: boolean;
}
