import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, MessageSquare, Settings, LogOut } from "lucide-react";
import "./UserMenu.css";

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      className={`um-item${danger ? " um-item--danger" : ""}`}
      onClick={onClick}
    >
      {Icon && (
        <Icon
          size={16}
          strokeWidth={2}
          className="um-item-icon"
          aria-hidden
        />
      )}
      <span>{label}</span>
    </button>
  );
}

export default function UserMenu({
  open,
  onClose,
  onNavigateToNotifications,
  onNavigateToMessages,
  onNavigateToAccountSettings,
  onLogout,
}) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && open) onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleNav = (fn) => {
    if (typeof fn === "function") fn();
    onClose?.();
  };

  const panel = (
    <div className="um-hftf">
      {open && (
        <div
          className="um-overlay"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose?.()}
          aria-hidden="true"
        />
      )}
      <div
        className={`um-drawer${open ? " um-drawer--open" : ""}`}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-label="User menu"
      >
        <div className="um-drawer-top">
          <div className="um-drawer-brand">
            <span className="um-drawer-brand-mark" aria-hidden="true">
              ◇
            </span>
            <span className="um-drawer-brand-text">User menu</span>
          </div>
          <button
            type="button"
            className="um-drawer-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="um-body">
          <div className="um-section-label">Account</div>
          <MenuItem
            icon={Bell}
            label="Notifications"
            onClick={() => handleNav(onNavigateToNotifications)}
          />
          <MenuItem
            icon={MessageSquare}
            label="Messages"
            onClick={() => handleNav(onNavigateToMessages)}
          />
          <MenuItem
            icon={Settings}
            label="Account Settings"
            onClick={() => handleNav(onNavigateToAccountSettings)}
          />
          <MenuItem
            icon={LogOut}
            label="Sign Out"
            danger
            onClick={() => {
              if (typeof onLogout === "function") onLogout();
              onClose?.();
            }}
          />
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(panel, document.body)
    : null;
}
