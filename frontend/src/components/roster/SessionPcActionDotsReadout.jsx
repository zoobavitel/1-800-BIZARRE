import React from "react";
import {
  SESSION_ACTION_DOT_COLUMNS,
  actionDotRatingMap,
} from "./rosterPcExpandReadouts";

/** Read-only action dots — same 12px circle visual as CharacterSheet (no edit/roll). */
export default function SessionPcActionDotsReadout({ actionDots }) {
  const ratings = actionDotRatingMap(actionDots);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      {SESSION_ACTION_DOT_COLUMNS.map(({ attr, actions }) => {
        const attrRating = actions.reduce(
          (n, a) => n + ((ratings[a] || 0) > 0 ? 1 : 0),
          0,
        );
        return (
          <div key={attr} style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: "bold",
                  color: "#e5e7eb",
                }}
              >
                {attr}
              </span>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4].map((d) => (
                  <div
                    key={d}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      border: "1px solid #4b5563",
                      background: d <= attrRating ? "#3b82f6" : "#1f2937",
                    }}
                    title={`${attr} rating ${attrRating}`}
                  />
                ))}
              </div>
            </div>
            {actions.map((action) => {
              const rating = ratings[action] || 0;
              return (
                <div
                  key={action}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "#d1d5db",
                      textTransform: "uppercase",
                    }}
                  >
                    {action}
                  </span>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[1, 2, 3, 4].map((d) => (
                      <div
                        key={d}
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          border: "1px solid var(--text-dim, #6b7280)",
                          background:
                            d <= rating
                              ? "var(--hftf-purple, #7c3aed)"
                              : "var(--bg-card, #0d1117)",
                        }}
                        title={`${action} ${rating}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
