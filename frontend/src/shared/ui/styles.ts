import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  authCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center"
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    padding: 16,
    width: "100%"
  },
  bottomSheetHandle: {
    alignSelf: "center",
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 40
  },
  bottomSheetWrapper: {
    justifyContent: "flex-end"
  },
  calendarDay: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    width: "14.28%"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12
  },
  card: {
    alignSelf: "center",
    marginTop: 10,
    width: "100%"
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  clickable: {
    cursor: "pointer" as any
  },
  currencyInput: {
    width: 120
  },
  cropPreview: {
    alignSelf: "center",
    backgroundColor: "#111",
    borderColor: "#fff",
    borderWidth: 3,
    borderRadius: 128,
    height: 256,
    overflow: "hidden",
    width: 256
  },
  contentWidth: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 960,
    width: "100%"
  },
  flex: {
    flex: 1
  },
  expenseDate: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    minWidth: 48
  },
  expenseNet: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 96
  },
  expenseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 76
  },
  formRow: {
    flexDirection: "row",
    gap: 12
  },
  gap: {
    gap: 12
  },
  inline: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  listItemDense: {
    borderRadius: 8,
    cursor: "pointer" as any,
    minHeight: 52
  },
  listSection: {
    gap: 8,
    marginTop: 8
  },
  listScreen: {
    alignItems: "center",
    flexGrow: 1,
    gap: 12,
    padding: 20
  },
  listScreenContent: {
    gap: 12,
    maxWidth: 960,
    width: "100%"
  },
  listTile: {
    borderRadius: 6,
    cursor: "pointer" as any,
    minHeight: 64,
    paddingVertical: 6
  },
  listTileRight: {
    alignItems: "flex-end",
    justifyContent: "center"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricTile: {
    flexGrow: 1,
    minWidth: 140
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between"
  },
  screen: {
    alignItems: "center",
    flexGrow: 1,
    gap: 16,
    padding: 20
  },
  screenContent: {
    gap: 16,
    maxWidth: 960,
    width: "100%"
  },
  settlementPerson: {
    alignItems: "center",
    flex: 1,
    gap: 6
  },
  settlementPreview: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16
  },
  splitRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 56
  },
  splitRowInput: {
    minWidth: 110,
    width: 130
  },
  subtleRow: {
    borderLeftWidth: 3,
    paddingLeft: 12
  }
});
