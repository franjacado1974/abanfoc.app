import React from 'react';

export interface HandOptionsIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Icono de mano con botones de opciones (1, 2, 3), presionando el botón central (2).
 * Representa la selección interactiva de acciones y opciones al hacer clic en las filas de las tablas.
 */
export const HandOptionsIcon: React.FC<HandOptionsIconProps> = ({
  size = 20,
  className = '',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Botón 1 */}
      <circle cx="23" cy="18" r="12" />
      <path d="M 19.5 16 L 23 12.5 V 23.5 M 19.5 23.5 H 26.5" strokeWidth="3.2" />

      {/* Botón 2 (Abierto por abajo donde entra el dedo índice que lo pulsa) */}
      <path d="M 44 28.4 A 12 12 0 1 1 56 28.4" />
      <path d="M 46 13 C 46 10.5, 54 10.5, 54 13 C 54 15.5, 46.5 17, 46.5 18.5 H 54" strokeWidth="3.2" />

      {/* Botón 3 */}
      <circle cx="77" cy="18" r="12" />
      <path d="M 72.5 12.5 H 81.5 L 77 16 C 79.5 16, 81.5 17.5, 81.5 20 C 81.5 22.8, 79 24, 76 24 C 73.5 24, 72 23, 72 22" strokeWidth="3.2" />

      {/* Contorno continuo de la Mano: pulgar a la izquierda, índice vertical pulsando el botón 2, nudillos a la derecha */}
      <path d="M 46 72 L 29 45.5 A 4 4 0 0 1 34 40.5 L 44 49 V 23 A 5 5 0 0 1 54 23 V 37 C 58 35.5, 62 37, 62 40.5 C 62 41.5, 60.5 42, 59 42.5 C 63.5 42, 68 43, 68 47 C 68 48, 66.5 49, 65 49.5 C 70.5 49, 76 50.5, 76 55 V 72" />

      {/* Muñeca y puño de manga con doble línea característica */}
      <rect x="46" y="72" width="30" height="4" rx="2" />
      <rect x="43" y="78" width="36" height="15" rx="3.5" />
    </svg>
  );
};

export default HandOptionsIcon;
