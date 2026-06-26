import { StyleSheet } from "react-native";

import {
  CALCULATOR_APPLY_HEIGHT,
  CALCULATOR_APPLY_TOP_MARGIN,
  CALCULATOR_CONTENT_PADDING,
  CALCULATOR_DISPLAY_TOP_MARGIN,
  CALCULATOR_HEADER_HEIGHT,
  CALCULATOR_KEY_GAP,
  CALCULATOR_KEYPAD_TOP_MARGIN,
  CALCULATOR_POPUP_RESULT_MIN_HEIGHT,
  CALCULATOR_RESULT_MIN_HEIGHT,
} from "./calculatorLayout";

export const styles = StyleSheet.create({
  balanceCard: {
    alignSelf: "center",
    marginVertical: 6,
    width: "100%",
  },
  balanceCardContent: {
    gap: 12,
    paddingBottom: 16,
    paddingTop: 16,
  },
  balanceCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  balanceDetailActions: {
    alignItems: "flex-end",
    gap: 4,
  },
  balanceDetailList: {
    gap: 8,
  },
  balanceDetailRow: {
    alignItems: "center",
    borderLeftWidth: 3,
    flexDirection: "row",
    gap: 8,
    paddingLeft: 12,
  },
  authCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    padding: 16,
    width: "100%",
  },
  bottomSheetHandle: {
    alignSelf: "center",
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 40,
  },
  bottomSheetWrapper: {
    justifyContent: "flex-end",
  },
  calendarDay: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    width: "14.28%",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  card: {
    alignSelf: "center",
    marginTop: 10,
    width: "100%",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  clickable: {
    cursor: "pointer" as any,
  },
  currencyInput: {
    width: 120,
  },
  currencyConverterContent: {
    gap: 12,
  },
  currencyConverterCommonValues: {
    gap: 12,
  },
  currencyConverterCommonValueHeader: {
    paddingTop: 0,
  },
  currencyConverterCommonValueRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  currencyConverterCommonValueTable: {
    gap: 0,
  },
  currencyConverterCommonValueTarget: {
    flexShrink: 1,
    textAlign: "right",
  },
  currencyConverterCurrencies: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  currencyConverterCurrencyButton: {
    flex: 1,
  },
  currencyConverterEmpty: {
    alignItems: "center",
    gap: 12,
  },
  currencyConverterLoading: {
    alignItems: "center",
    paddingVertical: 32,
  },
  currencyConverterRatesInfo: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  currencyConverterRatesInfoCompact: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
  currencyConverterRatesCopy: {
    flexShrink: 1,
  },
  currencyConverterRefreshButton: {
    alignSelf: "flex-start",
  },
  currencyConverterResult: {
    gap: 6,
  },
  currencyConverterWarning: {
    marginTop: 10,
    width: "100%",
  },
  currencyConverterWarningContent: {
    gap: 4,
  },
  calculatorApply: {
    marginTop: CALCULATOR_APPLY_TOP_MARGIN,
    minHeight: CALCULATOR_APPLY_HEIGHT,
  },
  calculatorDisplay: {
    borderRadius: 12,
    gap: 4,
    marginTop: CALCULATOR_DISPLAY_TOP_MARGIN,
    minHeight: CALCULATOR_POPUP_RESULT_MIN_HEIGHT,
    padding: 16,
  },
  calculatorDisplayFullscreen: {
    flex: 1,
    justifyContent: "center",
    minHeight: CALCULATOR_RESULT_MIN_HEIGHT,
  },
  calculatorExpression: {
    textAlign: "right",
  },
  calculatorFullscreen: {
    flex: 1,
    padding: CALCULATOR_CONTENT_PADDING,
    width: "100%",
  },
  calculatorFullscreenWrapper: {
    margin: 0,
  },
  calculatorHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: CALCULATOR_HEADER_HEIGHT,
  },
  calculatorKey: {
    alignItems: "center",
    borderRadius: 999,
    justifyContent: "center",
  },
  calculatorKeyLabel: {
    textAlign: "center",
  },
  calculatorResult: {
    textAlign: "right",
  },
  calculatorKeypad: {
    gap: CALCULATOR_KEY_GAP,
    marginTop: CALCULATOR_KEYPAD_TOP_MARGIN,
  },
  calculatorKeyPlaceholder: {
    opacity: 0,
  },
  calculatorKeyRow: {
    flexDirection: "row",
    gap: CALCULATOR_KEY_GAP,
    justifyContent: "space-between",
  },
  calculatorPopup: {
    alignSelf: "center",
    borderRadius: 20,
    maxHeight: "94%",
    maxWidth: 420,
    padding: CALCULATOR_CONTENT_PADDING,
    width: "94%",
  },
  calculatorPopupWrapper: {
    justifyContent: "center",
  },
  emptyStateContent: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  emptyStateImage: {
    height: 170,
    maxHeight: 170,
    maxWidth: 320,
    width: "82%",
  },
  cropPreview: {
    alignSelf: "center",
    backgroundColor: "#111",
    borderColor: "#fff",
    borderWidth: 3,
    borderRadius: 128,
    height: 256,
    overflow: "hidden",
    width: 256,
  },
  imageSearchSheet: {
    alignSelf: "center",
    borderRadius: 16,
    gap: 12,
    maxWidth: 720,
    padding: 16,
    width: "94%",
  },
  imageSearchEmpty: {
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    paddingVertical: 32,
  },
  imageSearchGrid: {
    gap: 8,
    paddingBottom: 16,
  },
  imageSearchRow: {
    gap: 8,
  },
  imageSearchCell: {
    aspectRatio: 1,
    borderRadius: 8,
    flex: 1,
    overflow: "hidden",
  },
  imageSearchThumb: {
    height: "100%",
    width: "100%",
  },
  attribution: {
    marginTop: 8,
  },
  imagePopupImage: {
    alignSelf: "center",
    aspectRatio: 1,
    borderRadius: 8,
    maxWidth: 280,
    width: "100%",
  },
  contentWidth: {
    alignSelf: "center",
    // flexShrink lets the wrapper stay within a bounded parent (e.g. a bottom
    // sheet with maxHeight) so its scrollable child can shrink and scroll
    // instead of pushing the header out of the sheet. It has no effect inside a
    // vertical ScrollView (the normal Screen case), where height is unbounded.
    flexShrink: 1,
    gap: 16,
    maxWidth: 960,
    width: "100%",
  },
  flex: {
    flex: 1,
  },
  expenseDate: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    minWidth: 48,
  },
  expenseNet: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 96,
  },
  expenseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 76,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  gap: {
    gap: 12,
  },
  inline: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  listItemDense: {
    borderRadius: 8,
    cursor: "pointer" as any,
    minHeight: 52,
  },
  listSection: {
    gap: 8,
    marginTop: 8,
  },
  listScreen: {
    alignItems: "center",
    flexGrow: 1,
    gap: 12,
    padding: 20,
  },
  listScreenContent: {
    gap: 12,
    maxWidth: 960,
    width: "100%",
  },
  listTile: {
    borderRadius: 6,
    cursor: "pointer" as any,
    minHeight: 64,
    paddingVertical: 6,
  },
  mapMeta: {
    alignItems: "center",
  },
  optionRow: {
    cursor: "pointer" as any,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionRowCard: {
    padding: 0,
  },
  optionRowContent: {
    cursor: "pointer" as any,
    flex: 1,
    paddingLeft: 16,
    paddingVertical: 14,
  },
  optionRowWithAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingRight: 4,
  },
  bold: {
    fontWeight: "700",
  },
  selfCenter: {
    alignSelf: "center",
  },
  searchbarInSheet: {
    marginBottom: 8,
    marginTop: 8,
  },
  // Compact searchbar that sits inside the navigation header in place of the
  // screen title while a list is being searched. Fills its container, which is
  // stretched to full width by `headerSearchContainer`.
  searchbarInHeader: {
    height: 44,
    width: "100%",
  },
  // The Searchbar's bar-mode input defaults to minHeight 56, which overflows
  // the compact 44px header bar and pushes the text off-center; clear it so the
  // input fills (and is centered within) the bar instead.
  searchbarInHeaderInput: {
    minHeight: 0,
    paddingVertical: 0,
  },
  // Lets the header title container span the full available width so the
  // in-header searchbar is not capped by the default centered title width.
  headerSearchContainer: {
    flex: 1,
    marginHorizontal: 0,
    maxWidth: "100%",
  },
  // Collapses the (empty) header-right container while searching so it does not
  // claim half of the row from the searchbar via its default flex-grow.
  headerSearchRightCollapsed: {
    flexBasis: "auto",
    flexGrow: 0,
  },
  // Bounds a sheet's scrollable list so it scrolls internally rather than
  // pushing the sheet's fixed header (title, search) off-screen on long lists.
  sheetScroll: {
    flexShrink: 1,
  },
  suggestionList: {
    gap: 4,
    marginTop: 8,
  },
  bottomSheetFooter: {
    marginTop: 12,
  },
  sectionGap: {
    marginTop: 8,
  },
  sectionLabel: {
    marginBottom: 4,
  },
  listTileRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricTile: {
    flexGrow: 1,
    minWidth: 140,
  },
  memberActionRow: {
    marginTop: 8,
  },
  memberCardRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  memberContent: {
    flex: 1,
    gap: 4,
  },
  loginBrandMark: {
    alignItems: "center",
    height: 72,
    justifyContent: "center",
    marginBottom: 24,
    width: 72,
  },
  loginBrandImage: {
    height: 58,
    width: 58,
  },
  loginHero: {
    alignItems: "flex-start",
    justifyContent: "flex-end",
    padding: 24,
    paddingBottom: 28,
    width: "100%",
  },
  loginHeroWeb: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  loginPanel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 14,
    padding: 24,
    width: "100%",
  },
  loginPanelWeb: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  loginContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  loginScreen: {
    alignItems: "center",
    flexGrow: 1,
    padding: 20,
  },
  loginFooter: {
    alignItems: "center",
    paddingTop: 16,
    width: "100%",
  },
  loginShell: {
    width: "100%",
  },
  loginShellWeb: {
    maxWidth: 520,
  },
  loginSubtitle: {
    maxWidth: 440,
  },
  loginDemoSection: {
    gap: 10,
    marginTop: 8,
  },
  loginDemoHint: {
    textAlign: "center",
  },
  loginTitle: {
    fontWeight: "700",
    marginBottom: 8,
  },
  subtleFooterLink: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  screen: {
    alignItems: "center",
    flexGrow: 1,
    gap: 16,
    padding: 20,
  },
  screenContent: {
    gap: 16,
    maxWidth: 960,
    width: "100%",
  },
  settlementPerson: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  settlementPreview: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
  },
  splitRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
  },
  splitRowInput: {
    minWidth: 110,
    width: 130,
  },
  subtleRow: {
    borderLeftWidth: 3,
    paddingLeft: 12,
  },
});
