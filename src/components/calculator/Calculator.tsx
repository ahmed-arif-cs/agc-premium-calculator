"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bot, Calculator as CalculatorIcon, Download, History as HistoryIcon, Info, Menu, Mic2, Redo2, Settings, Star, Undo2, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { IOSInstallSteps } from "./IOSInstallSteps";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

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
const ProgrammerCalculator = dynamic(
  () => import("./ProgrammerCalculator").then((m) => m.ProgrammerCalculator),
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
  const [iosStepsOpen, setIosStepsOpen] = useState<boolean>(false);
  const install = useInstallPrompt();

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
  const isProgrammer = calc.mode === "programmer";

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
              <Mic2 className="h-4 w-4" />
            </button>
           <Link
              href="/chat"
              className="calc-util-btn"
              onClick={clickSound}
              aria-label="AI Chat (preview)"
              title="AI Chat (preview — not yet connected)"
            >
              <Bot className="h-4 w-4" />
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
              <CalculatorIcon className="h-4 w-4" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="calc-util-btn calc-hamburger-btn"
                  aria-label="Open menu"
                  title="Menu"
                  onClick={clickSound}
                >
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="calc-hamburger-menu">
                <DropdownMenuItem
                  className="calc-hamburger-item"
                  onSelect={() => {
                    clickSound();
                    setHistoryOpen(true);
                  }}
                >
                  <HistoryIcon className="h-4 w-4" />
                  History
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="calc-hamburger-item"
                  onSelect={() => {
                    clickSound();
                    setFavoritesOpen(true);
                  }}
                >
                  <Star className="h-4 w-4" />
                  Favorites
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="calc-hamburger-item"
                  onSelect={() => {
                    clickSound();
                    setAccountOpen(true);
                  }}
                >
                  <UserRound className="h-4 w-4" />
                  {auth.isAuthenticated ? "Account" : "Sign in"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="calc-hamburger-item"
                  onSelect={() => {
                    clickSound();
                    setSettingsOpen(true);
                  }}
                >
                  <Settings className="h-4 w-4" />
                  Settings / Themes
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="calc-hamburger-item"
                  onSelect={() => {
                    clickSound();
                    setAboutOpen(true);
                  }}
                >
                  <Info className="h-4 w-4" />
                  About
                </DropdownMenuItem>
                {!install.installed ? (
                  <DropdownMenuItem
                    className="calc-hamburger-item"
                    onSelect={() => {
                      clickSound();
                      if (install.canInstall) {
                        install.promptInstall();
                      } else {
                        setIosStepsOpen(true);
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Install App
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!isConverter && !isProgrammer && smartOpen ? <SmartBar calc={calc} /> : null}

        {isConverter ? (
          <Converter />
        ) : isProgrammer ? (
          <ProgrammerCalculator />
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

      <IOSInstallSteps open={iosStepsOpen} onClose={() => setIosStepsOpen(false)} />
    </>
  );
}