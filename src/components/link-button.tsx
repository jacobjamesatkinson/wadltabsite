import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

export function LinkButton({
  href,
  children,
  ...props
}: Omit<ButtonProps, "render"> & { href: string; children: React.ReactNode }) {
  return (
    <Button nativeButton={false} render={<Link href={href} />} {...props}>
      {children}
    </Button>
  );
}
