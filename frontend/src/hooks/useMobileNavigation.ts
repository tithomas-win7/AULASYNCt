import { useEffect, useRef, useState } from "react";

export const MOBILE_NAVIGATION_QUERY = "(max-width: 760px)";

// El panel es un diálogo modal sólo en móvil; en escritorio es una barra lateral.
export function useMobileNavigation() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.(MOBILE_NAVIGATION_QUERY).matches ?? false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileOpen = isMobile && menuOpen;

  useEffect(() => {
    const media = window.matchMedia?.(MOBILE_NAVIGATION_QUERY);
    if (!media) return;
    const update = () => {
      setIsMobile(media.matches);
      setMenuOpen(false);
      // Evita dejar el foco en el botón de cierre, oculto en escritorio.
      if (
        !media.matches &&
        sidebarRef.current?.contains(document.activeElement)
      ) {
        sidebarRef.current.querySelector<HTMLAnchorElement>("a")?.focus();
      }
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (
      isMobile &&
      !mobileOpen &&
      sidebarRef.current?.contains(document.activeElement)
    ) {
      menuButtonRef.current?.focus();
    }
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const focusableElements = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]',
        ),
      );
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusableElements()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    sidebar.addEventListener("keydown", handleKeyDown);
    return () => {
      sidebar.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (window.matchMedia?.(MOBILE_NAVIGATION_QUERY).matches) {
        menuButtonRef.current?.focus();
      }
    };
  }, [mobileOpen]);

  return {
    isMobile,
    mobileOpen,
    menuButtonRef,
    sidebarRef,
    openMenu: () => setMenuOpen(true),
    closeMenu: () => setMenuOpen(false),
  };
}
