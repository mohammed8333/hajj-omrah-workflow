import React from "react";
import { Link as RouterLink } from "react-router-dom";

export default function Link({
  href,
  to,
  children,
  ...props
}: {
  href?: string;
  to?: string;
  children?: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <RouterLink to={href || to || "/"} {...props}>
      {children}
    </RouterLink>
  );
}
