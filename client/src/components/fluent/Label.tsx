import { Label as FluentLabel, LabelProps as FluentLabelProps } from "@fluentui/react-components";

export interface LabelProps extends FluentLabelProps {}

export const Label = (props: LabelProps) => {
  return <FluentLabel {...props} />;
};
