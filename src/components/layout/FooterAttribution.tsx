export function FooterAttribution() {
  return (
    <footer className="w-full py-6 text-center">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Diseñado y desarrollado por{" "}
        <a
          href="https://mursatsolutions.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-block text-neutral-600 dark:text-neutral-300 transition-colors hover:text-foreground dark:hover:text-white font-medium"
        >
          MurSat Solutions
          <span className="absolute -bottom-0.5 left-0 w-0 h-[1px] bg-foreground transition-all duration-300 group-hover:w-full"></span>
        </a>
      </p>
    </footer>
  );
}
