import { ReactNode } from 'react';

export default function Card({
  children,
  className = '',
  interactive = false,
  hoverable = false,
}: {
  children?: ReactNode;
  className?: string;
  interactive?: boolean;
  hoverable?: boolean;
}) {
  return (
    <div
      className={[
        'card',
        interactive ? 'card--interactive' : '',
        hoverable ? 'card-hover' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
