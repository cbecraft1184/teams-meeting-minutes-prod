import { Button as FluentButton } from "@fluentui/react-components";
import type { ButtonProps as FluentButtonProps } from "@fluentui/react-components";

export type ButtonProps = Omit<FluentButtonProps, 'appearance' | 'size'> & {
  variant?: 'default' | 'primary' | 'subtle' | 'transparent' | 'outline' | 'ghost' | 'destructive';
  size?: 'small' | 'medium' | 'large';
};

export const Button = ({ variant = 'default', size = 'medium', ...rest }: ButtonProps) => {
  const appearance = 
    variant === 'primary' ? 'primary' :
    variant === 'outline' ? 'outline' :
    variant === 'subtle' || variant === 'ghost' ? 'subtle' :
    variant === 'transparent' ? 'transparent' : 
    'secondary';

  return (
    <FluentButton
      appearance={appearance as any}
      size={size as any}
      {...(rest as any)}
    />
  );
};
