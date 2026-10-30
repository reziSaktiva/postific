"use client";

import { createContext, useContext } from "react";

/**
 * Zona waktu pengguna (IANA, T-147/ADR-146) untuk komponen client. Diisi
 * sekali dari layout `(app)` (server membaca lewat IdentityService), bukan
 * dibaca dari browser. Tanpa nilai default: komponen di luar provider
 * langsung gagal alih-alih diam-diam jatuh ke WIB.
 */
const UserTimeZoneContext = createContext<string | null>(null);

export function UserTimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: React.ReactNode;
}) {
  return (
    <UserTimeZoneContext.Provider value={timeZone}>
      {children}
    </UserTimeZoneContext.Provider>
  );
}

export function useUserTimeZone(): string {
  const timeZone = useContext(UserTimeZoneContext);
  if (timeZone === null) {
    throw new Error(
      "useUserTimeZone harus dipakai di dalam UserTimeZoneProvider.",
    );
  }
  return timeZone;
}
