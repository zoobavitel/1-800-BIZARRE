import React, { useMemo } from "react";
import {
  armorKindLabel,
  inventoryArmorEntries,
  normalizeInventoryKitList,
} from "../utils/loadoutUtils";

const boxBase = {
  width: "20px",
  height: "20px",
  border: "1px solid #4b5563",
  cursor: "pointer",
  flexShrink: 0,
};

function ArmorChargeBoxes({
  count,
  used,
  onToggleAt,
  spentColor = "#1f2937",
  activeColor = "#b45309",
  borderColor = "#4b5563",
  showCheck = false,
  spendTitle = "Click to spend",
  restoreTitle = "Used — click to restore",
}) {
  if (count <= 0) return null;
  return (
    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
      {Array.from({ length: count }, (_, i) => {
        const spent = i < used;
        return (
          <div
            key={`armor-box-${i}`}
            onClick={() => onToggleAt(i, spent)}
            title={spent ? restoreTitle : spendTitle}
            style={{
              ...boxBase,
              border: `1px solid ${borderColor}`,
              background: spent ? activeColor : spentColor,
              display: showCheck ? "flex" : "block",
              alignItems: showCheck ? "center" : undefined,
              justifyContent: showCheck ? "center" : undefined,
              fontSize: showCheck ? "13px" : undefined,
              lineHeight: showCheck ? 1 : undefined,
              color: showCheck && spent ? "#e5e7eb" : "transparent",
              userSelect: "none",
            }}
          >
            {showCheck && spent ? "✓" : null}
          </div>
        );
      })}
    </div>
  );
}

