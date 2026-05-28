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
  { href: "/conversas", label: "Conversas", enabled: true },
  { href: "/toggles", label: "Toggles", enabled: true },
  { href: "/metricas", label: "Métricas", enabled: false },
  { href: "/kb", label: "Base de conhecimento", enabled: true },
  { href: "/saude", label: "Saúde", enabled: true },
];
