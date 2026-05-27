/**
 * Top-nav routes. Most are placeholders until their stories ship.
 * `enabled: false` items still render but display a "Em breve" toast on click.
 */

export interface NavLink {
  href: string;
  label: string;
  enabled: boolean;
}

export const NAV_LINKS: ReadonlyArray<NavLink> = [
  { href: "/", label: "Início", enabled: true },
  { href: "/conversas", label: "Conversas", enabled: false },
  { href: "/toggles", label: "Toggles", enabled: false },
  { href: "/metricas", label: "Métricas", enabled: false },
  { href: "/kb", label: "Base de conhecimento", enabled: false },
  { href: "/saude", label: "Saúde", enabled: false },
];