function ArmorRow({ label, sublabel, countLabel, children, hint }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <span
        style={{
          fontSize: "10px",
          color: "#9ca3af",
          display: "block",
          marginBottom: "4px",
        }}
      >
        {label}
        {sublabel ? (
          <span style={{ color: "#6b7280", fontWeight: "normal" }}>{sublabel}</span>
        ) : null}
        {countLabel ? (
          <span style={{ marginLeft: "4px" }}>{countLabel}</span>
        ) : null}
      </span>
      {hint ? (
        <div
          style={{
            fontSize: "9px",
            color: "#6b7280",
            lineHeight: 1.35,
            marginBottom: "4px",
          }}
        >
          {hint}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export default function CharacterSheetArmorPanel({
  showStandArmor = false,
  standArmorMax,
  standArmorUsed,
  onStandArmorUsedChange,
  showSpinArmor,
  spinArmorUsed,
  onSpinArmorUsedChange,
  showHamonArmor,
  hamonArmorUsed,
  onHamonArmorUsedChange,
  inventory = [],
  physicalArmorUsed,
  onPhysicalArmorUsedChange,
  specialArmorUsed,
  onSpecialArmorUsedChange,
}) {
  const kit = useMemo(() => normalizeInventoryKitList(inventory), [inventory]);
  const gearEntries = useMemo(() => inventoryArmorEntries(kit), [kit]);

  const physicalEntries = gearEntries.filter((e) => e.pool === "physical");
  const specialEntries = gearEntries.filter((e) => e.pool === "special");

  let physicalOffset = 0;
  let specialOffset = 0;

  const hasStand = showStandArmor && standArmorMax > 0;
  const hasGearArmor = gearEntries.length > 0;
  const hasAny =
    hasStand ||
    showSpinArmor ||
    showHamonArmor ||
    hasGearArmor;

  if (!hasAny) {
    return (
      <div
        style={{
          flex: "1 1 200px",
          minWidth: 0,
          maxWidth: "240px",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: "#9ca3af",
            display: "block",
            marginBottom: "6px",
          }}
        >
          ARMOR
        </span>
        <div style={{ fontSize: "9px", color: "#6b7280", lineHeight: 1.35 }}>
          No armor available — Stand durability, playbook abilities (Spin/Hamon),
          or inventory armor (Add armor).
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: "1 1 200px",
        minWidth: 0,
        maxWidth: "240px",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "#9ca3af",
          display: "block",
          marginBottom: "6px",
        }}
      >
        ARMOR
      </span>

      {hasStand ? (
        <ArmorRow
          label="STAND"
          sublabel=" (path)"
          countLabel={
            <span style={{ color: "#0ea5e9" }}>({standArmorMax} chg)</span>
          }
        >
          <ArmorChargeBoxes
            count={standArmorMax}
            used={standArmorUsed}
            onToggleAt={(i, spent) =>
              onStandArmorUsedChange(spent ? i : i + 1)
            }
            spentColor="#1f2937"
            activeColor="#1f2937"
            showCheck
            spendTitle="Click to spend (Stand takes the hit)"
          />
        </ArmorRow>
      ) : null}

      {showSpinArmor ? (
        <ArmorRow
          label="SPIN"
          countLabel={<span style={{ color: "#f59e0b" }}>(3 chg)</span>}
        >
          <ArmorChargeBoxes
            count={3}
            used={spinArmorUsed}
            onToggleAt={(i, spent) => onSpinArmorUsedChange(spent ? i : i + 1)}
            activeColor="#b45309"
            spendTitle="Click to spend Spin armor charge"
          />
        </ArmorRow>
      ) : null}

      {showHamonArmor ? (
        <ArmorRow
          label="HAMON"
          countLabel={<span style={{ color: "#22c55e" }}>(3 chg)</span>}
        >
          <ArmorChargeBoxes
            count={3}
            used={hamonArmorUsed}
            onToggleAt={(i, spent) => onHamonArmorUsedChange(spent ? i : i + 1)}
            activeColor="#15803d"
            spendTitle="Click to spend Hamon armor charge"
          />
        </ArmorRow>
      ) : null}

      {physicalEntries.map((entry) => {
        const start = physicalOffset;
        physicalOffset += entry.charges;
        const segmentUsed = Math.max(
          0,
          Math.min(entry.charges, physicalArmorUsed - start),
        );
        const label =
          entry.kind === "heavy" ? "HEAVY ARMOR" : armorKindLabel(entry.kind);
        return (
          <ArmorRow
            key={`gear-armor-${entry.item.id}`}
            label={label}
            sublabel={` · ${entry.item.name}`}
            countLabel={
              <span style={{ color: "#0ea5e9" }}>
                ({entry.charges} chg)
              </span>
            }
          >
            <ArmorChargeBoxes
              count={entry.charges}
              used={segmentUsed}
              onToggleAt={(i, spent) =>
                onPhysicalArmorUsedChange(spent ? start + i : start + i + 1)
              }
              activeColor="#b45309"
              spendTitle={
                entry.kind === "heavy"
                  ? "Click to spend (−1 harm; mark both for −2)"
                  : "Click to spend (−1 harm)"
              }
            />
          </ArmorRow>
        );
      })}

      {specialEntries.map((entry) => {
        const start = specialOffset;
        specialOffset += 1;
        const segmentUsed = Math.max(
          0,
          Math.min(1, specialArmorUsed - start),
        );
        return (
          <ArmorRow
            key={`gear-special-${entry.item.id}`}
            label="SPECIAL ARMOR"
            sublabel={` · ${entry.item.name}`}
            countLabel={
              <span style={{ color: "#a855f7" }}>(1 use)</span>
            }
            hint="Resist a qualifying consequence or push without 2 stress."
          >
            <ArmorChargeBoxes
              count={1}
              used={segmentUsed}
              onToggleAt={(_, spent) =>
                onSpecialArmorUsedChange(spent ? start : start + 1)
              }
              spentColor="#1f2937"
              activeColor="#7c3aed"
              borderColor="#7c3aed"
              spendTitle="Click to spend special armor"
            />
          </ArmorRow>
        );
      })}
    </div>
  );
}
