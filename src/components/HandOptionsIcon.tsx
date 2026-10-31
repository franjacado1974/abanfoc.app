import React from 'react';

export interface HandOptionsIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Icono de mano con botones de opciones (1, 2, 3), que representa la selección interactiva de acciones.
 * Sustituye el icono anterior de la varita mágica.
 */
export const HandOptionsIcon: React.FC<HandOptionsIconProps> = ({
  size = 16,
  className = '',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Botón 1 */}
      <circle cx="5" cy="4.5" r="2.8" />
      <path d="M5 6V3.6L4.2 4.2" strokeWidth="1.3" />

      {/* Botón 2 (Presionado por el dedo) */}
      <circle cx="12" cy="4.5" r="2.8" />
      <path d="M10.9 4a1.1 1.1 0 0 1 2.2.4c0 .6-.7 1-1.6 1.6h1.6" strokeWidth="1.3" />

      {/* Botón 3 */}
      <circle cx="19" cy="4.5" r="2.8" />
      <path d="M17.9 3.6h2l-1 1.2a1 1 0 0 1 1.2 1.2c-.3.4-1.2.6-1.9.4" strokeWidth="1.3" />

      {/* Dedo índice apuntando al botón central */}
      <path d="M10.8 11.5V5.5a1.2 1.2 0 0 1 2.4 0v4.8" />

      {/* Pulgar hacia la izquierda */}
      <path d="M10.8 12.2l-2.4-.6a1.5 1.5 0 0 0-1.8 1.3l-.1.9a1.8 1.8 0 0 0 1.2 1.8l2.3 1.2" />

      {/* Dedos plegados a la derecha */}
      <path d="M13.2 10.3a1.4 1.4 0 0 1 1.6 1.4c0 .7-.5 1.2-1.3 1.3" />
      <path d="M14.5 12.8a1.4 1.4 0 0 1 1.8 1.4c0 .7-.6 1.2-1.5 1.3" />
      <path d="M15.8 15.2a1.4 1.4 0 0 1 1.8 1.4c0 .8-.7 1.4-1.7 1.5" />

      {/* Base de la mano / muñeca */}
      <path d="M10 16.8v1.6" />
      <path d="M15.9 18v.4" />
      <rect x="9.2" y="19.2" width="7.6" height="3.2" rx="1" />
    </svg>
  );
};

export default HandOptionsIcon;
