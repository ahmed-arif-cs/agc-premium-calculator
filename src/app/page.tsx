import Image from "next/image";
import { Calculator } from "@/components/calculator/Calculator";
import { SplashScreen } from "@/components/calculator/SplashScreen";
import { WelcomeGate } from "@/components/calculator/WelcomeGate";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SplashScreen />
      <WelcomeGate />
      <div className="calc-bg-glow" aria-hidden />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="calc-brand-mark flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{
              border: "1px solid rgba(var(--c-accent-rgb),0.35)",
              background: "rgba(var(--c-accent-rgb),0.12)",
              boxShadow: "0 0 24px -6px rgba(var(--c-accent-rgb),0.5)",
            }}
          >
            <Image
              src="/agc-mark.png"
              alt="AGC — Ahmed Group of Companies logo"
              width={40}
              height={40}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="leading-tight">
            <h1 className="t-text font-display text-lg font-semibold tracking-[0.18em]">
              AGC
            </h1>
            <p className="t-muted text-[10px] uppercase tracking-[0.28em]">
              Premium Calculator
            </p>
          </div>
        </div>

        <Calculator />
      </main>

      <footer className="mt-auto w-full px-4 py-5 text-center">
        <p className="t-muted text-[11px]">
          Keyboard ready&nbsp;·&nbsp;
          <span className="calc-kbd">0-9</span>{" "}
          <span className="calc-kbd">+</span>{" "}
          <span className="calc-kbd">−</span>{" "}
          <span className="calc-kbd">×</span>{" "}
          <span className="calc-kbd">÷</span>{" "}
          <span className="calc-kbd">%</span>
          &nbsp;·&nbsp;
          <span className="calc-kbd">Enter</span> ={" "}
          <span className="calc-kbd">Esc</span> AC{" "}
          <span className="calc-kbd">⌫</span> delete
        </p>
      </footer>
    </div>
  );
}
