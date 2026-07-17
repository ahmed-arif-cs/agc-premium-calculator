"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { History as HistoryIcon, Info, MessageSquareText, Redo2, Settings, Sparkles, Star, Undo2, UserRound, Wand2 } from "lucide-react";
import { useCalculator } from "@/hooks/useCalculator";
import { useHistory } from "@/hooks/useHistory";
import { useHistorySyncStatus } from "@/hooks/useHistorySync";
import { useMemorySyncStatus } from "@/hooks/useMemorySync";
import { useFavorites } from "@/hooks/useFavorites";
import { useFavoritesSyncStatus } from "@/hooks/useFavoritesSync";
import { useSettings, useClickSound } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Display } from "./Display";
import { Keypad } from "./Keypad";
import { MemoryBar } from "./MemoryBar";
import { ModeTabs } from "./ModeTabs";
import { InstallBanner } from "./InstallBanner";

// Bundle-size / lazy-loading optimization: everything below is either a
// slide-out panel that starts closed (History, Favorites, Settings, About,
// Account, AI Calculator) or a keypad/bar only shown in a non-default mode
// (Scientific keypad, Smart input bar, Converter). None of these are needed
// for the very first paint of the default Standard-mode calculator, so they
// are code-split into their own chunks via `next/dynamic` and fetched only
// when the user actually opens/switches to them, instead of being part of
// the initial JS bundle. `ssr: false` is safe here — every one of these is
// already a "use client" component that renders nothing (or a fixed/
// absolute-positioned overlay) when closed, so there is no layout to
// reserve and no hydration-mismatch risk.
const ScientificKeypad = dynamic(
  () => import("./ScientificKeypad").then((m) => m.ScientificKeypad),
  { ssr: false },
);
const Converter = dynamic(
  () => import("./Converter").then((m) => m.Converter),
  { ssr: false },
);
const SmartBar = dynamic(
  () => import("./SmartBar").then((m) => m.SmartBar),
  { ssr: false },
);
const HistoryPanel = dynamic(
  () => import("./HistoryPanel").then((m) => m.HistoryPanel),
  { ssr: false },
);
const FavoritesPanel = dynamic(
  () => import("./FavoritesPanel").then((m) => m.FavoritesPanel),
  { ssr: false },
);
const SettingsPanel = dynamic(
  () => import("./SettingsPanel").then((m) => m.SettingsPanel),
  { ssr: false },
);
const AboutPanel = dynamic(
  () => import("./AboutPanel").then((m) => m.AboutPanel),
  { ssr: false },
);
const AccountPanel = dynamic(
  () => import("./AccountPanel").then((m) => m.AccountPanel),
  { ssr: false },
);
const AICalculatorPanel = dynamic(
  () => import("./AICalculatorPanel").then((m) => m.AICalculatorPanel),
  { ssr: false },
);

