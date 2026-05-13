const KEY = "shopos.theme";

export function initTheme() {
  if (typeof window === "undefined") return;
  const t = localStorage.getItem(KEY) || "light";
  document.documentElement.classList.toggle("dark", t === "dark");
}
export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(KEY) as "light" | "dark") || "light";
}
export function setTheme(t: "light" | "dark") {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, t);
  document.documentElement.classList.toggle("dark", t === "dark");
}
export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}
