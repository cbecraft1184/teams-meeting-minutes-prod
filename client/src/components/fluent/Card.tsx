import { Card as FluentCard, CardHeader as FluentCardHeader, CardFooter as FluentCardFooter, CardPreview as FluentCardPreview } from "@fluentui/react-components";
import { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card = ({ children, className, onClick }: CardProps) => {
  return (
    <FluentCard className={className} onClick={onClick}>
      {children}
    </FluentCard>
  );
};

export const CardHeader = FluentCardHeader;
export const CardFooter = FluentCardFooter;
export const CardPreview = FluentCardPreview;

export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>;
};

export const CardTitle = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <h3 className={className}>{children}</h3>;
};

export const CardDescription = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <p className={className}>{children}</p>;
};
