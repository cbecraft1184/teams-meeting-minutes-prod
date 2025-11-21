import { Avatar as FluentAvatar, AvatarProps as FluentAvatarProps } from "@fluentui/react-components";

export interface AvatarProps extends FluentAvatarProps {}

export const Avatar = (props: AvatarProps) => {
  return <FluentAvatar {...props} />;
};

export const AvatarFallback = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <FluentAvatar name={typeof children === 'string' ? children : undefined} className={className} />;
};
