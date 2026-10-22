"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import type { ComponentProps } from "react";

function AlertDialog(props: ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root {...props} />;
}

function AlertDialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Popup>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[#0e0d2c]/80" />
      <AlertDialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <AlertDialogPrimitive.Popup
          className={cn(
            "w-full max-w-md rounded-xl border border-[#4a4880] bg-[#222153] p-5 text-zinc-100 shadow-2xl outline-none sm:p-6",
            className,
          )}
          {...props}
        >
          {children}
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Viewport>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-lg font-semibold text-white", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm text-zinc-400", className)}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Close>) {
  return (
    <AlertDialogPrimitive.Close
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-white transition-colors hover:bg-[#302e67] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
