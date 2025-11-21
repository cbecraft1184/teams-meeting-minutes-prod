import { Input as FluentInput, InputProps as FluentInputProps } from "@fluentui/react-components";
import { forwardRef } from "react";

export interface InputProps extends FluentInputProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => {
    return <FluentInput ref={ref} {...props} />;
  }
);

Input.displayName = 'Input';
