"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      theme="dark"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "border border-[#4a4880] bg-[#222153] text-zinc-100 shadow-2xl",
          title: "text-white",
          description: "text-zinc-400",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
