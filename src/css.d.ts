import "react";

/** Custom properties are real CSS. React's closed style type asks for this augmentation. */
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}
