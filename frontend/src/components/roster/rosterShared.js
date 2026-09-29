/** Shared expand panel chrome for roster PC/NPC/faction floats. */
export const rosterExpandPanelChrome = {
  marginTop: 8,
  padding: 12,
  background: "#0d1117",
  border: "1px solid #4338ca",
  borderRadius: 8,
  position: "relative",
  boxSizing: "border-box",
};

export const rosterTwoColumnGridStyle = (showSecondColumn) => ({
  display: "grid",
  gridTemplateColumns: showSecondColumn ? "1fr 1fr" : "1fr",
  gap: 16,
  marginBottom: 12,
  alignItems: "start",
});
