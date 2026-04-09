import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../features/auth";
import { useTheme } from "../features/theme/ThemeContext";
import "./HamburgerMenu.css";

const RULES_MECHANICS = [
  { label: "Heritages", slug: "heritage" },
  {
    label: "Playbooks (Stand / Spin / Hamon)",
    slug: "stand-playbook-example-builds",
  },
  { label: "Vice", slug: "vice" },
  { label: "Trauma & Stress", slug: "stress-trauma" },
  { label: "Action Ratings", slug: "skill-checks" },
  { label: "Devil's Bargain", slug: "consequences-harm" },
];

const RULES_RESOURCES = [
  { label: "How to Play", slug: "the-basics" },
  { label: "Basic Rules", slug: "the-core-system" },
  { label: "Glossary", slug: "resources" },
  { label: "Character Sheet", slug: "character-creation" },
  { label: "Full SRD", slug: null },
];

export default function HamburgerMenu({
  open,
  onToggle,
  onClose,
  currentPage,
  onPageChange,
  characters = [],
  onSelectCharacter,
  onNewCharacter,
  hideBuiltInButton = false,
  isAuthenticated = false,
  onLogin,
  onLogout,
}) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [expanded, setExpanded] = useState({
    play: true,
    rules: false,
    library: false,
  });

  const handleNav = useCallback(
    (page, payload) => {
      onPageChange?.(page, payload);
      onClose?.();
    },
    [onPageChange, onClose],
  );

  const goRules = useCallback(
    (slug) => {
      if (slug) handleNav("rules", { section: slug });
      else handleNav("rules");
    },
    [handleNav],
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && open) onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const toggleSection = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDark = theme === "dark";

  const drawer = (
    <div className="hm-poc">
      <div
        role="presentation"
        className={`nav-overlay${open ? " open" : ""}`}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose?.()}
      />
      <nav
        className={`nav-drawer${open ? " open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="nav-drawer-top">
          <button
            type="button"
            className="nav-logo"
            onClick={() => handleNav("home")}
          >
            1(800)BIZARRE
          </button>
          <button
            type="button"
            className="nav-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="nav-toggle-row">
          <button
            type="button"
            className={`toggle-track${isDark ? "" : " off"}`}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            <span className="toggle-knob" />
          </button>
          <span className="toggle-label">
            {isDark ? "Dark Mode" : "Light Mode"}
          </span>
        </div>

        <div className="nav-section">
          <button
            type="button"
            className={`nav-section-header${expanded.play ? " expanded" : ""}`}
            onClick={() => toggleSection("play")}
            aria-expanded={expanded.play}
          >
            <span className="nav-section-num">01</span>
            <span className="nav-section-title">Play Game</span>
            <span className="nav-section-chevron">▶</span>
          </button>
          <div
            className={`nav-section-items${expanded.play ? " expanded" : ""}`}
            id="nav-play"
          >
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("character")}
            >
              Characters
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("character-options")}
            >
              Character Options
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("campaigns")}
            >
              Campaigns
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("campaigns")}
            >
              Connect to GM
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("npcs")}
            >
              GM — NPCs
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("abilities")}
            >
              Ability Browser
            </button>
            <span className="nav-item nav-item-soon">Virtual Table</span>
          </div>
        </div>

        <div className="nav-section">
          <button
            type="button"
            className={`nav-section-header${expanded.rules ? " expanded" : ""}`}
            onClick={() => toggleSection("rules")}
            aria-expanded={expanded.rules}
          >
            <span className="nav-section-num">02</span>
            <span className="nav-section-title">Rules</span>
            <span className="nav-section-chevron">▶</span>
          </button>
          <div
            className={`nav-section-items${expanded.rules ? " expanded" : ""}`}
            id="nav-rules"
          >
            <div className="nav-subheader">Mechanics</div>
            {RULES_MECHANICS.map((item) => (
              <button
                key={item.slug}
                type="button"
                className="nav-item"
                onClick={() => goRules(item.slug)}
              >
                {item.label}
              </button>
            ))}
            <div className="nav-subheader" style={{ marginTop: 8 }}>
              Resources
            </div>
            {RULES_RESOURCES.map((item) => (
              <button
                key={item.label}
                type="button"
                className="nav-item"
                onClick={() => goRules(item.slug)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="nav-section">
          <button
            type="button"
            className={`nav-section-header${expanded.library ? " expanded" : ""}`}
            onClick={() => toggleSection("library")}
            aria-expanded={expanded.library}
          >
            <span className="nav-section-num">03</span>
            <span className="nav-section-title">Library</span>
            <span className="nav-section-chevron">▶</span>
          </button>
          <div
            className={`nav-section-items${expanded.library ? " expanded" : ""}`}
            id="nav-library"
          >
            <button
              type="button"
              className="nav-item"
              onClick={() => goRules("the-core-system")}
            >
              Basic Rules
            </button>
            <button
              type="button"
              className="nav-item"
              onClick={() => handleNav("rules")}
            >
              Full SRD
            </button>
          </div>
        </div>

        <div className="nav-footer">
          {isAuthenticated && user?.username && (
            <div className="nav-footer-user">
              <span className="nav-footer-user-name">
                {(user.username || "").toUpperCase()}
              </span>
              {typeof onLogout === "function" && (
                <button
                  type="button"
                  className="nav-footer-signout"
                  onClick={() => {
                    onLogout();
                    onClose?.();
                  }}
                >
                  Sign Out
                </button>
              )}
            </div>
          )}
          <div className="nav-footer-links">
            <button
              type="button"
              className="nav-footer-link"
              onClick={() => handleNav("patch-notes")}
            >
              Patch Notes
            </button>
            <span
              className="nav-footer-link"
              style={{ cursor: "default", opacity: 0.4 }}
            >
              ·
            </span>
            <button
              type="button"
              className="nav-footer-link"
              onClick={() => handleNav("licenses")}
            >
              Licenses
            </button>
            <span
              className="nav-footer-link"
              style={{ cursor: "default", opacity: 0.4 }}
            >
              ·
            </span>
            <button
              type="button"
              className="nav-footer-link"
              onClick={() => {
                window.location.href =
                  "mailto:?subject=1(800)BIZARRE%20error%20report";
                onClose?.();
              }}
            >
              Report Error
            </button>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {!hideBuiltInButton && (
        <button
          type="button"
          className="hm-builtin-hamburger"
          onClick={onToggle}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}
      {typeof document !== "undefined" && createPortal(drawer, document.body)}
    </>
  );
}