export function Calculator() {
  const calc = useCalculator();
  const history = useHistory();
  // Cloud sync itself (restore-on-login + push-on-change) is mounted once,
  // site-wide, by `SettingsApplier.tsx` (Task 22) rather than here — this
  // is only a read-only subscription to that hook's live status, so
  // Guest Mode and this component's own render behavior are unaffected;
  // see `SettingsApplier.tsx`'s doc comment for the full rationale.
  const historySyncStatus = useHistorySyncStatus();
  const memorySyncStatus = useMemorySyncStatus();
  const favorites = useFavorites();
  const favoritesSyncStatus = useFavoritesSyncStatus();
  const settings = useSettings();
  const clickSound = useClickSound();
  const auth = useAuth();
  const { add: addHistory } = history;
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [favoritesOpen, setFavoritesOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [aboutOpen, setAboutOpen] = useState<boolean>(false);
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [smartOpen, setSmartOpen] = useState<boolean>(false);
  const [aiCalcOpen, setAiCalcOpen] = useState<boolean>(false);

  // When a calculation is committed, record it in history (once per evaluation).
  useEffect(() => {
    if (calc.lastEvaluation) {
      addHistory(calc.lastEvaluation.expression, calc.lastEvaluation.result);
    }
  }, [calc.lastEvaluation?.id, addHistory]);

  const { loadResult } = calc;
  const handleReuse = useCallback(
    (expression: string, result: string) => {
      loadResult(expression, result);
      setHistoryOpen(false);
      setFavoritesOpen(false);
    },
    [loadResult],
  );

  const isConverter = calc.mode === "converter";

  return (
    <>
      <div
        className={cn(
          "calc-glass w-full max-w-[400px] rounded-[28px] p-4 sm:p-5",
          calc.mode === "scientific" && "calc-glass--sci",
          isConverter && "calc-glass--sci",
        )}
        data-fs={settings.fontSize}
      >
        <div className="calc-topbar">
          <ModeTabs mode={calc.mode} onChange={calc.setMode} />
          <div className="calc-utils">
            <button
              type="button"
              className={cn("calc-util-btn", smartOpen && "calc-util-btn--active")}
              onClick={() => {
                clickSound();
                setSmartOpen((v) => !v);
              }}
              aria-label="Smart input"
              aria-pressed={smartOpen}
              title="Smart input (natural language / equations / voice)"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <Link
              href="/chat"
              className="calc-util-btn"
              onClick={clickSound}
              aria-label="AI Chat (preview)"
              title="AI Chat (preview — not yet connected)"
            >
              <MessageSquareText className="h-4 w-4" />
            </Link>
            <button
              type="button"
              className={cn("calc-util-btn", aiCalcOpen && "calc-util-btn--active")}
              onClick={() => {
                clickSound();
                setAiCalcOpen(true);
              }}
              aria-label="AI Calculator"
              aria-pressed={aiCalcOpen}
              title="AI Calculator (natural language, formula explanations, step-by-step solutions)"
            >
              <Wand2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="calc-util-btn"
              onClick={calc.undo}
              disabled={!calc.canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="calc-util-btn"
              onClick={calc.redo}
              disabled={!calc.canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn("calc-util-btn", accountOpen && "calc-util-btn--active")}
              onClick={() => {
                clickSound();
                setAccountOpen(true);
              }}
              aria-label={auth.isAuthenticated ? "Account (signed in)" : "Sign in"}
              title={
                auth.isAuthenticated
                  ? `Signed in as ${auth.user?.email ?? "your account"}`
                  : "Sign in"
              }
            >
              <UserRound className="h-4 w-4" />
              {auth.isAuthenticated ? <span className="calc-util-dot" aria-hidden /> : null}
            </button>
            <button
              type="button"
              className="calc-util-btn"
              onClick={() => {
                clickSound();
                setSettingsOpen(true);
              }}
              aria-label="Open settings"
              title="Settings & themes"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="calc-util-btn"
              onClick={() => {
                clickSound();
                setHistoryOpen(true);
              }}
              aria-label="Open history"
              title="History"
            >
              <HistoryIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="calc-util-btn"
              onClick={() => {
                clickSound();
                setFavoritesOpen(true);
              }}
              aria-label="Open favorites"
              title="Favorites"
            >
              <Star className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="calc-util-btn"
              onClick={() => {
                clickSound();
                setAboutOpen(true);
              }}
              aria-label="About AGC Premium Calculator"
              title="About"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!isConverter && smartOpen ? <SmartBar calc={calc} /> : null}

        {isConverter ? (
          <Converter />
        ) : (
          <>
            <Display calc={calc} />
            <MemoryBar calc={calc} syncStatus={memorySyncStatus} />
            <div className="u-divider my-3" />
            {calc.mode === "scientific" && (
              <>
                <ScientificKeypad calc={calc} />
                <div className="u-divider-soft my-3" />
              </>
            )}
            <Keypad calc={calc} />
          </>
        )}
      </div>

      <HistoryPanel
        open={historyOpen}
        items={history.items}
        onClose={() => setHistoryOpen(false)}
        onReuse={(item) => handleReuse(item.expression, item.result)}
        onRemove={history.remove}
        onClear={history.clear}
        onLabel={history.updateLabel}
        onImport={history.addMany}
        syncStatus={historySyncStatus}
        isFavorite={(item) => favorites.isFavoriteCalculation(item.expression, item.result)}
        onToggleFavorite={(item) => favorites.toggleCalculation(item.expression, item.result)}
      />

      <FavoritesPanel
        open={favoritesOpen}
        items={favorites.items}
        onClose={() => setFavoritesOpen(false)}
        onReuse={handleReuse}
        onRemove={favorites.remove}
        onClear={favorites.clear}
        onLabel={favorites.updateLabel}
        syncStatus={favoritesSyncStatus}
      />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AccountPanel open={accountOpen} onClose={() => setAccountOpen(false)} />

      <AICalculatorPanel open={aiCalcOpen} onClose={() => setAiCalcOpen(false)} calc={calc} />

      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <InstallBanner />
    </>
  );
}
