import { Badge as FluentBadge, BadgeProps as FluentBadgeProps } from "@fluentui/react-components";

export interface BadgeProps extends FluentBadgeProps {
  variant?: 'filled' | 'outline' | 'tint' | 'ghost';
}

export const Badge = ({ variant = 'filled', ...props }: BadgeProps) => {
  const appearance = variant === 'outline' ? 'outline' :
                     variant === 'tint' ? 'tint' :
                     variant === 'ghost' ? 'ghost' : 'filled';

  return <FluentBadge appearance={appearance} {...props} />;
};
