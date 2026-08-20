import { ReactNode } from 'react';

export default function Card({
  children,
  className = '',
  interactive = false,
}: {
  /** Optional so the component can stand in as a sized skeleton block. */
  children?: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div className={['card', interactive ? 'card--interactive' : '', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
