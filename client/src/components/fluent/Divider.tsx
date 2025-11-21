import { Divider as FluentDivider, DividerProps as FluentDividerProps } from "@fluentui/react-components";

export interface DividerProps extends FluentDividerProps {}

export const Divider = (props: DividerProps) => {
  return <FluentDivider {...props} />;
};

export const Separator = Divider;
