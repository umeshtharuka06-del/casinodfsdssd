"use client";

import { usePathname } from "next/navigation";

/**
 * Route-aware page frame.
 *  • Player app  → fluid, capped content column (`.content-col`). The page
 *    itself IS the mobile layout — it scales naturally from phone to desktop
 *    with no phone mockup or fake borders.
 *  • Admin panel → full desktop-first width container.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-4 md:px-6 lg:px-8">
        {children}
      </main>
    );
  }

  // The home route renders either the full-width public landing or the
  // dashboard (which self-constrains to the content column), so it controls
  // its own width here.
  if (pathname === "/") {
    return <main className="w-full">{children}</main>;
  }

  return (
    <main className="content-col min-h-screen px-3 pb-28 pt-2 sm:px-4">
      {children}
    </main>
  );
}
